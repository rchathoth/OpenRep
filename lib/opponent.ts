import { Chess } from "chess.js";
import type { MoveEngine } from "./engine/types.ts";
import { getExpectedMove } from "./training.ts";
import { commonLegalMoves, parseOpeningCandidates, sampleWeightedMove } from "./opening.ts";
import { getCompletionReason } from "./session.ts";

export type OpponentMoveSource = "lichess" | "stockfish";
export type OpponentDependencies = { fetch?: typeof fetch; random?: () => number; timeoutMs?: number };

function assertCurrent(game: Chess, fen: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (game.fen() !== fen) throw new Error("The position changed while choosing an opponent reply.");
  if (getCompletionReason(game)) throw new Error("This training session is complete.");
}

export async function getOpponentMove(
  game: Chess,
  signal: AbortSignal,
  engine: MoveEngine,
  dependencies: OpponentDependencies = {},
): Promise<{ move: string; source: OpponentMoveSource }> {
  signal.throwIfAborted();
  if (getCompletionReason(game)) throw new Error("This training session is complete.");
  const fen = game.fen();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Opening request timed out", "TimeoutError")), dependencies.timeoutMs ?? 4000);
  const combined = AbortSignal.any([signal, controller.signal]);
  let candidateMove: string | null = null;
  try {
    const response = await (dependencies.fetch ?? fetch)("/api/opening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fen }),
      signal: combined,
    });
    if (response.ok) {
      const payload: unknown = await response.json();
      candidateMove = sampleWeightedMove(commonLegalMoves(fen, parseOpeningCandidates(payload)), dependencies.random);
    }
  } catch {
    if (signal.aborted) signal.throwIfAborted();
    // A timed-out request is an availability failure; use the local engine.
  } finally {
    clearTimeout(timeout);
  }
  assertCurrent(game, fen, signal);
  if (candidateMove) return { move: candidateMove, source: "lichess" };
  const move = await getExpectedMove(game, signal, engine);
  assertCurrent(game, fen, signal);
  return { move, source: "stockfish" };
}
