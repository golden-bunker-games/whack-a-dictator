import {
	action,
	SingletonAction,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { game } from "../game";

/**
 * Shows the running score during a round, and toggles between the last score and
 * the high score for the selected difficulty and round length while idle.
 */
@action({ UUID: "com.goldenbunker.whackadictator.score" })
export class ScoreAction extends SingletonAction {
	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		if (!ev.action.isKey()) return;

		game.scoreKeys.add(ev.action);
		await game.refreshScoreKeys(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		game.scoreKeys.delete(ev.action);
	}

	override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
		await game.toggleScoreView();
	}
}
