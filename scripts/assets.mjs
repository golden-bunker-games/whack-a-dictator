/**
 * The set of files that make up the plugin's artwork.
 *
 * Kept separate from the build so the deploy can copy them by name. Copying from
 * a known list rather than by directory enumeration holds up on filesystems where
 * an interrupted delete can leave a directory that refuses to be opened.
 */

import * as art from "./art.mjs";
import { FIGURE_IDS } from "./roster.mjs";

/** Assets written verbatim as SVG. */
export const SVG_ASSETS = {
	"tiles/idle.svg": art.tileIdle,
	"keys/idle.svg": art.keyIdle,
	"keys/active.svg": art.keyActive,
	"actions/category.svg": art.iconCategory,
	"actions/tile.svg": art.iconTile,
	"actions/start.svg": art.iconStart,
	"actions/timer.svg": art.iconTimer,
	"actions/score.svg": art.iconScore,
	"actions/launcher.svg": art.iconLauncher,
};

/**
 * The figure the plugin fronts with on the launcher key and the store icon.
 * Exported so the previews show the same one; hard-coding it in two places is
 * how a preview ends up rendering a figure the roster no longer has.
 */
export const FRONT_FIGURE = "D";

/**
 * One tile per figure, composited from the pixel art rather than drawn. They
 * ship as PNG at both key resolutions; the manifest names its images without an
 * extension, so Stream Deck picks these up with no change there -- but a
 * superseded .svg of the same name must not be left lying beside them, or it may
 * load that instead. build-assets.mjs clears the known ones.
 */
export const TILE_ASSETS = [
	...FIGURE_IDS.flatMap((id) => [
		{ path: `tiles/${id}.png`, figure: id, size: 144 },
		{ path: `tiles/${id}@2x.png`, figure: id, size: 288 },
	]),
	// The launcher shows the same figure half-sunk into the hoard, and the store
	// icon shows it head-on with the rounded corners the schema wants. Both used
	// to be drawn; leaving them vector would have put two different-looking
	// versions of the same character in one plugin.
	{ path: "keys/launcher.png", figure: FRONT_FIGURE, size: 144, rise: 0.85 },
	{ path: "keys/launcher@2x.png", figure: FRONT_FIGURE, size: 288, rise: 0.85 },
	{ path: "plugin/icon.png", figure: FRONT_FIGURE, size: 256, rounded: true },
	{ path: "plugin/icon@2x.png", figure: FRONT_FIGURE, size: 512, rounded: true },
];

/** Every artwork file, relative to the plugin's imgs folder. */
export const ASSET_PATHS = [...Object.keys(SVG_ASSETS), ...TILE_ASSETS.map(({ path }) => path)];
