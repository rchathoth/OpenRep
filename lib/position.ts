type Position = Record<string, { pieceType: string }>;

export const CASTLING_OPTIONS = [
  { right: "K", king: "e1", rook: "h1", color: "w", label: "White kingside" },
  { right: "Q", king: "e1", rook: "a1", color: "w", label: "White queenside" },
  { right: "k", king: "e8", rook: "h8", color: "b", label: "Black kingside" },
  { right: "q", king: "e8", rook: "a8", color: "b", label: "Black queenside" },
] as const;

// Placement alone cannot tell whether a king or rook has previously moved.
// Setup records that history explicitly; training's chess.js game then owns it.
export function availableCastlingRights(position: Position) {
  return CASTLING_OPTIONS.filter(({ king, rook, color }) =>
    position[king]?.pieceType === `${color}K` && position[rook]?.pieceType === `${color}R`
  ).map(({ right }) => right).join("");
}

export function positionToFen(position: Position, side: "w" | "b", castlingRights: string) {
  const ranks = Array.from({ length: 8 }, (_, rankIndex) => {
    let empty = 0; let rank = "";
    for (let file = 0; file < 8; file += 1) {
      const piece = position[`${String.fromCharCode(97 + file)}${8 - rankIndex}`];
      if (!piece) { empty += 1; continue; }
      if (empty) { rank += empty; empty = 0; }
      rank += piece.pieceType[0] === "w" ? piece.pieceType[1] : piece.pieceType[1].toLowerCase();
    }
    return `${rank}${empty || ""}`;
  });
  const rights = [...availableCastlingRights(position)].filter((right) => castlingRights.includes(right)).join("");
  return `${ranks.join("/")} ${side} ${rights || "-"} - 0 1`;
}
