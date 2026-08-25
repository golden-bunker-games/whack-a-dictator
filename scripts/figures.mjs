/**
 * Cuts the figures out of their backing colour.
 *
 * The portraits arrive as square PNGs on a flat blue field. The suits are
 * themselves dark blue, so a plain colour-distance test would eat into
 * them; instead the background is flood-filled inwards from the edges, which only
 * removes blue that is actually connected to the border. Anything enclosed by
 * the figure -- the flag pin, the shadows between strands -- survives. Shoulders
 * that run off the bottom edge are dark rather than blue, so they hold the fill
 * at the border and stay part of the cut-out.
 *
 * The result is cropped to the figure's bounding box so callers can position it
 * by its real extent rather than by the whitespace around it.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import { FIGURE_DIR } from "./roster.mjs";

/** True where a pixel is the blue backing field rather than part of the figure. */
function isBacking(r, g, b) {
	return b > 90 && b - r > 55 && b - g > 35;
}

/**
 * Loads one figure and returns it as a cropped, transparent-background PNG.
 *
 * @param name File name inside portraits/.
 * @returns {{buffer: Buffer, width: number, height: number}}
 */
export async function cutout(name) {
	const source = await readFile(join(FIGURE_DIR, name));
	const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const { width, height, channels } = info;

	// Flood fill from every border pixel; a stack beats recursion at this size.
	const cleared = new Uint8Array(width * height);
	const stack = [];
	for (let x = 0; x < width; x++) {
		stack.push(x, x + (height - 1) * width);
	}
	for (let y = 0; y < height; y++) {
		stack.push(y * width, width - 1 + y * width);
	}

	while (stack.length) {
		const p = stack.pop();
		if (cleared[p]) continue;
		const i = p * channels;
		if (!isBacking(data[i], data[i + 1], data[i + 2])) continue;
		cleared[p] = 1;
		const x = p % width;
		const y = (p - x) / width;
		if (x > 0) stack.push(p - 1);
		if (x < width - 1) stack.push(p + 1);
		if (y > 0) stack.push(p - width);
		if (y < height - 1) stack.push(p + width);
	}

	// Punch the alpha and find what is left.
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	for (let p = 0; p < width * height; p++) {
		if (cleared[p]) {
			data[p * channels + 3] = 0;
			continue;
		}
		if (data[p * channels + 3] === 0) continue;
		const x = p % width;
		const y = (p - x) / width;
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}

	const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
	const buffer = await sharp(data, { raw: { width, height, channels } }).extract(box).png().toBuffer();
	return { buffer, width: box.width, height: box.height };
}
