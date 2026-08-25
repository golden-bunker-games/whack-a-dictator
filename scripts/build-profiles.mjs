/**
 * Generates the game board profiles shipped with the plugin.
 *
 * One `.streamDeckProfile` per supported device, each laying out the three HUD
 * keys plus as many game tiles as the device has room for. Identifiers are
 * derived from a hash of the profile and slot names, so a rebuild produces the
 * same archive and Stream Deck keeps recognising an already-installed profile.
 */

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TILE_STATE_IMAGES } from "./roster.mjs";
import { ATTR_ARCHIVE, ATTR_NORMAL, zip } from "./zip.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "com.goldenbunker.whackadictator.sdPlugin", "profiles");

const PLUGIN_UUID = "com.goldenbunker.whackadictator";
const PROFILE_NAME = "Whack-A-Dictator";

/** Title styling for the three HUD keys, mirroring the manifest. */
const HUD_STATE = {
	FontFamily: "Verdana",
	FontSize: 10,
	FontStyle: "Bold",
	FontUnderline: false,
	OutlineThickness: 2,
	ShowTitle: true,
	TitleAlignment: "middle",
	TitleColor: "#FFE9A0",
};

const ACTIONS = {
	start: { name: "Start", uuid: `${PLUGIN_UUID}.start`, states: [HUD_STATE, HUD_STATE] },
	timer: { name: "Difficulty / Timer", uuid: `${PLUGIN_UUID}.timer`, states: [HUD_STATE, HUD_STATE] },
	score: { name: "Score", uuid: `${PLUGIN_UUID}.score`, states: [HUD_STATE, HUD_STATE] },
	// A tile carries no title of its own, so its states are empty -- but there has
	// to be one per manifest state, or Stream Deck cannot address the later ones.
	tile: {
		name: "Game Tile",
		uuid: `${PLUGIN_UUID}.tile`,
		states: TILE_STATE_IMAGES.map(() => ({})),
	},
};

/**
 * Board layouts. `hud` places the three control keys; every remaining slot on
 * the device becomes a tile, except those listed in `skip`.
 *
 * Slots are addressed `"column,row"`, counting from the top left.
 */
const LAYOUTS = [
	{
		file: "StreamDeck",
		columns: 5,
		rows: 3,
		// 15-key: controls down the left edge, 12 tiles.
		hud: { start: "0,0", timer: "0,1", score: "0,2" },
		skip: [],
	},
	{
		file: "StreamDeckMini",
		columns: 3,
		rows: 2,
		// 6-key: controls across the top, 3 tiles. Tight, but playable.
		hud: { start: "0,0", timer: "1,0", score: "2,0" },
		skip: [],
	},
	{
		file: "StreamDeckXL",
		columns: 8,
		rows: 4,
		// 32-key: controls down the left edge, 28 tiles.
		hud: { start: "0,0", timer: "0,1", score: "0,2" },
		skip: ["0,3"],
	},
	{
		file: "StreamDeckPlus",
		columns: 4,
		rows: 2,
		// 8-key: controls across the top, 4 tiles on the bottom row.
		hud: { start: "0,0", timer: "1,0", score: "2,0" },
		skip: ["3,0"],
	},
	{
		file: "StreamDeckNeo",
		columns: 4,
		rows: 2,
		// Same key grid as the Stream Deck +; the info bar is not addressable.
		hud: { start: "0,0", timer: "1,0", score: "2,0" },
		skip: ["3,0"],
	},
];

/**
 * Derives a stable UUID from a seed. Stream Deck only needs these to be unique
 * and well-formed, and deriving them keeps the build reproducible.
 */
function stableUuid(seed) {
	const hex = createHash("sha256").update(`${PLUGIN_UUID}:${seed}`).digest("hex");
	// Stamp the version (4) and variant (8) nibbles so the value is a valid UUID.
	const parts = [hex.slice(0, 8), hex.slice(8, 12), `4${hex.slice(13, 16)}`, `8${hex.slice(17, 20)}`, hex.slice(20, 32)];
	return parts.join("-");
}

