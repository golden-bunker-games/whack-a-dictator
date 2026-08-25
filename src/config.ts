/** Static game configuration and the shape of the persisted settings. */

/** Selectable round lengths, in seconds. `endless` runs until the clock hits zero. */
export const ROUND_LENGTHS = [5, 10, 20, 30, "endless"] as const;

/** Seconds on the clock when an endless round begins. */
export const ENDLESS_START_SECONDS = 10;

export const DIFFICULTIES = ["easy", "normal", "hard", "custom"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * How long a figure stays up, in milliseconds. A value is picked at random from
 * the range each time, so the rhythm never becomes predictable.
 */
export const DIFFICULTY_TIMINGS: Record<Exclude<Difficulty, "custom">, Timing> = {
	easy: { min: 1000, max: 1500 },
	normal: { min: 650, max: 950 },
	hard: { min: 450, max: 800 },
};

export type Timing = {
	min: number;
	max: number;
};

/** Bounds accepted for the custom difficulty, in milliseconds. */
export const CUSTOM_LIMITS = { min: 200, max: 5000 } as const;

/** Manifest state index of an empty tile. The figures follow, in {@link FIGURES} order. */
export const TILE_IDLE = 0;

/** Manifest state indices of the HUD actions (start / timer / score). */
export const enum Hud {
	Idle = 0,
	Active = 1,
}

/** One of the figures that can surface on a tile. */
export type Figure = {
	/** Portrait file in portraits/, without the extension. */
	readonly id: string;
	/** What whacking this one is worth. Negative figures cost the player. */
	readonly value: number;
	/** How often it surfaces, relative to every other figure. */
	readonly weight: number;
};

/**
 * The roster, in tile state order: `FIGURES[i]` is state `i + 1`.
 *
 * This is the source of truth for the artwork as well. `scripts/roster.mjs`
 * reads the table straight out of this file to decide which portraits to build
 * and in which order, so adding a figure is a line here plus `<id>.png` in
 * portraits/ -- but that parser wants one entry per line, in this field
 * order, and the tile action in the manifest has to grow a matching state.
 * `npm run assets` fails loudly rather than quietly shipping a mismatch.
 *
 * The weights sum to 30: four hits in five are worth points, one in five costs
 * them, and the more a figure costs the rarer it is.
 */
export const FIGURES = [
	{ id: "X", value: 1, weight: 5 },
	{ id: "F", value: 1, weight: 5 },
	{ id: "D", value: 1, weight: 5 },
	{ id: "R", value: 1, weight: 5 },
	{ id: "D2028", value: 3, weight: 4 },
	{ id: "A", value: -5, weight: 3 },
	{ id: "J", value: -10, weight: 2 },
	{ id: "B", value: -20, weight: 1 },
] as const satisfies readonly Figure[];

/** The tile state that shows figure `index`. */
export function figureState(index: number): number {
	return index + 1;
}

/** How long a key must be held before it counts as a long press. */
export const LONG_PRESS_MS = 500;

/** How long the "game over" screen stays up before the board accepts a new round. */
export const GAME_OVER_MS = 2500;

/** Settings persisted globally by the plugin. */
export type GameSettings = {
	/** Index into {@link DIFFICULTIES}. */
	difficulty: number;
	/** Index into {@link ROUND_LENGTHS}. */
	roundLength: number;
	/** Custom difficulty: shortest time a figure stays up, in milliseconds. */
	customMin: number;
	/** Custom difficulty: longest time a figure stays up, in milliseconds. */
	customMax: number;
	/** High scores, indexed by `[difficulty][roundLength]`. */
	highScores: number[][];
};

export const DEFAULT_SETTINGS: GameSettings = {
	difficulty: 1,
	roundLength: 1,
	customMin: 500,
	customMax: 1000,
	highScores: DIFFICULTIES.map(() => ROUND_LENGTHS.map(() => 0)),
};
