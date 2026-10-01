import type { Chess } from "chess.js";

export const MAX_TRAINING_FULL_MOVES = 10;
export const MAX_TRAINING_PLIES = MAX_TRAINING_FULL_MOVES * 2;
export type CompletionReason = null | "checkmate" | "draw" | "depth-limit";

export function getCompletionReason(game: Chess): CompletionReason {
  if (!game.isGameOver()) return game.history().length >= MAX_TRAINING_PLIES ? "depth-limit" : null;
  return game.isCheckmate() ? "checkmate" : "draw";
}
