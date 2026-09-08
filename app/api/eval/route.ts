import { Chess, type Square } from "chess.js";

function failure(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return failure("Request body must be valid JSON.", 400); }
  const fen = body && typeof body === "object" && "fen" in body ? body.fen : undefined;
  if (typeof fen !== "string" || fen.length > 200) return failure("A valid FEN is required.", 400);
  let game: Chess;
  try { game = new Chess(fen); }
  catch { return failure("The supplied FEN is invalid.", 400); }
  if (game.isGameOver()) return failure("This position is game over; there is no engine move to play.", 409);
  try {
    const url = new URL("https://lichess.org/api/cloud-eval");
    // URLSearchParams encodes raw FEN exactly once.
    url.searchParams.set("fen", game.fen());
    url.searchParams.set("multiPv", "1");
    url.searchParams.set("variant", "standard");
    const response = await fetch(url, {
      headers: { Accept: "application/json" }, cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
    if (response.status === 404) return failure("No cloud evaluation is available for this position. Try another position or retry later.", 404);
    if (response.status === 429) return failure("Lichess is rate limiting requests. Wait a moment, then retry.", 429);
    if (!response.ok) return failure("Lichess cloud evaluation is temporarily unavailable. Please retry.", 502);
    const data = await response.json();
    const moves = data && Array.isArray(data.pvs) ? data.pvs[0]?.moves : undefined;
    const uci = typeof moves === "string" ? moves.trim().split(/\s+/)[0] : "";
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return failure("Lichess returned an invalid evaluation. Please retry.", 502);
    // Lichess can encode castling as king-to-rook; normalize server-side.
    const from = uci.slice(0, 2);
    let to = uci.slice(2, 4);
    const castles: Record<string, string> = { e1h1: "g1", e1a1: "c1", e8h8: "g8", e8a8: "c8" };
    if (game.get(from as Square)?.type === "k" && castles[uci]) to = castles[uci];
    try {
      const move = game.move({ from, to, promotion: uci[4] });
      return Response.json({ move: `${move.from}${move.to}${move.promotion ?? ""}` });
    } catch { return failure("Lichess returned an illegal engine move. Please retry.", 502); }
  } catch {
    return failure("Could not read the Lichess evaluation (network error, timeout, or malformed response). Please retry.", 502);
  }
}
