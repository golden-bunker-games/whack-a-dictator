/**
 * Procedural artwork for Whack-A-Dictator.
 *
 * This file draws the coin hoard, the HUD backdrops and the action icons. The
 * figure tiles are not drawn here: they composite a supplied portrait bitmap over
 * the hoard rendered below -- see scripts/tiles.mjs. Output is deterministic: the
 * coin scatter uses a seeded PRNG, therefore repeated builds produce
 * byte-identical SVGs.
 *
 * Key canvas is 72 x 72, matching the Stream Deck key resolution.
 */

const PALETTE = {
	voidTop: "#191308",
	voidBottom: "#050403",
	goldLight: "#FFE9A0",
	goldMid: "#F2C33C",
	goldDark: "#B07C0C",
	goldEdge: "#7C5406",
	goldDeep: "#4A3204",
	skin: "#E89A57",
	skinShade: "#C87A40",
	// Near-white blond, not gold: in the photographs the whole face works on the
	// contrast between very pale hair and a heavy tan, and against the coins a
	// saturated yellow would sink into the hoard.
	hair: "#F2E6C2",
	hairLight: "#FDF7E6",
	hairShade: "#CFBC92",
	suit: "#1E2A47",
	suitDark: "#131C31",
	shirt: "#EEF1F6",
	tie: "#CC2A2A",
	tieLight: "#E5453F",
	guardSuit: "#22242B",
	guardSkin: "#C98F63",
	shades: "#0B0C10",
	cap: "#D3202A",
	capLight: "#E8434A",
	capDark: "#96141C",
};

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Deterministic PRNG so the coin scatter never changes between builds. */
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * Builds one coin. Coins are drawn as a rim (thickness), a face, an inner ring
 * and a specular highlight -- enough detail to read as gold at 72 px.
 */
function coin(x, y, scale, tilt) {
	const t = `translate(${round(x)} ${round(y)}) rotate(${round(tilt)}) scale(${round(scale)})`;
	return (
		`<g transform="${t}">` +
		`<ellipse cy="1.7" rx="7" ry="4.9" fill="${PALETTE.goldEdge}"/>` +
		`<ellipse rx="7" ry="4.9" fill="url(#coinFace)"/>` +
		`<ellipse rx="4.5" ry="3" fill="none" stroke="${PALETTE.goldDark}" stroke-width=".65"/>` +
		`<ellipse cx="-2.1" cy="-1.5" rx="2.5" ry="1.3" fill="${PALETTE.goldLight}" opacity=".5"/>` +
		`</g>`
	);
}

/**
 * Skyline of the hoard: two flanking peaks with a dip in the middle. The dip is
 * what the figure surfaces from, and it keeps the bust clear of the coins.
 */
const RIDGE = [
	{ x: -6, y: 63 },
	{ x: 8, y: 53 },
	{ x: 20, y: 48 },
	{ x: 28, y: 52 },
	{ x: 36, y: 55 },
	{ x: 44, y: 52 },
	{ x: 52, y: 48 },
	{ x: 64, y: 53 },
	{ x: 78, y: 63 },
];

