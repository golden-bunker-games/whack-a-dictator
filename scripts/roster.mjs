/**
 * The figure roster, lifted out of src/config.ts.
 *
 * The table belongs in the plugin source -- that is where the values and the
 * odds are used -- but the build needs the same ids, in the same order, to name
 * the tile artwork and line it up with the manifest's states. Rather than keep a
 * second copy in step by hand, the entries are read back out of that file.
 *
 * The parser is deliberately strict: one entry per line, `id` / `value` /
 * `weight` in that order. A table it cannot read stops the build instead of
 * producing artwork in the wrong order, which would show the wrong face for
 * every figure past the mismatch and only surface when somebody plays.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Where the source portraits live: one `<id>.png` per figure. */
export const FIGURE_DIR = join(root, "portraits");

const CONFIG = join(root, "src", "config.ts");
const ENTRY = /^\s*\{\s*id:\s*"([^"]+)"\s*,\s*value:\s*(-?\d+)\s*,\s*weight:\s*(\d+)\s*\}\s*,?\s*$/;

const source = await readFile(CONFIG, "utf8");
const table = /export const FIGURES\s*=\s*\[([\s\S]*?)\n\]/.exec(source);
if (table === null) throw new Error(`roster: no FIGURES table in ${CONFIG}`);

/** Every figure, in tile state order. */
export const FIGURES = table[1]
	.split("\n")
	.filter((line) => line.trim() !== "" && !line.trim().startsWith("//"))
	.map((line) => {
		const entry = ENTRY.exec(line);
		if (entry === null) throw new Error(`roster: cannot read this FIGURES line in ${CONFIG}:\n  ${line.trim()}`);
		return { id: entry[1], value: Number(entry[2]), weight: Number(entry[3]) };
	});

if (FIGURES.length === 0) throw new Error(`roster: the FIGURES table in ${CONFIG} is empty`);

/** Figure ids alone. State 0 is the empty hoard, so `FIGURE_IDS[i]` is state `i + 1`. */
export const FIGURE_IDS = FIGURES.map(({ id }) => id);

/** Images the tile action's states must name, in order. */
export const TILE_STATE_IMAGES = ["imgs/tiles/idle", ...FIGURE_IDS.map((id) => `imgs/tiles/${id}`)];

/** Signed value, the way it is written on a preview or in the settings panel. */
export const formatValue = (value) => (value < 0 ? `${value}` : `+${value}`);
