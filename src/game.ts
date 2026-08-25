import streamDeck, { type KeyAction } from "@elgato/streamdeck";

import {
	CUSTOM_LIMITS,
	DEFAULT_SETTINGS,
	DIFFICULTIES,
	DIFFICULTY_TIMINGS,
	ENDLESS_START_SECONDS,
	FIGURES,
	GAME_OVER_MS,
	Hud,
	ROUND_LENGTHS,
	TILE_IDLE,
	figureState,
	type GameSettings,
	type Timing,
} from "./config";

/** The visible keys of one role, addressed by action id. */
class KeyRegistry {
	readonly #keys = new Map<string, KeyAction>();

	get size(): number {
		return this.#keys.size;
	}

	add(key: KeyAction): void {
		this.#keys.set(key.id, key);
	}

	get(id: string): KeyAction | undefined {
		return this.#keys.get(id);
	}

	delete(key: { id: string }): void {
		this.#keys.delete(key.id);
	}

	[Symbol.iterator](): IterableIterator<KeyAction> {
		return this.#keys.values();
	}
}

/** Phases a board can be in. */
type Phase =
	/** Idle, ready to start a round. */
	| "ready"
	/** A round is running. */
	| "playing"
	/** The round just ended and the result is on screen. */
	| "over";

/**
 * The game itself. A single instance owns the whole board: it tracks which keys
 * are visible, drives the round clock, decides where the next figure surfaces and
 * keeps every key's title and state in sync.
 */
class Game {
	// Keyed by action id rather than held in a Set: Stream Deck hands out a fresh
	// action object per event, so object identity is not a reliable key.
	/** Visible keys, grouped by role. Populated by `onWillAppear`. */
	readonly tiles = new KeyRegistry();
	readonly startKeys = new KeyRegistry();
	readonly timerKeys = new KeyRegistry();
	readonly scoreKeys = new KeyRegistry();

	#settings: GameSettings = structuredClone(DEFAULT_SETTINGS);
	#phase: Phase = "ready";
	#score = 0;
	#remaining = 0;
	#showHighScore = false;

	/** The tile currently holding a figure, and which figure it is. */
	#raised: { tile: KeyAction; figure: number } | null = null;
	/** Previous tile, so the same key is never used twice in a row. */
	#lastTile: KeyAction | null = null;

	#clock: NodeJS.Timeout | undefined;
	#peep: NodeJS.Timeout | undefined;
	#cooldown: NodeJS.Timeout | undefined;

	get isPlaying(): boolean {
		return this.#phase === "playing";
	}

	get isReady(): boolean {
		return this.#phase === "ready";
	}

	get settings(): Readonly<GameSettings> {
		return this.#settings;
	}

	/* ---------------------------------------------------------------------- */
	/* settings                                                                */
	/* ---------------------------------------------------------------------- */

	/** Loads persisted settings, repairing anything missing or out of range. */
	async load(): Promise<void> {
		const stored = await streamDeck.settings.getGlobalSettings<Partial<GameSettings>>();
		this.apply(stored);
	}

	/**
	 * Merges stored settings over the defaults. Values are clamped rather than
	 * trusted, so a hand-edited settings file cannot break the game.
	 */
	apply(stored: Partial<GameSettings>): void {
		const merged = { ...structuredClone(DEFAULT_SETTINGS), ...stored };

		merged.difficulty = clampIndex(merged.difficulty, DIFFICULTIES.length);
		merged.roundLength = clampIndex(merged.roundLength, ROUND_LENGTHS.length);

		// Changing the rules mid-round would score against the wrong high score
		// slot, so a round in progress keeps the settings it started with.
		if (!this.isReady) {
			merged.difficulty = this.#settings.difficulty;
			merged.roundLength = this.#settings.roundLength;
		}

		merged.customMin = clamp(merged.customMin, CUSTOM_LIMITS.min, CUSTOM_LIMITS.max);
		merged.customMax = clamp(merged.customMax, merged.customMin, CUSTOM_LIMITS.max);
		merged.highScores = DIFFICULTIES.map((_, d) =>
			ROUND_LENGTHS.map((_, r) => Math.max(0, Math.trunc(stored.highScores?.[d]?.[r] ?? 0))),
		);

		this.#settings = merged;
		void this.refreshTimerKeys();
		void this.refreshScoreKeys();
	}

