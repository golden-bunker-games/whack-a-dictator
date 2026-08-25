/**
 * Checks the state of the locally installed plugin.
 *
 * Run it after a test pass to see, without digging through folders, whether the
 * plugin is installed and connected, whether Stream Deck picked up the game
 * board profiles, and whether anything was logged as an error.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";

const PLUGIN_ID = "com.goldenbunker.whackadictator";
const FOLDER = `${PLUGIN_ID}.sdPlugin`;
const PROFILE_NAME = "Whack-A-Dictator";

/** Product ids of the Stream Deck models, read out of a device's identifier. */
const MODELS = {
	96: "Stream Deck",
	99: "Stream Deck Mini",
	108: "Stream Deck XL",
	109: "Stream Deck (v2)",
	128: "Stream Deck MK.2",
	132: "Stream Deck +",
	154: "Stream Deck Neo",
};

function roots() {
	if (platform() === "win32") {
		const base = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Elgato", "StreamDeck");
		return { plugins: join(base, "Plugins"), profiles: join(base, "ProfilesV3"), logs: join(base, "logs") };
	}

	const base = join(homedir(), "Library", "Application Support", "com.elgato.StreamDeck");
	return { plugins: join(base, "Plugins"), profiles: join(base, "ProfilesV3"), logs: join(base, "logs") };
}

const { plugins, profiles, logs } = roots();
const ok = (text) => console.log(`  OK    ${text}`);
const warn = (text) => console.log(`  WARN  ${text}`);
const info = (text) => console.log(`        ${text}`);

async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/** Reads every file matching a name, ignoring the ones that are unreadable. */
async function readJsonSafe(path) {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return null;
	}
}

console.log("\nInstallation");
const installed = join(plugins, FOLDER);
if (await exists(join(installed, "bin", "plugin.js"))) {
	ok(`installed at ${installed}`);
} else {
	warn(`not installed -- run \`npm run deploy\``);
}

console.log("\nPlugin log");
const logDir = join(installed, "logs");
if (await exists(logDir)) {
	for (const name of await readdir(logDir)) {
		const text = await readFile(join(logDir, name), "utf8");
		const lines = text.trim().split(/\r?\n/).filter(Boolean);
		const problems = lines.filter((line) => /\b(ERROR|WARN)\b/.test(line));

		ok(`${name}: ${lines.length} lines`);
		for (const line of lines.slice(-3)) info(line);
		if (problems.length > 0) {
			warn(`${problems.length} error/warning lines:`);
			for (const line of problems.slice(-5)) info(line);
		}
	}
} else {
	warn("no log yet -- the plugin has not started");
}

console.log("\nGame board profiles");
const found = [];
if (await exists(profiles)) {
	for (const entry of await readdir(profiles)) {
		const manifest = await readJsonSafe(join(profiles, entry, "manifest.json"));
		if (manifest?.Name !== PROFILE_NAME) continue;

		const productId = Number(/\[\d+\/(\d+)\//.exec(manifest.Device?.UUID ?? "")?.[1]);
		found.push(MODELS[productId] ?? `unknown device (${manifest.Device?.Model ?? "?"})`);
	}
}

if (found.length > 0) {
	ok(`imported for: ${found.sort().join(", ")}`);
} else {
	warn("not imported yet -- press the launcher key once on each device");
	info("Stream Deck only imports a plugin profile the first time it switches to it.");
}

console.log("\nApplication log");
if (await exists(logs)) {
	const names = (await readdir(logs)).filter((name) => name.endsWith(".log"));
	const hits = [];
	for (const name of names) {
		const text = await readFile(join(logs, name), "utf8").catch(() => "");
		for (const line of text.split(/\r?\n/)) {
			if (line.includes(PLUGIN_ID)) hits.push(line.trim());
		}
	}

	if (hits.length > 0) {
		for (const line of hits.slice(-6)) info(line);
	} else {
		warn("no mention of the plugin -- Stream Deck may not have loaded it");
	}
}

console.log();