/**
 * Alphabet Stream Deck uses for page folder names: base32hex with "U" omitted,
 * the way Crockford drops it. Derived by decoding the folder names of profiles
 * shipped with Stream Deck 7.5 and verified against 14 known page ids.
 */
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTVW";

/**
 * Encodes a page id into its folder name.
 *
 * A page folder is *not* named after the page id verbatim -- it is that id's
 * 16 bytes in the base32 variant above, padded to 130 bits, with a trailing "Z".
 * Stream Deck decodes the folder name to match it against the `Pages` list, so a
 * folder named any other way leaves the profile with no pages at all. That
 * surfaces as `no pages in umbrella` / `preparation: content corrupted`, with
 * nothing to suggest the folder name is at fault.
 */
function pageFolderName(pageId) {
	const bytes = Buffer.from(pageId.replace(/-/g, ""), "hex");

	let bits = "";
	for (const byte of bytes) {
		bits += byte.toString(2).padStart(8, "0");
	}
	bits = bits.padEnd(130, "0"); // 128 bits -> 26 symbols of 5 bits

	let name = "";
	for (let i = 0; i < 130; i += 5) {
		name += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
	}
	return `${name}Z`;
}

/** Builds the `Actions` map for one layout. */
function buildActions(layout) {
	const placed = new Map(Object.entries(layout.hud).map(([role, slot]) => [slot, role]));
	const actions = {};

	for (let row = 0; row < layout.rows; row++) {
		for (let column = 0; column < layout.columns; column++) {
			const slot = `${column},${row}`;
			if (layout.skip.includes(slot)) continue;

			const role = placed.get(slot) ?? "tile";
			const definition = ACTIONS[role];

			actions[slot] = {
				ActionID: stableUuid(`${layout.file}:${slot}`),
				LinkedTitle: true,
				Name: definition.name,
				Settings: {},
				State: 0,
				States: definition.states,
				UUID: definition.uuid,
			};
		}
	}

	return actions;
}

/** Assembles one `.streamDeckProfile` archive. */
function buildProfile(layout) {
	const profileId = stableUuid(`profile:${layout.file}`).toUpperCase();
	const pageId = stableUuid(`page:${layout.file}`);
	const folder = `${profileId}.sdProfile`;
	const pageFolder = `${folder}/Profiles/${pageFolderName(pageId)}`;

	const manifest = JSON.stringify({
		Device: { Model: "VSD/WiFi", UUID: "" },
		Name: PROFILE_NAME,
		Pages: { Current: pageId, Default: pageId, Pages: [pageId] },
		Version: "2.0",
	});

	const page = JSON.stringify({
		Controllers: [{ Actions: buildActions(layout), Type: "Keypad" }],
		Icon: "",
		Name: "",
	});

	// Layout mirrors the profiles shipped with Stream Deck: an Images folder at
	// both levels, and a .bak copy of the profile manifest only.
	return zip([
		{ name: `${folder}/` },
		{ name: `${folder}/Images/` },
		{ name: `${folder}/manifest.json`, data: manifest, attrs: ATTR_NORMAL },
		{ name: `${folder}/manifest.json.bak`, data: manifest, attrs: ATTR_ARCHIVE },
		{ name: `${folder}/Profiles/` },
		{ name: `${pageFolder}/` },
		{ name: `${pageFolder}/Images/` },
		{ name: `${pageFolder}/manifest.json`, data: page, attrs: ATTR_ARCHIVE },
	]);
}

// See build-assets.mjs: a failed clear is not worth failing the build over.
try {
	await rm(outDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
} catch (error) {
	console.warn(`profiles: could not clear ${outDir} (${error.code}); overwriting in place`);
}
await mkdir(outDir, { recursive: true });

for (const layout of LAYOUTS) {
	const archive = buildProfile(layout);
	await writeFile(join(outDir, `${layout.file}.streamDeckProfile`), archive);

	const tiles = layout.columns * layout.rows - layout.skip.length - Object.keys(layout.hud).length;
	console.log(`profile: ${layout.file.padEnd(16)} ${tiles} tiles`);
}
