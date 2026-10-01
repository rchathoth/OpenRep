import { Chess } from "chess.js";

const OPENING_EXPLORER = "https://explorer.lichess.ovh/lichess";
const UPSTREAM_TIMEOUT_MS = 3000;

type OpeningCandidate = { uci: string; count: number };
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const fen = isRecord(body) ? body.fen : undefined;
  if (typeof fen !== "string" || fen.length > 200) return Response.json({ error: "A valid FEN is required." }, { status: 400 });
  try { new Chess(fen); } catch { return Response.json({ error: "The supplied FEN is invalid." }, { status: 400 }); }

  const url = new URL(OPENING_EXPLORER);
  url.searchParams.set("variant", "standard");
  url.searchParams.set("speeds", "blitz,rapid,classical");
  url.searchParams.set("moves", "256");
  url.searchParams.set("topGames", "0");
  url.searchParams.set("recentGames", "0");
  url.searchParams.set("fen", fen);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Lichess request timed out", "TimeoutError")), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    if (!response.ok) return Response.json({ error: "Lichess opening explorer is temporarily unavailable." }, { status: 502 });
    const data: unknown = await response.json();
    if (!isRecord(data) || !Array.isArray(data.moves)) throw new Error("Malformed explorer response");
    const moves: OpeningCandidate[] = [];
    for (const value of data.moves) {
      if (!isRecord(value) || typeof value.uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value.uci)) continue;
      const counts = [value.white, value.draws, value.black];
      if (!counts.every((count) => Number.isSafeInteger(count) && (count as number) >= 0)) continue;
      const count = (counts[0] as number) + (counts[1] as number) + (counts[2] as number);
      if (!Number.isSafeInteger(count)) continue;
      if (count > 0) moves.push({ uci: value.uci, count });
    }
    const total = moves.reduce((sum, move) => sum + move.count, 0);
    if (!Number.isSafeInteger(total)) return Response.json({ error: "Lichess returned unsafe move counts." }, { status: 502 });
    return Response.json({ moves });
  } catch {
    if (controller.signal.aborted) return Response.json({ error: "Lichess opening explorer timed out." }, { status: 504 });
    return Response.json({ error: "Could not contact the Lichess opening explorer." }, { status: 502 });
  } finally { clearTimeout(timeout); }
}
