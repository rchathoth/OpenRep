import { Chess, type Move, type Square } from "chess.js";
import type { MoveEngine } from "./engine/types.ts";

export function toUci(move: Pick<Move, "from" | "to" | "promotion">) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function applyUci(game: Chess, uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error("Stockfish returned an invalid move. Please retry.");
  return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

export async function getExpectedMove(game: Chess, signal: AbortSignal, engine: MoveEngine) {
  signal.throwIfAborted();
  if (game.isGameOver()) throw new Error("This position is game over; there is no engine move to play.");
  const fen = game.fen();
  let uci = await engine.findBestMove({ fen, signal });
  signal.throwIfAborted();
  if (game.fen() !== fen) throw new Error("The position changed during the engine search.");
  // Validate on a copy: a suggested move must never mutate the training game.
  const copy = new Chess(fen);
  if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error("Stockfish returned an invalid move. Please retry.");
  }
  const castles: Record<string, string> = { e1h1: "e1g1", e1a1: "e1c1", e8h8: "e8g8", e8a8: "e8c8" };
  if (copy.get(uci.slice(0, 2) as Square)?.type === "k" && castles[uci]) uci = castles[uci];
  try { return toUci(applyUci(copy, uci)); }
  catch { throw new Error("Stockfish returned an illegal move. Please retry."); }
}
