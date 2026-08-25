import streamDeck, {
	action,
	SingletonAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { game } from "../game";
import { PressTracker } from "../press";

/**
 * Starts a round. Holding the key does double duty: it aborts a running round,
 * and from an idle board it returns to whatever profile the player came from.
 */
@action({ UUID: "com.goldenbunker.whackadictator.start" })
export class StartAction extends SingletonAction {
	readonly #press = new PressTracker(
		() => game.start(),
		(id) => this.#hold(id),
	);

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		if (!ev.action.isKey()) return;

		game.startKeys.add(ev.action);
		await game.refreshStartKeys(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		game.startKeys.delete(ev.action);
		this.#press.cancel(ev.action.id);
	}

	override onKeyDown(ev: KeyDownEvent): void {
		this.#press.down(ev.action.id);
	}

	override onKeyUp(ev: KeyUpEvent): void {
		this.#press.up(ev.action.id);
	}

	async #hold(id: string): Promise<void> {
		if (game.isPlaying) {
			await game.end();
			return;
		}

		const key = game.startKeys.get(id);
		if (game.isReady && key !== undefined) {
			// Omitting the profile name returns the device to its previous profile.
			await streamDeck.profiles.switchToProfile(key.device.id);
		}
	}
}
