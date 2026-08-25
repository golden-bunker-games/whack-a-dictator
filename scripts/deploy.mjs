/**
 * Installs the built plugin into the local Stream Deck installation.
 *
 * The plugin folder is copied rather than symlinked: symlinks are not available
 * everywhere, and Stream Deck follows them inconsistently in any case.
 *
 * A running plugin holds its own folder open -- on Windows the node process that
 * hosts it keeps a handle on the directory, and the copy below then dies on
 * EBUSY before it has deleted anything. So the plugin is stopped first, through
 * Stream Deck's own CLI rather than by killing the application:
 *
 * - Stream Deck is commonly installed to run elevated. `taskkill` from an
 *   ordinary shell is then refused, and because a deploy has no reason to care
 *   about the exit code of a process it only wants gone, the failure is silent
 *   and shows up two steps later as EBUSY.
 * - Stopping one plugin leaves the application, and every other plugin, running.
 *
 * Stream Deck re-reads the plugin folder when it restarts a plugin, so a changed
 * manifest and changed profile archives are picked up without a restart of the
 * application.
 */

import { spawn } from "node:child_process";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSET_PATHS } from "./assets.mjs";

const PLUGIN_ID = "com.goldenbunker.whackadictator";
const FOLDER = `${PLUGIN_ID}.sdPlugin`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, FOLDER);

// Run the CLI's module with our own node rather than the .bin shim: the shim is
// a .cmd on Windows, which spawn can only reach through a shell, and that drags
// quoting rules into a path this script has no control over.
const CLI = join(root, "node_modules", "@elgato", "cli", "bin", "streamdeck.mjs");

/** Where Stream Deck keeps its plugins, per platform. */
function pluginsDir() {
	switch (platform()) {
		case "win32":
			return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Elgato", "StreamDeck", "Plugins");
		case "darwin":
			return join(homedir(), "Library", "Application Support", "com.elgato.StreamDeck", "Plugins");
		default:
			throw new Error(`Stream Deck does not run on ${platform()}.`);
	}
}

/** Runs the Stream Deck CLI. Resolves to whether it reported success. */
function cli(...args) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [CLI, ...args], { stdio: "ignore", shell: false });
		child.on("error", () => resolve(false));
		child.on("close", (code) => resolve(code === 0));
	});
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
	await access(join(source, "bin", "plugin.js"));
} catch {
	console.error("Nothing to deploy -- run `npm run build` first.");
	process.exit(1);
}

const destination = join(pluginsDir(), FOLDER);

console.log(`Stopping ${PLUGIN_ID}...`);
const stopped = await cli("stop", PLUGIN_ID);
if (!stopped) {
	console.log("  Stream Deck did not accept the stop; carrying on in case it is not running.");
}

// The CLI returns as soon as Stream Deck has taken the request; the plugin's own
// process takes a moment more to exit and let go of the folder. The delete below
// retries on top of this, so a slow release costs time rather than the deploy.
await sleep(1500);

console.log(`Copying to ${destination}`);
try {
	await rm(destination, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
} catch (error) {
	console.error(`Could not clear ${destination} (${error.code}).`);
	if (error.code === "EBUSY") {
		console.error("Something still holds the folder open -- close Stream Deck and try again.");
	}
	process.exit(1);
}

// The artwork is copied file by file from the known list rather than recursively:
// a directory can end up in a state where it cannot be opened for enumeration
// even though the files inside read back fine.
for (const relative of ASSET_PATHS) {
	const target = join(destination, "imgs", relative);
	await mkdir(dirname(target), { recursive: true });
	await cp(join(source, "imgs", relative), target);
}

for (const folder of ["bin", "profiles", "ui"]) {
	await cp(join(source, folder), join(destination, folder), { recursive: true });
}
for (const file of ["manifest.json", "THIRD-PARTY-NOTICES.md", "LICENSE"]) {
	await cp(join(source, file), join(destination, file));
}

console.log(`Starting ${PLUGIN_ID}...`);
if (await cli("restart", PLUGIN_ID)) {
	console.log("Deployed.");
} else {
	console.log("Deployed, but Stream Deck did not accept the restart -- start it and the plugin loads with it.");
}
