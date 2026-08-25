import { LONG_PRESS_MS } from "./config";

/**
 * Splits key presses into short and long.
 *
 * Stream Deck reports key down and key up separately, so the distinction is made
 * here: the long press fires while the key is still held, which gives the player
 * immediate feedback instead of waiting for the release.
 */
export class PressTracker {
	readonly #pending = new Map<string, NodeJS.Timeout>();

	/**
	 * Both callbacks receive the id of the action that was pressed, so a plugin
	 * running on several devices can tell the keys apart.
	 * @param onShort Invoked when the key is released before the long-press threshold.
	 * @param onLong Invoked once the key has been held for {@link LONG_PRESS_MS}.
	 */
	constructor(
		private readonly onShort: (id: string) => void | Promise<void>,
		private readonly onLong: (id: string) => void | Promise<void>,
	) {}

	/** Call from `onKeyDown`. */
	down(id: string): void {
		this.cancel(id);
		this.#pending.set(
			id,
			setTimeout(() => {
				this.#pending.delete(id);
				void this.onLong(id);
			}, LONG_PRESS_MS),
		);
	}

	/** Call from `onKeyUp`. */
	up(id: string): void {
		if (!this.#pending.has(id)) return; // the long press already fired

		this.cancel(id);
		void this.onShort(id);
	}

	/** Drops any timer for a key, e.g. when it disappears mid-press. */
	cancel(id: string): void {
		const timer = this.#pending.get(id);
		if (timer !== undefined) {
			clearTimeout(timer);
			this.#pending.delete(id);
		}
	}
}
