/**
 * Property inspector for Whack-A-Dictator.
 *
 * Talks the Stream Deck property inspector protocol directly rather than pulling
 * in a component library, so the plugin ships with no external dependencies and
 * works with no network access.
 */

const DIFFICULTIES = ["Easy", "Normal", "Hard", "Custom"];
const ROUND_LENGTHS = ["5s", "10s", "20s", "30s", "Endless"];
const CUSTOM_INDEX = 3;
const CUSTOM_LIMITS = { min: 200, max: 5000 };

const DEFAULTS = {
	difficulty: 1,
	roundLength: 1,
	customMin: 500,
	customMax: 1000,
	highScores: DIFFICULTIES.map(() => ROUND_LENGTHS.map(() => 0)),
};

/** @type {WebSocket | undefined} */
let socket;
/** @type {string} */
let pluginUUID;
/** Last known global settings; edits are merged into this so nothing is lost. */
let settings = structuredClone(DEFAULTS);

const el = {
	difficulty: document.getElementById("difficulty"),
	roundLength: document.getElementById("roundLength"),
	customSection: document.getElementById("customSection"),
	customMin: document.getElementById("customMin"),
	customMax: document.getElementById("customMax"),
	scores: document.getElementById("scores"),
	reset: document.getElementById("reset"),
};

/* -------------------------------------------------------------------------- */
/* Stream Deck connection                                                      */
/* -------------------------------------------------------------------------- */

/** Entry point called by the Stream Deck application. */
globalThis.connectElgatoStreamDeckSocket = (port, uuid, registerEvent) => {
	pluginUUID = uuid;
	socket = new WebSocket(`ws://127.0.0.1:${port}`);

	socket.addEventListener("open", () => {
		send({ event: registerEvent, uuid });
		send({ event: "getGlobalSettings", context: uuid });
	});

	socket.addEventListener("message", (message) => {
		const data = safeParse(message.data);
		if (data?.event === "didReceiveGlobalSettings") {
			settings = normalise(data.payload?.settings);
			render();
		}
	});
};

function send(payload) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(payload));
	}
}

/** Persists the current settings; the plugin picks them up and redraws its keys. */
function save() {
	send({ event: "setGlobalSettings", context: pluginUUID, payload: settings });
}

function safeParse(value) {
	try {
		return typeof value === "string" ? JSON.parse(value) : null;
	} catch {
		return null;
	}
}

/* -------------------------------------------------------------------------- */
/* state                                                                       */
/* -------------------------------------------------------------------------- */

/** Fills in anything the plugin has not written yet and clamps the rest. */
function normalise(stored) {
	const source = stored ?? {};
	const customMin = clamp(source.customMin ?? DEFAULTS.customMin, CUSTOM_LIMITS.min, CUSTOM_LIMITS.max);

	return {
		difficulty: clampIndex(source.difficulty, DIFFICULTIES.length, DEFAULTS.difficulty),
		roundLength: clampIndex(source.roundLength, ROUND_LENGTHS.length, DEFAULTS.roundLength),
		customMin,
		customMax: clamp(source.customMax ?? DEFAULTS.customMax, customMin, CUSTOM_LIMITS.max),
		highScores: DIFFICULTIES.map((_, d) =>
			ROUND_LENGTHS.map((_, r) => Math.max(0, Math.trunc(source.highScores?.[d]?.[r] ?? 0))),
		),
	};
}

function clamp(value, min, max) {
	const number = Number(value);
	return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : min;
}

function clampIndex(value, length, fallback) {
	return Number.isInteger(value) && value >= 0 && value < length ? value : fallback;
}

/* -------------------------------------------------------------------------- */
/* rendering                                                                   */
/* -------------------------------------------------------------------------- */

function render() {
	el.difficulty.value = String(settings.difficulty);
	el.roundLength.value = String(settings.roundLength);
	el.customMin.value = String(settings.customMin);
	el.customMax.value = String(settings.customMax);
	el.customSection.hidden = settings.difficulty !== CUSTOM_INDEX;
	renderScores();
}

/** Draws the high score grid, highlighting the selected difficulty/round. */
function renderScores() {
	const cells = [cell("", "head")];
	for (const length of ROUND_LENGTHS) {
		cells.push(cell(length, "head"));
	}

	DIFFICULTIES.forEach((difficulty, d) => {
		cells.push(cell(difficulty, "rowhead"));
		ROUND_LENGTHS.forEach((_, r) => {
			const selected = d === settings.difficulty && r === settings.roundLength;
			cells.push(cell(String(settings.highScores[d][r]), selected ? "best" : ""));
		});
	});

	el.scores.replaceChildren(...cells);
}

function cell(text, className) {
	const span = document.createElement("span");
	span.textContent = text;
	if (className) span.className = className;
	return span;
}

/* -------------------------------------------------------------------------- */
/* input                                                                       */
/* -------------------------------------------------------------------------- */

el.difficulty.addEventListener("change", () => {
	settings.difficulty = Number(el.difficulty.value);
	el.customSection.hidden = settings.difficulty !== CUSTOM_INDEX;
	renderScores();
	save();
});

el.roundLength.addEventListener("change", () => {
	settings.roundLength = Number(el.roundLength.value);
	renderScores();
	save();
});

el.customMin.addEventListener("change", () => {
	settings.customMin = clamp(el.customMin.value, CUSTOM_LIMITS.min, CUSTOM_LIMITS.max);
	// Keep the range valid: the longest can never be shorter than the shortest.
	settings.customMax = Math.max(settings.customMax, settings.customMin);
	render();
	save();
});

el.customMax.addEventListener("change", () => {
	settings.customMax = clamp(el.customMax.value, settings.customMin, CUSTOM_LIMITS.max);
	render();
	save();
});

el.reset.addEventListener("click", () => {
	settings.highScores = DIFFICULTIES.map(() => ROUND_LENGTHS.map(() => 0));
	renderScores();
	save();
});
