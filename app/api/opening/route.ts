import { Chess } from "chess.js";

type ExplorerMove = { uci?: string; white?: number; draws?: number; black?: number };
type ExplorerResponse = { moves?: ExplorerMove[] };
const OPENING_EXPLORER = "https://explorer.lichess.ovh/lichess";

function plays(move: ExplorerMove) { return (move.white ?? 0) + (move.draws ?? 0) + (move.black ?? 0); }

export async function POST(request: Request) {
  let fen: unknown;
  try { ({ fen } = await request.json()); } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof fen !== "string" || fen.length > 200) return Response.json({ error: "A valid FEN is required." }, { status: 400 });
  try { new Chess(fen); } catch { return Response.json({ error: "The supplied FEN is invalid." }, { status: 400 }); }
  try {
    const url = new URL(OPENING_EXPLORER);
    url.searchParams.set("variant", "standard");
    url.searchParams.set("speeds", "blitz,rapid,classical");
    url.searchParams.set("fen", fen);
    const response = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 300 } });
    if (!response.ok) return Response.json({ error: "Lichess opening explorer is temporarily unavailable." }, { status: 502 });
    const data = await response.json() as ExplorerResponse;
    const moves = (data.moves ?? []).filter((move): move is ExplorerMove & { uci: string } => Boolean(move.uci) && plays(move) > 0).sort((a, b) => plays(b) - plays(a));
    const totalPlays = moves.reduce((sum, move) => sum + plays(move), 0);
    if (!moves.length || !totalPlays) return Response.json({ error: "No common opening moves are available for this position." }, { status: 404 });

    let covered = 0;
    const candidates: string[] = [];
    for (const move of moves) {
      candidates.push(move.uci);
      covered += plays(move);
      if (covered / totalPlays >= 0.95) break;
    }
    const move = candidates[Math.floor(Math.random() * candidates.length)];
    return Response.json({ move });
  } catch { return Response.json({ error: "Could not contact the Lichess opening explorer." }, { status: 502 }); }
}
