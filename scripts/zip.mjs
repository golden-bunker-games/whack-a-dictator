/**
 * Minimal deterministic ZIP writer.
 *
 * A `.streamDeckProfile` is a ZIP archive, and Node ships no archiver, so this
 * writes the handful of records the format needs. Timestamps are fixed, which
 * keeps repeated builds byte-identical.
 */

import { deflateRawSync } from "node:zlib";

/** Fixed DOS timestamp (2020-01-01 00:00:00) so archives are reproducible. */
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/**
 * Version-made-by: ZIP 6.3, host FAT -- what Elgato's own tooling writes.
 * External attributes must then be plain DOS attribute bytes, with the upper
 * 16 bits (Unix mode) left clear.
 */
const VERSION_MADE_BY = 0x003f;

/** DOS file attributes. */
export const ATTR_DIR = 0x10;
export const ATTR_ARCHIVE = 0x20;
export const ATTR_NORMAL = 0x80;

const CRC_TABLE = buildCrcTable();

function buildCrcTable() {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let bit = 0; bit < 8; bit++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[i] = c >>> 0;
	}
	return table;
}

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a ZIP archive.
 *
 * @param {Array<{ name: string, data?: Buffer | string, attrs?: number }>} entries
 * Files, and directories (a name ending in `/`, with no data). `attrs` defaults
 * to {@link ATTR_DIR} for directories and {@link ATTR_ARCHIVE} for files.
 * @returns {Buffer} The archive.
 */
export function zip(entries) {
	const locals = [];
	const centrals = [];
	let offset = 0;

	for (const entry of entries) {
		const isDir = entry.name.endsWith("/");
		const name = Buffer.from(entry.name, "utf8");
		const raw = isDir ? Buffer.alloc(0) : Buffer.from(entry.data ?? "", "utf8");

		// Directories and empty files are stored; everything else is deflated,
		// but only when deflating actually pays off.
		const deflated = raw.length > 0 ? deflateRawSync(raw, { level: 9 }) : Buffer.alloc(0);
		const useDeflate = deflated.length > 0 && deflated.length < raw.length;
		const body = useDeflate ? deflated : raw;
		const method = useDeflate ? 8 : 0;
		const crc = crc32(raw);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(SIG_LOCAL, 0);
		local.writeUInt16LE(20, 4); // version needed
		local.writeUInt16LE(0, 6); // flags
		local.writeUInt16LE(method, 8);
		local.writeUInt16LE(DOS_TIME, 10);
		local.writeUInt16LE(DOS_DATE, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28); // extra field length
		locals.push(local, name, body);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(SIG_CENTRAL, 0);
		central.writeUInt16LE(VERSION_MADE_BY, 4);
		central.writeUInt16LE(20, 6); // version needed
		central.writeUInt16LE(0, 8); // flags
		central.writeUInt16LE(method, 10);
		central.writeUInt16LE(DOS_TIME, 12);
		central.writeUInt16LE(DOS_DATE, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(body.length, 20);
		central.writeUInt32LE(raw.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt16LE(0, 30); // extra field length
		central.writeUInt16LE(0, 32); // comment length
		central.writeUInt16LE(0, 34); // disk number
		central.writeUInt16LE(0, 36); // internal attributes
		central.writeUInt32LE(entry.attrs ?? (isDir ? ATTR_DIR : ATTR_ARCHIVE), 38);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, name);

		offset += local.length + name.length + body.length;
	}

	const centralBlock = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(SIG_EOCD, 0);
	eocd.writeUInt16LE(0, 4); // disk number
	eocd.writeUInt16LE(0, 6); // central directory start disk
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(centralBlock.length, 12);
	eocd.writeUInt32LE(offset, 16);
	eocd.writeUInt16LE(0, 20); // comment length

	return Buffer.concat([...locals, centralBlock, eocd]);
}
