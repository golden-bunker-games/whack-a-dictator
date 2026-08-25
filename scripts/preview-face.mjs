/**
 * Renders every figure head-on and large, for judging the faces themselves.
 *
 * scripts/preview.mjs shows the whole contact sheet, which is the right view for
 * "does this read as a key". This one crops to the head at high resolution,
 * which is where framing problems show: whether the portrait sits too high or
 * too low in the hoard, and whether the cut-out left a blue fringe behind.
 *
 * Usage: node scripts/preview-face.mjs [output.png]
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { FIGURE_IDS } from "./roster.mjs";
import { renderFigureTile } from "./tiles.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2] ?? join(root, "preview-face.png");

// The figure occupies the upper middle of the 72-unit tile; crop to that.
const SCALE = 960;
const CROP = { left: 160, top: 0, width: 640, height: 680 };

const shots = await Promise.all(
	FIGURE_IDS.map(async (id) =>
		sharp(await renderFigureTile(id, SCALE))
			.extract(CROP)
			.png()
			.toBuffer(),
	),
);

await sharp({
	create: { width: CROP.width * shots.length, height: CROP.height, channels: 4, background: "#2b2b2b" },
})
	.composite(shots.map((input, i) => ({ input, left: i * CROP.width, top: 0 })))
	.png()
	.toFile(output);

console.log(`face: ${output}`);
