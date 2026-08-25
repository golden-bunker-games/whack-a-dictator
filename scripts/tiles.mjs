/**
 * Builds the figure tiles by compositing the hand-drawn pixel art into the
 * vector hoard.
 *
 * The rest of the artwork is generated SVG, but the figures are bitmaps, so the
 * tile cannot be one document: the backdrop is rasterised, the cut-out figure is
 * laid over it, and the front row of coins goes on top so the figure reads as
 * rising out of the pile.
 */

import sharp from "sharp";

import { iconBackdrop, tileBackdrop, tileForeground } from "./art.mjs";
import { cutout } from "./figures.mjs";

/** The tile is authored in a 72-unit square, like every other asset. */
const UNITS = 72;

/**
 * Where the figure sits, in those units. The art is sized so the chin lands at
 * roughly y=46 -- the same place the vector bust put it -- which leaves the
 * shoulders to disappear behind the coins instead of ending in mid-air. Every
 * portrait is framed the same way, so one set of numbers serves them all.
 */
const FIGURE = { width: 68, top: 0 };

/** How far a figure sinks into the hoard at rise=0, matching the vector bust. */
const SINK = 17;

/** Clips a square render to the rounded corners the plugin icon needs. */
const ROUNDED_MASK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="14" fill="#fff"/></svg>`;

/**
 * Renders one figure tile.
 *
 * @param id Figure id, naming a `<id>.png` in the figures folder.
 * @param size Output edge length in pixels.
 * @param opts.rise 0..1, how far the figure clears the hoard (default 1).
 * @param opts.rounded Clip to rounded corners, for the plugin icon.
 * @returns PNG buffer.
 */
export async function renderFigureTile(id, size, opts = {}) {
	const { rise = 1, rounded = false } = opts;

	const scale = size / UNITS;
	const figureWidth = Math.round(FIGURE.width * scale);

	const figure = await cutout(`${id}.png`);
	const top = Math.round((FIGURE.top + (1 - rise) * SINK) * scale);
	let scaled = await sharp(figure.buffer).resize({ width: figureWidth }).png().toBuffer();

	// sharp refuses to composite anything larger than the canvas, so a figure
	// that would hang off the bottom edge is trimmed to what actually shows.
	const { height } = await sharp(scaled).metadata();
	if (top + height > size) {
		scaled = await sharp(scaled)
			.extract({ left: 0, top: 0, width: figureWidth, height: size - top })
			.png()
			.toBuffer();
	}

	const render = (svg) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

	const composed = await sharp(await render(rounded ? iconBackdrop() : tileBackdrop()))
		.composite([
			{ input: scaled, left: Math.round((size - figureWidth) / 2), top },
			{ input: await render(tileForeground()) },
		])
		.png()
		.toBuffer();

	if (!rounded) return sharp(composed).png({ compressionLevel: 9 }).toBuffer();

	return sharp(composed)
		.composite([{ input: await render(ROUNDED_MASK), blend: "dest-in" }])
		.png({ compressionLevel: 9 })
		.toBuffer();
}
