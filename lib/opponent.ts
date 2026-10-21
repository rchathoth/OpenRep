import { Chess } from "chess.js";
import type { CandidateEngine, EngineAnalysis, EngineScore } from "./engine/types.ts";
import { normalizeLegalUci } from "./training.ts";
import { getCompletionReason } from "./session.ts";

export type OpponentMoveSource = "stockfish";
export type OpponentDependencies = { random?: () => number };

function assertCurrent(game: Chess, fen: string, signal: AbortSignal) {
  signal.throwIfAborted();
  if (game.fen() !== fen) throw new Error("The position changed while choosing an opponent reply.");
  if (getCompletionReason(game)) throw new Error("This training session is complete.");
}

function usableScore(score?: EngineScore): score is EngineScore {
  return !!score && (score.type === "cp" || score.type === "mate") && Number.isSafeInteger(score.value) &&
    (score.type !== "mate" || score.value !== 0);
}

function qualifies(score: EngineScore, best: EngineScore) {
  if (best.type === "cp") return score.type === "cp" && score.value >= best.value - 100;
  if (best.value > 0) return score.type === "mate" && score.value > 0;
  // In a lost position, do not choose a line that allows a faster forced mate.
  return score.type === "mate" && score.value <= best.value;
}

export function selectOpponentMove(fen: string, analysis: EngineAnalysis, random: () => number = Math.random): string {
  const best = normalizeLegalUci(fen, analysis.move);
  if (!best) throw new Error("Stockfish returned an invalid or illegal move. Please retry.");
  const lines = analysis.lines.map(line => ({ ...line, move: normalizeLegalUci(fen, line.move) }));
  // Rank 1 belongs to the completed depth; bestmove may come from a newer,
  // incomplete iteration and is retained only as the safe fallback.
  const bestScore = lines[0]?.move ? lines[0].score : undefined;
  // Without exact scores for the legal lines, comparisons are not reliable.
  if (!usableScore(bestScore) || lines.some(line => line.move && !usableScore(line.score))) return best;
  const moves = [...new Set(lines.filter(line => line.move && usableScore(line.score) && qualifies(line.score, bestScore)).map(line => line.move!))];
  if (moves.length <= 1) return best;
  const value = random();
  return Number.isFinite(value) && value >= 0 && value < 1 ? moves[Math.floor(value * moves.length)] : best;
}

export async function getOpponentMove(
  game: Chess,
  signal: AbortSignal,
  engine: CandidateEngine,
  dependencies: OpponentDependencies = {},
): Promise<{ move: string; source: OpponentMoveSource }> {
  signal.throwIfAborted();
  if (getCompletionReason(game)) throw new Error("This training session is complete.");
  const fen = game.fen();
  const analysis = await engine.findCandidateMoves({ fen, signal, multiPV: Math.min(5, game.moves().length) });
  assertCurrent(game, fen, signal);
  const move = selectOpponentMove(fen, analysis, dependencies.random);
  assertCurrent(game, fen, signal);
  return { move, source: "stockfish" };
}
