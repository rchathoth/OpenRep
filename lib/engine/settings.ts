import type { EngineSettings } from "./types.ts";

export const ENGINE_ASSET_PATH = "/engine/stockfish-19.0.0";
export const ENGINE_SCRIPT = `${ENGINE_ASSET_PATH}/stockfish-19-lite-single.js`;

export function defaultSettings(constrained = false): EngineSettings {
  return { movetime: constrained ? 500 : 1000, threads: 1, hashMb: 16 };
}

export function validateSettings(settings: EngineSettings) {
  validateMovetime(settings.movetime);
  if (settings.threads !== 1) throw new Error("This Stockfish build supports one thread.");
  if (!Number.isInteger(settings.hashMb) || settings.hashMb < 16 || settings.hashMb > 32) {
    throw new Error("Engine hash must be between 16 and 32 MB.");
  }
  if (settings.depth !== undefined && (!Number.isInteger(settings.depth) || settings.depth < 1 || settings.depth > 128)) {
    throw new Error("Engine depth must be between 1 and 128.");
  }
}

export function validateMovetime(movetime: number) {
  if (!Number.isInteger(movetime) || movetime < 1 || movetime > 10_000) {
    throw new Error("Engine search time must be between 1 and 10000 ms.");
  }
}
