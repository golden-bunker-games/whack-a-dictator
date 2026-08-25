/**
 * Renders a contact sheet of the key artwork for eyeballing a change.
 *
 * Draws straight from scripts/art.mjs rather than from the built files, so the
 * artwork can be iterated on without running a full build.
 *
 * Each asset is shown large enough to judge the drawing and again at the actual
 * 72 px key size, which is the only size that really matters.
 *
 * Usage: node scripts/preview.mjs [output.png]
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import * as art from "./art.mjs";
import { FIGURES, formatValue } from "./roster.mjs";
import { renderFigureTile } from "./tiles.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.argv[2] ?? join(root, "preview.png");

// The figure tiles are composited bitmaps, the rest is SVG, so each asset is
// carried here as a ready-made PNG buffer at the largest size it is shown at.
const BIG = 240;
const KEY = 72;
const PAD = 12;
const LABEL = 22;

const raster = (svg) => sharp(Buffer.from(svg)).resize(BIG, BIG).png().toBuffer();

const ASSETS = [
	{ png: await raster(art.tileIdle()), label: "idle" },
	...(await Promise.all(
		FIGURES.map(async ({ id, value }) => ({
			png: await renderFigureTile(id, BIG),
			label: `${id} ${formatValue(value)}`,
		})),
	)),
	{ png: await renderFigureTile("D", BIG, { rise: 0.85 }), label: "launcher" },
];

const composites = [];
let x = PAD;

for (const { png } of ASSETS) {
	composites.push({ input: png, left: x, top: PAD });
	composites.push({
		input: await sharp(png).resize(KEY, KEY).png().toBuffer(),
		left: x + (BIG - KEY) / 2,
		top: PAD + BIG + PAD,
	});
	x += BIG + PAD;
}

const width = x;
const height = PAD + BIG + PAD + KEY + PAD + LABEL;

const labels = ASSETS.map(
	({ label }, i) =>
		`<text x="${PAD + i * (BIG + PAD) + BIG / 2}" y="${height - 8}" fill="#999" font-family="sans-serif" ` +
		`font-size="14" text-anchor="middle">${label}</text>`,
).join("");

composites.push({
	input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${labels}</svg>`),
	left: 0,
	top: 0,
});

await sharp({ create: { width, height, channels: 4, background: "#2b2b2b" } })
	.composite(composites)
	.png()
	.toFile(output);

console.log(`preview: ${output}`);