/** Height of the hoard at a given x, linearly interpolated along the ridge. */
function ridgeAt(x) {
	if (x <= RIDGE[0].x) return RIDGE[0].y;
	for (let i = 1; i < RIDGE.length; i++) {
		const a = RIDGE[i - 1];
		const b = RIDGE[i];
		if (x <= b.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
	}
	return RIDGE[RIDGE.length - 1].y;
}

/** Scatters coins along the ridge, offset into the hoard by `depth`. */
function coinField(seed, count, opts) {
	const rnd = mulberry32(seed);
	const out = [];
	for (let i = 0; i < count; i++) {
		const x = -4 + rnd() * 80;
		const y = (opts.flat ?? ridgeAt(x)) + opts.depth0 + rnd() * (opts.depth1 - opts.depth0);
		const scale = opts.minScale + rnd() * (opts.maxScale - opts.minScale);
		const tilt = -28 + rnd() * 56;
		out.push({ x, y, scale, tilt });
	}
	// Painter's algorithm: coins lower on the key are nearer the viewer.
	out.sort((a, b) => a.y - b.y);
	return out.map((c) => coin(c.x, c.y, c.scale, c.tilt)).join("");
}

/* -------------------------------------------------------------------------- */
/* shared layers                                                               */
/* -------------------------------------------------------------------------- */

function defs() {
	return (
		`<defs>` +
		`<radialGradient id="vault" cx="50%" cy="34%" r="78%">` +
		`<stop offset="0" stop-color="${PALETTE.voidTop}"/>` +
		`<stop offset="1" stop-color="${PALETTE.voidBottom}"/>` +
		`</radialGradient>` +
		`<linearGradient id="coinFace" x1="0" y1="-5" x2="0" y2="5" gradientUnits="userSpaceOnUse">` +
		`<stop offset="0" stop-color="${PALETTE.goldLight}"/>` +
		`<stop offset=".55" stop-color="${PALETTE.goldMid}"/>` +
		`<stop offset="1" stop-color="${PALETTE.goldDark}"/>` +
		`</linearGradient>` +
		`<linearGradient id="pileBody" x1="0" y1="40" x2="0" y2="72" gradientUnits="userSpaceOnUse">` +
		`<stop offset="0" stop-color="${PALETTE.goldDark}"/>` +
		`<stop offset="1" stop-color="${PALETTE.goldDeep}"/>` +
		`</linearGradient>` +
		`<radialGradient id="pit" cx="50%" cy="45%" r="60%">` +
		`<stop offset="0" stop-color="#0B0903"/>` +
		`<stop offset="1" stop-color="${PALETTE.goldDeep}"/>` +
		`</radialGradient>` +
		`<linearGradient id="glow" x1="0" y1="0" x2="0" y2="34" gradientUnits="userSpaceOnUse">` +
		`<stop offset="0" stop-color="${PALETTE.goldMid}" stop-opacity=".22"/>` +
		`<stop offset="1" stop-color="${PALETTE.goldMid}" stop-opacity="0"/>` +
		`</linearGradient>` +
		`</defs>`
	);
}

const background = () =>
	`<rect width="72" height="72" fill="url(#vault)"/>` + `<rect width="72" height="34" fill="url(#glow)"/>`;

/** Silhouette of the hoard, drawn behind everything so no gaps show through. */
const pileBody = () =>
	`<path d="M-6 72V63L8 53 20 48 28 52 36 55 44 52 52 48 64 53 78 63V72Z" fill="url(#pileBody)"/>`;

/** Coins behind the figure. */
const pileBack = () => coinField(0x5eed01, 15, { depth0: -2, depth1: 6, minScale: 0.6, maxScale: 0.9 });

/** Coins in front of the figure -- this overlap sells the "rising out of it" effect. */
const pileFront = () => coinField(0x5eed02, 18, { depth0: 8, depth1: 22, minScale: 0.8, maxScale: 1.15 });

/** Dark hollow in the hoard where the figure surfaces from. */
const pit = () =>
	`<ellipse cx="36" cy="57.5" rx="12" ry="5.2" fill="url(#pit)"/>` +
	`<ellipse cx="36" cy="56.3" rx="12" ry="5.2" fill="none" stroke="${PALETTE.goldMid}" stroke-width=".8" opacity=".5"/>`;

/* -------------------------------------------------------------------------- */
/* figures                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Caricature bust. Deliberately a drawing, not a likeness -- built from
 * exaggerated features (piled-up hair, heavy jowls, pursed mouth, over-long tie)
 * the way a newspaper cartoonist would, with nothing traced from a photograph.
 *
 * @param rise 0..1 -- how far the bust clears the hoard.
 * @param opts.cap Adds the red campaign cap worn by the double-value variant.
 */
function bust(rise, opts = {}) {
	const dy = round((1 - rise) * 17);
	const { cap = false } = opts;

	const skin = PALETTE.skin;
	const shade = PALETTE.skinShade;
	const ink = "#2A1A10";
	const { hair, hairLight, hairShade } = PALETTE;

	// Collar and shirt start below the jaw, so nothing appears to emerge from
	// behind the head; the neck runs into the collar rather than being cut off.
	const shoulders =
		`<path d="M12 64c1.5-11 8.5-16.5 24-16.5S58.5 53 60 64z" fill="${PALETTE.suit}"/>` +
		`<path d="M29.4 51.4 36 58.4l6.6-7 2.8 2-9.4 11.4-9.4-11.4z" fill="${PALETTE.shirt}"/>` +
		// the famously over-long tie
		`<path d="M36 56.8l3.4 3.2-1.5 12h-3.8l-1.5-12z" fill="${PALETTE.tie}"/>` +
		`<path d="M36 56.8l3.4 3.2-1 3.4-2.4-2.2z" fill="${PALETTE.tieLight}"/>`;

	// The hair, following the reference photograph: near-white blond, swept back
	// off a high hairline, with the bulk carried out over the ears rather than
	// piled on the crown. In front it breaks into a low wave that dips towards
	// the left temple -- that wave, plus the receding corners either side of it,
	// is what stops the shape reading as a wig.
	//
	// It is ONE closed outline -- crown, temples and hairline together. Built as
	// separate tufts it left scalp showing through, which read as a bald head
	// with hair hovering above it. The hairline must also stay *below* the skull
	// outline at every x, or a gap of background opens between head and hair.
	const hairMass =
		// Wind out of the right: everything streams to the left. The strands are
		// drawn first so the mass covers where they root and only the flying ends
		// show -- that way no gap can open between a strand and the head, however
		// far it reaches. Nothing flies to the right; on the windward side the
		// hair is pressed flat against the skull.
		`<path d="M22 7.4C18 7.4 14.6 8.8 11.6 11.4 15 10.4 18.4 10.4 21.2 11.2Z" fill="${hair}"/>` +
		`<path d="M20 12.6C15.8 13 12 15 9.2 18.2 13 16.2 16.6 15.2 19.6 15.4Z" fill="${hair}"/>` +
		`<path d="M19 18.4C14.8 19.6 11.2 22 8.6 25.2 12.6 22.8 16 21.4 19 21Z" fill="${hair}"/>` +
		`<path d="M20 24C16.2 25.6 13 28 10.6 31.2 14.2 28.6 17.4 27 20.2 26.6Z" fill="${hair}"/>` +
		`<g fill="${hairShade}" opacity=".45">` +
		`<path d="M11.6 11.4C15 10.4 18.4 10.4 21.2 11.2 17.9 11.1 14.7 11.2 11.6 11.4Z"/>` +
		`<path d="M9.2 18.2C13 16.2 16.6 15.2 19.6 15.4 16 15.9 12.5 16.9 9.2 18.2Z"/>` +
		`<path d="M8.6 25.2C12.6 22.8 16 21.4 19 21 15.5 22 12 23.4 8.6 25.2Z"/>` +
		`<path d="M10.6 31.2C14.2 28.6 17.4 27 20.2 26.6 16.9 27.9 13.7 29.4 10.6 31.2Z"/>` +
		`</g>` +
		// The whole mass goes with the wind, not just the loose ends: its bulk is
		// carried out past the left temple, the crest is thrown over to the left
		// of centre, and on the right it lies raked down against the skull. The
		// hairline drops on the left and rides up on the right for the same
		// reason. Drawn upright it reads as a wig sitting still, however hard the
		// individual strands fly.
		`<path d="M14.6 26C12.8 20.8 13.8 12.8 17.6 8.2 20.2 4.8 23.2 2.2 26.8 1.2 30.6 .2 34.6 1 37.8 2.6 42 3.6 45.8 5.4 48.4 8.2 51.2 11.2 52 16.8 50.8 22.4 50.2 22.8 49.6 23.2 49 23.4 48.8 20.8 48.6 18.8 48.4 17.6 47.8 16 46.8 15.2 45.2 15.2 42.2 15 38.6 15.6 35.2 16.8 32.2 17.8 29.2 18.2 26.4 19.6 24.2 20.8 23 22.4 21.6 24.4 19.2 24.6 16.8 25.2 14.6 26Z" fill="${hair}"/>` +
		// The front wave: a shadow band under the strand that falls left, so the
		// hairline is a rolled-over lock rather than a drawn-on edge.
		`<path d="M45.2 15.2C42.2 15 38.6 15.6 35.2 16.8 32.2 17.8 29.2 18.2 26.4 19.6 29.8 20.8 32.8 20.4 35.8 18.6 38.8 16.8 42 15.4 45.2 15.2Z" fill="${hairShade}" opacity=".45"/>` +
		// The parting, high on the right where the sweep starts.
		`<path d="M45.8 8.2c1.8 2.8 2.8 5.6 3 8.6" fill="none" stroke="${hairShade}" stroke-width=".9" opacity=".5" stroke-linecap="round"/>` +
		// Strand lines raked down and left by the wind, staggered and stopped short
		// of each other. Carried right across they turn into concentric rings and
		// the head reads as a swim cap.
		`<g stroke="${hairShade}" stroke-width=".55" fill="none" opacity=".42" stroke-linecap="round">` +
		`<path d="M44 8.6C38.6 9.6 33.2 11.2 28 13.6"/>` +
		`<path d="M25 15.4C21.8 17 19.2 19 17.4 21.4"/>` +
		`<path d="M45 12.6C39.8 14 34.8 16 30 18.6"/>` +
		`<path d="M41.4 5.2C36 6 30.6 7.6 25.4 10"/>` +
		`<path d="M22.4 11.8C19.6 13.6 17.4 15.8 16 18.4"/>` +
		`</g>` +
		// highlight along the crest of the sweep
		`<path d="M42.6 5.6C37.2 6.4 31.6 8 26 10.6 31.4 7.8 37 6.2 42.6 5.6Z" fill="${hairLight}" opacity=".85"/>` +
		// where the mass turns under towards the ears
		`<path d="M50.6 22.4c-.6.6-1.2 1-1.8 1 .6-.2 1.2-.6 1.8-1z" fill="${hairShade}" opacity=".5"/>` +
		`<path d="M14.6 26c1-.4 2.2-.8 3.4-1-1.4.4-2.6.7-3.4 1z" fill="${hairShade}" opacity=".5"/>`;

	// Red campaign cap for the double-value variant, worn low over the brow with
	// the hair winging out beneath it.
	// Worn high enough to leave the scowl visible -- the brows are the face's main
	// identifying feature and the cap must not swallow them.
	const capMass =
		// Hair first, so the cap sits on top of it: solid masses pushed out over
		// the temples and ears, with the same strands blowing out sideways as the
		// bare-headed version. Drawn as thin slivers they left the sides of the
		// head bare and the hair looked stuck on.
		`<path d="M20.8 16.4C16.4 17.2 12.6 19.4 9.8 23.2 14 20.8 17.7 19.6 20.8 19.6Z" fill="${hair}"/>` +
		`<path d="M20.6 22C16.6 23.4 13.2 26 10.6 29.8 14.6 26.8 18 25.1 20.8 24.8Z" fill="${hair}"/>` +
		`<path d="M19.6 28C16.2 29.8 13.4 32.4 11.4 35.8 14.6 32.8 17.5 31 20 30.6Z" fill="${hair}"/>` +
		`<g fill="${hairShade}" opacity=".45">` +
		`<path d="M9.8 23.2C14 20.8 17.7 19.6 20.8 19.6 17.3 20.3 13.6 21.5 9.8 23.2Z"/>` +
		`<path d="M10.6 29.8C14.6 26.8 18 25.1 20.8 24.8 17.4 25.9 14 27.6 10.6 29.8Z"/>` +
		`<path d="M11.4 35.8C14.6 32.8 17.5 31 20 30.6 17.1 31.8 14.2 33.5 11.4 35.8Z"/>` +
		`</g>` +
		`<path d="M21.6 15.6c-2.8 2.8-4.6 6.4-5.2 10.8-.4 3 0 5.6 1.2 8 .2-3.2.9-5.8 2.1-7.8 0 2.8.5 5 1.5 6.8.4-3.8 1.5-6.8 3.3-9 1.6-2 2-5.2 1.2-8.8z" fill="${hair}"/>` +
		`<path d="M50.4 15.6c2.8 2.8 4.6 6.4 5.2 10.8.4 3 0 5.6-1.2 8-.2-3.2-.9-5.8-2.1-7.8 0 2.8-.5 5-1.5 6.8-.4-3.8-1.5-6.8-3.3-9-1.6-2-2-5.2-1.2-8.8z" fill="${hair}"/>` +
		`<path d="M17.6 26.4c-.7 3.4-.4 6.4 1 8.8-1.7-1.2-2.6-3.6-2.6-6.9 0-1.1.5-1.7 1.6-1.9z" fill="${hairShade}" opacity=".7"/>` +
		`<path d="M54.4 26.4c.7 3.4.4 6.4-1 8.8 1.7-1.2 2.6-3.6 2.6-6.9 0-1.1-.5-1.7-1.6-1.9z" fill="${hairShade}" opacity=".7"/>` +
		// The crown: high in front and flattening off towards the back, the shape a
		// campaign cap actually has. A even dome reads as a balloon.
		`<path d="M20.6 18.4C19.6 12.4 21.4 7.6 25.2 4.8 28.6 2.4 32.2 1.6 36 1.6 39.8 1.6 43.6 2.4 47 4.8 50.8 7.6 52.4 12.4 51.4 18.4Z" fill="${PALETTE.cap}"/>` +
		`<path d="M25.2 4.8C28.6 2.4 32.2 1.6 36 1.6c2.2 0 4.4.3 6.4.9-6.2 0-12.1 1.1-17.2 2.3z" fill="${PALETTE.capLight}"/>` +
		// The peak: full width, both halves of it, reaching wider than the crown
		// and curving down in the middle so it reads as a peak and not a hatband.
		// Kept above the brows, which start at y=22.6.
		`<path d="M17.4 17.6c-1.4 1.6.4 3 3.8 3.8C25.8 22.3 30.8 22.7 36 22.7s10.2-.4 14.8-1.3c3.4-.8 5.2-2.2 3.8-3.8z" fill="${PALETTE.capDark}"/>` +
		`<path d="M20.2 21.2c4.4 1 10 1.5 15.8 1.5s11.4-.5 15.8-1.5c-.9.7-2.2 1.2-3.9 1.6-4.2.9-8.5 1.3-11.9 1.3s-7.7-.4-11.9-1.3c-1.7-.4-3-.9-3.9-1.6z" fill="#6D0B12"/>` +
		`<path d="M18 17.9c4.4 1.2 10.8 1.8 18 1.8s13.6-.6 18-1.8l.2 1.2c-4.6 1.3-11 1.9-18.2 1.9s-13.6-.6-18.2-1.9z" fill="${PALETTE.cap}" opacity=".45"/>` +
		// "2028" across the front, drawn as strokes so it stays legible when small.
		// The 8 is two separate closed rings -- as one continuous path it retraced
		// its own right-hand side and left the upper ring open at the top left.
		`<g stroke="#FFFFFF" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
		`<path d="M24.8 9.6c0-1 .8-1.6 1.8-1.6s1.8.7 1.8 1.7c0 1.6-3.6 2.6-3.6 4.5h3.6"/>` +
		`<path d="M31.9 8c1.2 0 1.9.8 1.9 3.1s-.7 3.1-1.9 3.1-1.9-.8-1.9-3.1.7-3.1 1.9-3.1z"/>` +
		`<path d="M36 9.6c0-1 .8-1.6 1.8-1.6s1.8.7 1.8 1.7c0 1.6-3.6 2.6-3.6 4.5h3.6"/>` +
		`<path d="M43.1 8c1 0 1.7.67 1.7 1.5s-.7 1.5-1.7 1.5-1.7-.67-1.7-1.5.7-1.5 1.7-1.5z"/>` +
		`<path d="M43.1 11c1.1 0 1.8.72 1.8 1.6s-.7 1.6-1.8 1.6-1.8-.72-1.8-1.6.7-1.6 1.8-1.6z"/>` +
		`</g>`;

	return (
		`<g transform="translate(0 ${dy})">` +
		shoulders +
		// Neck: barely any of it showing. On this face the jaw runs almost straight
		// into the collar, so only a shadowed sliver is left below the jowls.
		`<path d="M29.6 41c0 4.6-.5 7.6-1.5 8.8 2 1.8 4.6 2.8 7.9 2.8s5.9-1 7.9-2.8c-1-1.2-1.5-4.2-1.5-8.8z" fill="${shade}"/>` +
		// Head: a pear. Narrow across the temples, swelling steadily to its widest
		// point down at the jowls, then pulling in to a small chin. Drawn as an
		// oval it could be anyone; the bottom-heavy taper is the likeness.
		`<path d="M36 11.6C41.4 11.6 45.2 13 47.4 15.8 49.4 18.4 50.4 22 50.8 26.4 51.2 31 51 35 50 38.4 48.8 42 46 44.4 42 45.4 40 45.9 38 46.1 36 46.1 34 46.1 32 45.9 30 45.4 26 44.4 23.2 42 22 38.4 21 35 20.8 31 21.2 26.4 21.6 22 22.6 18.4 24.6 15.8 26.8 13 30.6 11.6 36 11.6Z" fill="${skin}"/>` +
		// ears, set low and half swallowed by the hair
		`<ellipse cx="21" cy="30" rx="2.4" ry="3.6" fill="${skin}"/>` +
		`<ellipse cx="51" cy="30" rx="2.4" ry="3.6" fill="${skin}"/>` +
		// The jowls: broad soft masses low on the face. Drawn as thin crescents
		// they read as scratches and the whole face looked crumpled.
		`<ellipse cx="27.6" cy="39.4" rx="5.2" ry="5.6" fill="${shade}" opacity=".1"/>` +
		`<ellipse cx="44.4" cy="39.4" rx="5.2" ry="5.6" fill="${shade}" opacity=".1"/>` +
		// Nasolabial folds: deep, running from the nostrils right down past the
		// corners of the mouth. On this face they are a defining line, not a hint.
		`<path d="M33.4 35.4c-1.8 1.6-3 4-3.4 7.2" fill="none" stroke="${shade}" stroke-width="1" opacity=".3" stroke-linecap="round"/>` +
		`<path d="M38.6 35.4c1.8 1.6 3 4 3.4 7.2" fill="none" stroke="${shade}" stroke-width="1" opacity=".3" stroke-linecap="round"/>` +
		// The pale rings the sunbed goggles leave behind -- unmissable in any
		// photograph of this face, so they belong in the drawing.
		`<ellipse cx="31" cy="28.4" rx="4" ry="3.2" fill="#F7E3C6" opacity=".38"/>` +
		`<ellipse cx="41" cy="28.4" rx="4" ry="3.2" fill="#F7E3C6" opacity=".38"/>` +
		// Eyes: small, narrow and set close together -- on the wide face that gap
		// matters more than the eyes themselves. Outer corners droop.
		`<path d="M28.2 29c1.7-2 4-2.3 5.6-1.1-1.7 1.9-4 2.2-5.6 1.1z" fill="#F4EDE4"/>` +
		`<path d="M43.8 29c-1.7-2-4-2.3-5.6-1.1 1.7 1.9 4 2.2 5.6 1.1z" fill="#F4EDE4"/>` +
		`<circle cx="31" cy="28.4" r="1.1" fill="#5A83A6"/>` +
		`<circle cx="41" cy="28.4" r="1.1" fill="#5A83A6"/>` +
		`<circle cx="31" cy="28.4" r=".55" fill="${ink}"/>` +
		`<circle cx="41" cy="28.4" r=".55" fill="${ink}"/>` +
		// heavy upper lids
		`<path d="M28.2 29c1.7-2 4-2.3 5.6-1.1" fill="none" stroke="${ink}" stroke-width="1.25" stroke-linecap="round"/>` +
		`<path d="M43.8 29c-1.7-2-4-2.3-5.6-1.1" fill="none" stroke="${ink}" stroke-width="1.25" stroke-linecap="round"/>` +
		// bags beneath
		`<path d="M28.8 31c1.5.9 3.2 1 4.8.3" fill="none" stroke="${shade}" stroke-width=".7" opacity=".5" stroke-linecap="round"/>` +
		`<path d="M43.2 31c-1.5.9-3.2 1-4.8.3" fill="none" stroke="${shade}" stroke-width=".7" opacity=".5" stroke-linecap="round"/>` +
		// The scowl: pale, bushy brows driven down and together towards the nose.
		// Kept clear of the eyes, or the two merge into one dark band at key size.
		`<path d="M26.6 22.6c2.6-.4 5.2.5 7.8 2.6.4.4.5.8.2 1.2-.3.4-.7.5-1.2.2-2.4-1.2-4.7-1.8-6.9-1.7-.7 0-1.1-.3-1.1-1s.4-1.1 1.2-1.3z" fill="${hairShade}"/>` +
		`<path d="M45.4 22.6c-2.6-.4-5.2.5-7.8 2.6-.4.4-.5.8-.2 1.2.3.4.7.5 1.2.2 2.4-1.2 4.7-1.8 6.9-1.7.7 0 1.1-.3 1.1-1s-.4-1.1-1.2-1.3z" fill="${hairShade}"/>` +
		// frown lines pinched between the brows
		`<path d="M34.8 23.4v2.2M37.2 23.4v2.2" fill="none" stroke="${shade}" stroke-width=".65" opacity=".45" stroke-linecap="round"/>` +
		// Nose: narrow at the bridge, heavy and blunt at the tip. Shaded down one
		// side with a lit tip, so it reads without outlines cluttering the face.
		`<path d="M34.6 27.6c-.2 3.4-.8 5.8-1.8 7.2 1 1 2.2 1.5 3.2 1.5s2.2-.5 3.2-1.5c-1-1.4-1.6-3.8-1.8-7.2z" fill="${shade}" opacity=".18"/>` +
		`<ellipse cx="36" cy="34.2" rx="2.4" ry="1.6" fill="#F7DFC2" opacity=".35"/>` +
		`<path d="M33.5 35.4c1.3.8 3.7.8 5 0" fill="none" stroke="${shade}" stroke-width=".8" opacity=".32" stroke-linecap="round"/>` +
		// The pout, drawn as a line with a lip under it rather than as a filled
		// shape: any dark area between the lips reads as an open mouth mid-shout.
		// The line arches *upwards*, so the corners sit lower than its middle --
		// curved the other way it reads as a smile, which this face must not do.
		`<path d="M32.6 41.4c1-.7 2.2-1.1 3.4-1.1s2.4.4 3.4 1.1c-.7 1.4-1.9 2.1-3.4 2.1s-2.7-.7-3.4-2.1z" fill="#C88A74"/>` +
		`<path d="M31.6 41.4c1-1.5 2.6-2.3 4.4-2.3s3.4.8 4.4 2.3" fill="none" stroke="#8E4034" stroke-width="1.3" stroke-linecap="round"/>` +
		// corners turned down, but only just
		`<path d="M31.6 41.4c-.3.2-.5.6-.7 1.1M40.4 41.4c.3.2.5.6.7 1.1" fill="none" stroke="${shade}" stroke-width=".7" opacity=".4" stroke-linecap="round"/>` +
		// the crease above a small chin, with the jaw sagging either side of it
		`<path d="M33.8 44.4c1.4.6 3 .6 4.4 0" fill="none" stroke="${shade}" stroke-width=".8" opacity=".28" stroke-linecap="round"/>` +
		(cap ? capMass : hairMass) +
		`</g>`
	);
}

/**
 * The decoy: dark-suited detail agent. Reads as "not the target" thanks to the
 * dark hair, shades and earpiece, but is close enough to punish a sloppy hit.
 */
function guard(rise) {
	const dy = round((1 - rise) * 17);
	return (
		`<g transform="translate(0 ${dy})">` +
		`<path d="M14 64c1.5-10 8-15.5 22-15.5S56.5 54 58 64z" fill="${PALETTE.guardSuit}"/>` +
		`<path d="M28 48.5 36 55.5l8-7 2.6 2-10.6 12-10.6-12z" fill="#D8DCE3"/>` +
		`<path d="M36 54l2.8 2.6-1.2 11.4h-3.2L33.2 56.6z" fill="#3A3F4A"/>` +
		`<path d="M29.5 41h13v11h-13z" fill="#A9764F"/>` +
		`<path d="M36 12.5c8.4 0 13.2 6.2 13.2 15 0 8.2-3.6 13.4-6.5 15.9-2.1 1.7-4.1 2.4-6.7 2.4s-4.6-.7-6.7-2.4c-2.9-2.5-6.5-7.7-6.5-15.9 0-8.8 4.8-15 13.2-15z" fill="${PALETTE.guardSkin}"/>` +
		`<ellipse cx="22.7" cy="29.5" rx="2.2" ry="3.1" fill="${PALETTE.guardSkin}"/>` +
		`<ellipse cx="49.3" cy="29.5" rx="2.2" ry="3.1" fill="${PALETTE.guardSkin}"/>` +
		// crew cut
		`<path d="M22.8 26.4C22.8 16.8 27.8 11.2 36 11.2s13.2 5.6 13.2 15.2c-1.9-4.4-4.2-6.9-6.9-7.5-4.4 2.3-8.8 2.5-13.2.6-2.7.8-4.8 2.9-6.3 6.9z" fill="#1B1C21"/>` +
		// shades
		`<path d="M23.8 26.2h24.4v1.7H23.8z" fill="${PALETTE.shades}"/>` +
		`<path d="M24.9 27.3h10c.4 3.6-1.1 5.5-4.5 5.7-3.4.2-5.3-1.7-5.5-5.7zM37.1 27.3h10c-.2 4-2.1 5.9-5.5 5.7-3.4-.2-4.9-2.1-4.5-5.7z" fill="${PALETTE.shades}"/>` +
		`<path d="M26 28.4h3.4l-2.6 2.8h-1z" fill="#5A6070" opacity=".85"/>` +
		`<path d="M38.2 28.4h3.4L39 31.2h-1z" fill="#5A6070" opacity=".85"/>` +
		// earpiece
		`<path d="M49 31c1.9 2.7 1.9 6.2 0 9.9" fill="none" stroke="#D9DCE2" stroke-width="1.1" stroke-linecap="round"/>` +
		`<circle cx="49.3" cy="30.6" r="1.5" fill="#D9DCE2"/>` +
		// flat mouth
		`<path d="M32.4 39.2h7.2" stroke="#7A4A32" stroke-width="1.5" stroke-linecap="round"/>` +
		`</g>`
	);
}

/* -------------------------------------------------------------------------- */
/* key assets                                                                  */
/* -------------------------------------------------------------------------- */

const wrap = (body, size = 72) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="${size}" height="${size}">` +
	defs() +
	body +
	`</svg>`;

/** Empty hoard -- the resting state of a game tile. */
export const tileIdle = () => wrap(background() + pileBody() + pileBack() + pit() + pileFront());

/**
 * The hoard either side of a figure, for tiles whose figure is a bitmap and so
 * cannot be drawn inside one SVG. Composited as backdrop, figure, foreground,
 * the front coins overlap the figure and sell the "rising out of it" effect
 * exactly as they do in the all-vector tiles.
 */
export const tileBackdrop = () => wrap(background() + pileBody() + pileBack() + pit());
export const tileForeground = () => wrap(pileFront());

/** The same backdrop with the plugin icon's rounded corners. */
export const iconBackdrop = () =>
	wrap(
		`<rect width="72" height="72" rx="14" fill="url(#vault)"/>` +
			`<rect width="72" height="34" rx="14" fill="url(#glow)"/>` +
			pileBody() +
			pileBack() +
			pit(),
	);

/*
 * Drawn stand-in figures, from before the tiles switched to composited portraits.
 * Nothing in the build references them any more, and no scoring value is quoted
 * here on purpose -- the values live in the FIGURES table in src/config.ts and
 * would go stale the moment that table changed. They are kept because they are
 * the only way to render a playable board with no portrait files at all.
 */

/** A generic figure rising from the hoard. */
export const tileTarget = () => wrap(background() + pileBody() + pileBack() + pit() + bust(1) + pileFront());

/** The same figure in a red campaign cap. */
export const tileCapped = () =>
	wrap(background() + pileBody() + pileBack() + pit() + bust(1, { cap: true }) + pileFront());

/** A security-detail figure, in a dark suit and shades. */
export const tileGuard = () => wrap(background() + pileBody() + pileBack() + pit() + guard(1) + pileFront());

// The HUD keys carry a plugin-set title, so their artwork stays a low strip of
// coins along the bottom edge and leaves the middle of the key readable.
const hudStrip = () =>
	`<path d="M-2 72V63C10 58 20 55 36 55s26 3 38 8v9Z" fill="url(#pileBody)"/>` +
	coinField(0x5eed03, 10, { flat: 58, depth0: 2, depth1: 13, minScale: 0.7, maxScale: 1 });

/** Backdrop for the HUD keys (start / timer / score) while idle. */
export const keyIdle = () => wrap(background() + hudStrip());

/** Backdrop for the HUD keys while a round is running. */
export const keyActive = () =>
	wrap(
		`<rect width="72" height="72" fill="#2A1004"/>` +
			`<rect width="72" height="72" fill="url(#vault)" opacity=".5"/>` +
			`<rect width="72" height="34" fill="url(#glow)"/>` +
			hudStrip() +
			`<rect x="1.5" y="1.5" width="69" height="69" rx="7" fill="none" stroke="${PALETTE.goldMid}" stroke-width="2.5" opacity=".9"/>`,
	);

/** Shown on the launcher key that jumps to the game profile. */
export const launcherKey = () => wrap(background() + pileBody() + pileBack() + pit() + bust(0.85) + pileFront());

/* -------------------------------------------------------------------------- */
/* store / listing artwork                                                     */
/* -------------------------------------------------------------------------- */

/** Square plugin icon; rasterised to PNG at 256 and 512 px. */
export const pluginIcon = () =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="512" height="512">` +
	defs() +
	`<rect width="72" height="72" rx="14" fill="url(#vault)"/>` +
	`<rect width="72" height="34" rx="14" fill="url(#glow)"/>` +
	pileBody() +
	pileBack() +
	pit() +
	bust(1) +
	pileFront() +
	`</svg>`;

/* -------------------------------------------------------------------------- */
/* monochrome icons (Stream Deck requires white-on-transparent)                 */
/* -------------------------------------------------------------------------- */

const mono = (body, size) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="${size}" height="${size}" fill="none">${body}</svg>`;

/** Coin stack -- used for the category and the tile action. */
const coinStackPath =
	`<ellipse cx="10" cy="5.6" rx="6.4" ry="2.6" fill="#FFFFFF"/>` +
	`<path d="M3.6 5.6v2.6c0 1.44 2.87 2.6 6.4 2.6s6.4-1.16 6.4-2.6V5.6c0 1.44-2.87 2.6-6.4 2.6S3.6 7.04 3.6 5.6Z" fill="#FFFFFF" opacity=".75"/>` +
	`<path d="M3.6 10v2.6c0 1.44 2.87 2.6 6.4 2.6s6.4-1.16 6.4-2.6V10c0 1.44-2.87 2.6-6.4 2.6S3.6 11.44 3.6 10Z" fill="#FFFFFF" opacity=".55"/>` +
	`<path d="M3.6 14.4V17c0 1.44 2.87 2.6 6.4 2.6s6.4-1.16 6.4-2.6v-2.6c0 1.44-2.87 2.6-6.4 2.6s-6.4-1.16-6.4-2.6Z" fill="#FFFFFF" opacity=".4"/>`;

export const iconCategory = () => mono(coinStackPath, 28);
export const iconTile = () => mono(coinStackPath, 20);

/** Mallet -- the start action. */
export const iconStart = () =>
	mono(
		`<rect x="2.4" y="3.2" width="15.2" height="5.6" rx="1.6" fill="#FFFFFF"/>` +
			`<rect x="8.6" y="8.8" width="2.8" height="8.4" rx="1.2" fill="#FFFFFF"/>` +
			`<rect x="6.6" y="16.4" width="6.8" height="2.4" rx="1.2" fill="#FFFFFF" opacity=".7"/>`,
		20,
	);

/** Stopwatch -- the difficulty / timer action. */
export const iconTimer = () =>
	mono(
		`<circle cx="10" cy="11.4" r="7.2" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>` +
			`<path d="M10 7.6v4.2l2.8 1.8" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
			`<rect x="7.6" y="1" width="4.8" height="2.2" rx="1.1" fill="#FFFFFF"/>` +
			`<rect x="9" y="2.8" width="2" height="2" fill="#FFFFFF"/>`,
		20,
	);

/** Trophy -- the score action. */
export const iconScore = () =>
	mono(
		`<path d="M6 2h8v4.6a4 4 0 0 1-8 0Z" fill="#FFFFFF"/>` +
			`<path d="M6 3.2H3.6v1.4a3.2 3.2 0 0 0 2.8 3.2ZM14 3.2h2.4v1.4a3.2 3.2 0 0 1-2.8 3.2Z" fill="#FFFFFF" opacity=".75"/>` +
			`<rect x="8.8" y="10.4" width="2.4" height="3.6" fill="#FFFFFF"/>` +
			`<rect x="5.4" y="14" width="9.2" height="2.4" rx="1" fill="#FFFFFF"/>` +
			`<rect x="4" y="16.6" width="12" height="2.4" rx="1" fill="#FFFFFF"/>`,
		20,
	);

/** Play-in-coin -- the launcher action. */
export const iconLauncher = () =>
	mono(
		`<circle cx="10" cy="10" r="8" fill="none" stroke="#FFFFFF" stroke-width="1.8"/>` +
			`<path d="M8.2 6.4 14 10l-5.8 3.6Z" fill="#FFFFFF"/>`,
		20,
	);
