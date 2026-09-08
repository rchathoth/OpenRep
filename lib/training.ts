import { Chess, type Move } from "chess.js";

export function toUci(move: Pick<Move, "from" | "to" | "promotion">) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function applyUci(game: Chess, uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error("The evaluation service returned an invalid move.");
  return game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

export async function expectedMoveFor(fen: string, signal: AbortSignal) {
  const response = await fetch("/api/eval", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fen }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error("The evaluation service returned an unreadable response. Please retry."); }
  if (!response.ok || typeof payload?.move !== "string") {
    throw new Error(typeof payload?.error === "string" ? payload.error : "No usable evaluation was returned. Please retry.");
  }
  return toUci(applyUci(new Chess(fen), payload.move));
}
