import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ENGINE_ASSET_PATH } from "../lib/engine/settings.ts";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("node_modules/stockfish/package.json", root), "utf8"));
if (pkg.version !== "19.0.0") throw new Error("Update engine paths and source/license notices before changing Stockfish versions.");
const output = new URL(`public${ENGINE_ASSET_PATH}/`, root);
await mkdir(output, { recursive: true });
for (const name of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
  await copyFile(new URL(`node_modules/stockfish/bin/${name}`, root), new URL(name, output));
}
await copyFile(new URL("node_modules/stockfish/Copying.txt", root), new URL("COPYING.txt", output));
await copyFile(new URL("THIRD_PARTY_NOTICES.md", root), new URL("SOURCE.txt", output));
console.log(`Prepared Stockfish ${pkg.version}: ${fileURLToPath(output)}`);
