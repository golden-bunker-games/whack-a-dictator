import streamDeck from "@elgato/streamdeck";

import { LauncherAction } from "./actions/launcher";
import { ScoreAction } from "./actions/score";
import { StartAction } from "./actions/start";
import { TileAction } from "./actions/tile";
import { TimerAction } from "./actions/timer";
import type { GameSettings } from "./config";
import { game } from "./game";

streamDeck.actions.registerAction(new LauncherAction());
streamDeck.actions.registerAction(new StartAction());
streamDeck.actions.registerAction(new TimerAction());
streamDeck.actions.registerAction(new ScoreAction());
streamDeck.actions.registerAction(new TileAction());

// Fires both on the initial load and whenever the property inspector saves.
streamDeck.settings.onDidReceiveGlobalSettings<Partial<GameSettings>>((ev) => game.apply(ev.settings));

// Anything thrown outside an event handler would otherwise kill the plugin
// silently; logging it leaves a trace in logs/ to work from.
process.on("unhandledRejection", (reason) => streamDeck.logger.error("Unhandled rejection", reason));
process.on("uncaughtException", (error) => streamDeck.logger.error("Uncaught exception", error));

await streamDeck.connect();
await game.load();

// A single line confirming the plugin came up, and on what.
const devices = [...streamDeck.devices].map((device) => `${device.name} (type ${device.type})`);
streamDeck.logger.info(`Whack-A-Dictator ready; devices: ${devices.join(", ") || "none"}`);
