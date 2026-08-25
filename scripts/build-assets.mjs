/**
 * Renders every plugin asset into the .sdPlugin folder.
 *
 * Two kinds. The hoard, the HUD backdrops and the action icons are SVG straight
 * out of scripts/art.mjs, which Stream Deck accepts for key images and icons.
 * The figure tiles, the launcher key and the plugin icon are PNG, because they
 * composite a portrait bitmap over that artwork -- and the manifest schema
 * demands PNG at 256 and 512 px for the plugin icon in any case.
 *
 * It also checks the two hand-written files that mirror the roster, and refuses
 * to build when either has drifted.
 */

import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSET_PATHS, SVG_ASSETS, TILE_ASSETS } from "./assets.mjs";
import { FIGURE_DIR, FIGURE_IDS, FIGURES, TILE_STATE_IMAGES, formatValue } from "./roster.mjs";
import { renderFigureTile } from "./tiles.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "com.goldenbunker.whackadictator.sdPlugin");
const imgs = join(plugin, "imgs");

// The manifest is hand-written, so it is the one place the roster can drift out
// of step -- and a state list that no longer lines up puts the wrong face on
// every figure past the mismatch, which nothing catches until somebody plays.
const manifest = JSON.parse(await readFile(join(plugin, "manifest.json"), "utf8"));
const states = manifest.Actions.find(({ UUID }) => UUID.endsWith(".tile"))?.States;
const listed = states?.map(({ Image }) => Image).join(", ");
if (listed !== TILE_STATE_IMAGES.join(", ")) {
	throw new Error(
		`assets: the tile action's states do not match the roster in src/config.ts\n` +
			`  manifest: ${listed ?? "(no tile action)"}\n` +
			`  roster:   ${TILE_STATE_IMAGES.join(", ")}`,
	);
}

// The scoring legend in the settings panel is hand-written for the same reason
// and drifts the same way. A wrong number there is worse than a missing one: it
// teaches the player odds the game does not play by.
const panel = await readFile(join(plugin, "ui", "timer.html"), "utf8");
const shown = [...panel.matchAll(/imgs\/tiles\/([^"]+)\.png"[^>]*>\s*<span class="(gain|cost)">([^<]+)<\/span>/g)]
	.map(([, id, tone, value]) => `${id} ${value} (${tone})`)
	.join(", ");
const scoring = FIGURES.map(({ id, value }) => `${id} ${formatValue(value)} (${value < 0 ? "cost" : "gain"})`).join(", ");
if (shown !== scoring) {
	throw new Error(
		`assets: the scoring legend in ui/timer.html does not match the roster in src/config.ts\n` +
			`  panel:  ${shown || "(no legend)"}\n` +
			`  roster: ${scoring}`,
	);
}

/**
 * Creates a directory if it is missing.
 *
 * A recursive mkdir is meant to be idempotent, but on some filesystems an
 * existing folder still comes back as EEXIST or EPERM, and even a stat can
 * disagree about whether it is there. None of that matters: what counts is
 * whether the file write below succeeds, so a failure here is swallowed and
 * left for writeFile to report.
 */
async function ensureDir(path) {
	try {
		await mkdir(path, { recursive: true });
	} catch {
		// Intentionally ignored -- see above.
	}
}

// Every file is written unconditionally, so there is deliberately no recursive
// delete here: an interrupted one can leave the folder in a delete-pending state
// that never clears, and further builds then fail on mkdir. Renaming an asset
// therefore leaves the old file behind -- see SUPERSEDED below, or delete it by
// hand.
for (const [relative, draw] of Object.entries(SVG_ASSETS)) {
	const target = join(imgs, relative);
	await ensureDir(dirname(target));
	await writeFile(target, draw(), "utf8");
}

// The portraits are committed, so this normally passes. It exists for the case
// that does happen: a figure added to FIGURES, or renamed, without its file. The
// failure would otherwise be an unhandled ENOENT from deep inside sharp, which
// sends a newcomer looking for a bug that is not there.
const missing = [];
for (const id of FIGURE_IDS) {
	try {
		await access(join(FIGURE_DIR, `${id}.png`));
	} catch {
		missing.push(`${id}.png`);
	}
}

if (missing.length > 0) {
	throw new Error(
		`assets: ${missing.length} of ${FIGURE_IDS.length} portraits are missing from ${FIGURE_DIR}\n` +
			`  missing: ${missing.join(", ")}\n` +
			`  Each figure in the FIGURES table in src/config.ts needs a square <id>.png there,\n` +
			`  drawn on a flat blue field so the cut-out can key it out.\n` +
			`  See "Swapping the figures" in the README.`,
	);
}

for (const { path: relative, figure, size, rise, rounded } of TILE_ASSETS) {
	const target = join(imgs, relative);
	await ensureDir(dirname(target));
	await writeFile(target, await renderFigureTile(figure, size, { rise, rounded }));
}

// Names the plugin has used before and no longer writes. Stream Deck resolves
// manifest image names without an extension, so a leftover .svg would win over
// the .png that replaced it; the old target/capped/guard tiles would simply sit
// there unused. Either way, remove them rather than trust that they were cleaned
// up by hand -- but never remove a name the build is producing again.
const SUPERSEDED = [
	"tiles/target.svg",
	"tiles/capped.svg",
	"keys/launcher.svg",
	"tiles/target.png",
	"tiles/target@2x.png",
	"tiles/capped.png",
	"tiles/capped@2x.png",
	"tiles/guard.svg",
];

for (const stale of SUPERSEDED) {
	if (ASSET_PATHS.includes(stale)) continue;
	try {
		await rm(join(imgs, stale));
	} catch {
		// Already gone, which is the normal case.
	}
}

// The plugin writes a log into the very folder `npm run pack` zips, so a local
// test run would otherwise ride along inside the public release asset. It is
// cleared here because every pack is preceded by a build.
await rm(join(plugin, "logs"), { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });

// The licence travels with the plugin, not just with the repository: MIT requires
// the notice in "all copies or substantial portions of the Software", and the
// .streamDeckPlugin is how most people will get it. Copied at build time rather
// than kept as a second checked-in copy, so the two cannot drift apart.
await cp(join(root, "LICENSE"), join(plugin, "LICENSE"));

console.log(
	`assets: ${Object.keys(SVG_ASSETS).length} svg, ${TILE_ASSETS.length} png, 1 licence`,
);
