import {
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
 * Shows the difficulty and the clock. Press to cycle the round length, hold to
 * cycle the difficulty; both are ignored while a round is running.
 */
@action({ UUID: "com.goldenbunker.whackadictator.timer" })
export class TimerAction extends SingletonAction {
	readonly #press = new PressTracker(
		() => game.nextRoundLength(),
		() => game.nextDifficulty(),
	);

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		if (!ev.action.isKey()) return;

		game.timerKeys.add(ev.action);
		await game.refreshTimerKeys(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		game.timerKeys.delete(ev.action);
		this.#press.cancel(ev.action.id);
	}

	override onKeyDown(ev: KeyDownEvent): void {
		this.#press.down(ev.action.id);
	}

	override onKeyUp(ev: KeyUpEvent): void {
		this.#press.up(ev.action.id);
	}
}