	async #persist(): Promise<void> {
		await streamDeck.settings.setGlobalSettings({ ...this.#settings });
	}

	/** Cycles to the next round length. Ignored while a round is running. */
	async nextRoundLength(): Promise<void> {
		if (!this.isReady) return;

		this.#settings.roundLength = (this.#settings.roundLength + 1) % ROUND_LENGTHS.length;
		await this.#persist();
		await this.refreshTimerKeys();
		await this.refreshScoreKeys();
	}

	/** Cycles to the next difficulty. Ignored while a round is running. */
	async nextDifficulty(): Promise<void> {
		if (!this.isReady) return;

		this.#settings.difficulty = (this.#settings.difficulty + 1) % DIFFICULTIES.length;
		await this.#persist();
		await this.refreshTimerKeys();
		await this.refreshScoreKeys();
	}

	/** Flips the score key between the current score and the high score. */
	async toggleScoreView(): Promise<void> {
		if (this.isPlaying) return;

		this.#showHighScore = !this.#showHighScore;
		await this.refreshScoreKeys();
	}

	/* ---------------------------------------------------------------------- */
	/* round lifecycle                                                         */
	/* ---------------------------------------------------------------------- */

	/** Starts a round, provided the board is idle and has at least one tile. */
	async start(): Promise<void> {
		if (!this.isReady || this.tiles.size === 0) return;

		clearTimeout(this.#cooldown);
		this.#phase = "playing";
		this.#score = 0;
		this.#showHighScore = false;
		this.#lastTile = null;

		const length = ROUND_LENGTHS[this.#settings.roundLength];
		this.#remaining = length === "endless" ? ENDLESS_START_SECONDS : length;

		await this.#refreshAll();

		this.#clock = setInterval(() => void this.#tick(), 1000);
		void this.#raiseNext();
	}

	async #tick(): Promise<void> {
		if (!this.isPlaying) return;

		this.#remaining -= 1;
		if (this.#remaining <= 0) {
			this.#remaining = 0;
			await this.end();
			return;
		}

		await this.refreshTimerKeys();
	}

	/** Ends the round, records the high score and starts the cooldown. */
	async end(): Promise<void> {
		if (!this.isPlaying) return;

		this.#phase = "over";
		clearInterval(this.#clock);
		clearTimeout(this.#peep);
		this.#clock = undefined;
		this.#peep = undefined;
		this.#raised = null;
		this.#remaining = 0;

		await this.#lowerAllTiles();

		const { difficulty, roundLength } = this.#settings;
		if (this.#score > this.#settings.highScores[difficulty][roundLength]) {
			this.#settings.highScores[difficulty][roundLength] = this.#score;
			await this.#persist();
		}

		await this.#refreshAll();

		this.#cooldown = setTimeout(() => {
			this.#phase = "ready";
			void this.#refreshAll();
		}, GAME_OVER_MS);
	}

	/* ---------------------------------------------------------------------- */
	/* board                                                                   */
	/* ---------------------------------------------------------------------- */

	/**
	 * Registers a whack. Only the tile currently holding a figure scores, so a
	 * player cannot farm points by hammering every key at once.
	 */
	async whack(tile: KeyAction): Promise<void> {
		if (!this.isPlaying || this.#raised === null || this.#raised.tile.id !== tile.id) return;

		const { value } = FIGURES[this.#raised.figure];
		this.#raised = null;
		clearTimeout(this.#peep);

		await tile.setState(TILE_IDLE);
		this.#score += value;
		await this.refreshScoreKeys();

		// In endless mode the figures pay out in seconds instead of points.
		if (ROUND_LENGTHS[this.#settings.roundLength] === "endless") {
			this.#remaining = Math.max(1, this.#remaining + value);
			await this.refreshTimerKeys();
		}

		void this.#raiseNext();
	}

	/** Raises one figure on a random tile, then schedules the next one. */
	async #raiseNext(): Promise<void> {
		if (!this.isPlaying) return;

		const tile = this.#pickTile();
		if (tile === null) {
			// Every tile was removed mid-round; there is nothing left to play on.
			await this.end();
			return;
		}

		const figure = pickFigure();
		this.#raised = { tile, figure };
		this.#lastTile = tile;
		await tile.setState(figureState(figure));

		this.#peep = setTimeout(() => {
			void (async () => {
				// Ducked back under without being hit.
				if (this.#raised?.tile.id === tile.id) {
					this.#raised = null;
					await tile.setState(TILE_IDLE);
					await this.#raiseNext();
				}
			})();
		}, this.#peepDuration());
	}

	/** Picks a tile at random, avoiding an immediate repeat where possible. */
	#pickTile(): KeyAction | null {
		const tiles = [...this.tiles];
		if (tiles.length === 0) return null;

		const candidates = tiles.length > 1 ? tiles.filter((t) => t.id !== this.#lastTile?.id) : tiles;
		return candidates[Math.floor(Math.random() * candidates.length)];
	}

	/** How long the next figure stays up, per the active difficulty. */
	#peepDuration(): number {
		const { min, max } = this.#timing();
		return Math.round(min + Math.random() * (max - min));
	}

	#timing(): Timing {
		const difficulty = DIFFICULTIES[this.#settings.difficulty];
		return difficulty === "custom"
			? { min: this.#settings.customMin, max: this.#settings.customMax }
			: DIFFICULTY_TIMINGS[difficulty];
	}

	async #lowerAllTiles(): Promise<void> {
		await Promise.all([...this.tiles].map((tile) => tile.setState(TILE_IDLE)));
	}

	/* ---------------------------------------------------------------------- */
	/* key rendering                                                           */
	/* ---------------------------------------------------------------------- */

	async #refreshAll(): Promise<void> {
		await Promise.all([this.refreshStartKeys(), this.refreshTimerKeys(), this.refreshScoreKeys()]);
	}

	async refreshStartKeys(key?: KeyAction): Promise<void> {
		const title = this.isPlaying ? "WHACK!" : this.isReady ? "START\n-\nHOLD\nTO EXIT" : "GAME\nOVER";
		await this.#render(key ? [key] : this.startKeys, title);
	}

	async refreshTimerKeys(key?: KeyAction): Promise<void> {
		const difficulty = DIFFICULTIES[this.#settings.difficulty].toUpperCase();
		const length = ROUND_LENGTHS[this.#settings.roundLength];
		const showClock = !this.isReady;
		const value = showClock ? formatClock(this.#remaining) : length === "endless" ? "ENDLESS" : formatClock(length);

		await this.#render(key ? [key] : this.timerKeys, `${difficulty}\n\n${value}`);
	}

	async refreshScoreKeys(key?: KeyAction): Promise<void> {
		const { difficulty, roundLength } = this.#settings;
		const title = this.#showHighScore
			? `BEST\n\n${this.#settings.highScores[difficulty][roundLength]}`
			: `SCORE\n\n${this.#score}`;

		await this.#render(key ? [key] : this.scoreKeys, title);
	}

	/** Applies a title and the matching idle/active backdrop to a set of keys. */
	async #render(keys: Iterable<KeyAction>, title: string): Promise<void> {
		const state = this.isPlaying ? Hud.Active : Hud.Idle;
		await Promise.all([...keys].flatMap((key) => [key.setState(state), key.setTitle(title)]));
	}
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Summed once: the roster is fixed, so the pick below stays a single pass. */
const TOTAL_WEIGHT = FIGURES.reduce((sum, figure) => sum + figure.weight, 0);

/**
 * Picks what surfaces next, weighted by {@link FIGURES}. The four one-pointers
 * carry the round; the bonus and the three penalties get rarer the more they
 * are worth, so a costly face is a rare face rather than a common tax.
 *
 * @returns An index into {@link FIGURES}.
 */
function pickFigure(): number {
	let roll = Math.random() * TOTAL_WEIGHT;
	for (let i = 0; i < FIGURES.length; i++) {
		roll -= FIGURES[i].weight;
		if (roll < 0) return i;
	}

	// Only reachable if the roll lands exactly on the total through rounding.
	return FIGURES.length - 1;
}

function formatClock(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}

function clampIndex(value: number, length: number): number {
	return Number.isInteger(value) && value >= 0 && value < length ? value : 0;
}

/** The one and only board. */
export const game = new Game();
