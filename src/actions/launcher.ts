import streamDeck, { action, DeviceType, SingletonAction, type KeyDownEvent } from "@elgato/streamdeck";

/**
 * Profiles shipped with the plugin, by the device they are laid out for. Keep in
 * step with the `Profiles` array in the manifest.
 */
const PROFILES: Partial<Record<DeviceType, string>> = {
	[DeviceType.StreamDeck]: "profiles/StreamDeck",
	[DeviceType.StreamDeckMini]: "profiles/StreamDeckMini",
	[DeviceType.StreamDeckXL]: "profiles/StreamDeckXL",
	[DeviceType.StreamDeckPlus]: "profiles/StreamDeckPlus",
	[DeviceType.StreamDeckNeo]: "profiles/StreamDeckNeo",
};

/** How long the "unsupported device" notice stays on the key. */
const NOTICE_MS = 2000;

/**
 * The only action a player places by hand. Pressing it swaps the device over to
 * the game board; holding Start on the board swaps back.
 */
@action({ UUID: "com.goldenbunker.whackadictator.launcher" })
export class LauncherAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const profile = PROFILES[ev.action.device.type];
		if (profile === undefined) {
			await ev.action.setTitle("DEVICE\nNOT\nSUPPORTED");
			setTimeout(() => void ev.action.setTitle(""), NOTICE_MS);
			return;
		}

		await streamDeck.profiles.switchToProfile(ev.action.device.id, profile);
	}
}
