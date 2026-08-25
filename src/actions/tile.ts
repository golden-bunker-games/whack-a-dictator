import {
	action,
	SingletonAction,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { TILE_IDLE } from "../config";
import { game } from "../game";

/**
 * A single square of the game board.
 *
 * Tiles react on key *down* rather than key up -- in a reaction game the few dozen
 * milliseconds until the release are the difference between a hit and a miss.
 */
@action({ UUID: "com.goldenbunker.whackadictator.tile" })
export class TileAction extends SingletonAction {
	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		if (!ev.action.isKey()) return;

		game.tiles.add(ev.action);
		await ev.action.setState(TILE_IDLE);
	}

	override async onWillDisappear(ev: WillDisappearEvent): Promise<void> {
		game.tiles.delete(ev.action);

		// The player navigated away from the board; nothing left to whack.
		if (game.isPlaying && game.tiles.size === 0) {
			await game.end();
		}
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await game.whack(ev.action);
	}
}
