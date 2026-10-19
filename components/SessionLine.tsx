import type { Move } from "chess.js";

/** Presentation of committed history only; never infers or suggests a move. */
export default function SessionLine({ moves }: { moves: Move[] }) {
  const pairs = new Map<number, { white?: string; black?: string; last?: "w" | "b" }>();
  moves.forEach((move, index) => {
    const number = Number(move.before.split(" ")[5]);
    const pair = pairs.get(number) ?? {};
    if (move.color === "w") pair.white = move.san;
    else pair.black = move.san;
    if (index === moves.length - 1) pair.last = move.color;
    pairs.set(number, pair);
  });
  return <section className="session-line" aria-label="Played line">
    <div className="line-heading"><h3>Your line</h3><span>{moves.length ? `${moves.length} half-moves played` : "Ready for your first move"}</span></div>
    {moves.length ? <ol className="move-pairs">
      {[...pairs].map(([number, pair]) => <li key={number}>
        <span className="move-number">{number}.</span>
        <span className={pair.last === "w" ? "latest-move" : ""}>{pair.white ?? "—"}</span>
        <span className={pair.last === "b" ? "latest-move" : ""}>{pair.black ?? "—"}</span>
      </li>)}
    </ol> : <p className="line-empty">Your accepted moves and the engine’s replies will appear here.</p>}
  </section>;
}
