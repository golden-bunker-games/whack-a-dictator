import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const isWatching = process.env.ROLLUP_WATCH === "true";
const sdPlugin = "com.goldenbunker.whackadictator.sdPlugin";

/** @type {import("rollup").RollupOptions} */
export default {
	input: "src/plugin.ts",
	output: {
		file: `${sdPlugin}/bin/plugin.js`,
		format: "es",
		sourcemap: isWatching,
		// Stream Deck resolves source maps relative to the plugin folder.
		sourcemapPathTransform: (relative, map) =>
			relative.startsWith("..") ? relative : `${sdPlugin}/bin/${relative}`,
	},
	plugins: [
		typescript({
			tsconfig: "./tsconfig.json",
			// Decorators on action classes need the legacy-free 2022 semantics.
			compilerOptions: { noEmit: false, sourceMap: isWatching },
			mapRoot: isWatching ? "./" : undefined,
		}),
		nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
		commonjs(),
		!isWatching && terser(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				// Marks bin/ as ESM so Node does not fall back to CommonJS.
				this.emitFile({ fileName: "package.json", source: `{"type":"module"}`, type: "asset" });
			},
		},
	],
};
