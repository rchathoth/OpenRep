"use client";

import { useBoardTap } from "@/components/useBoardTap";
import { boardAppearance } from "@/components/boardAppearance";
import { Icon } from "@/components/Brand";
import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard, defaultPieces } from "react-chessboard";
import type { PositionDataType } from "react-chessboard";

type PositionSetupProps = { onStartTraining: (fen: string, playerSide: Side, boardOrientation: "white" | "black") => void };
type Side = "w" | "b";
const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const palette = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"];

function fenToPosition(fen: string): PositionDataType {
  const position: PositionDataType = {};
  fen.split(" ")[0].split("/").forEach((row, rowIndex) => {
    let file = 0;
    for (const token of row) {
      if (/\d/.test(token)) file += Number(token);
      else { position[`${String.fromCharCode(97 + file)}${8 - rowIndex}`] = { pieceType: `${token === token.toUpperCase() ? "w" : "b"}${token.toUpperCase()}` }; file += 1; }
    }
  });
  return position;
}

function positionToFen(position: PositionDataType, side: Side) {
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
  const placement = ranks.join("/");
  const rights = placement === STANDARD_FEN.split(" ")[0] ? "KQkq" : "-";
  return `${placement} ${side} ${rights} - 0 1`;
}

const PIECE_NAMES: Record<string, string> = {
  wK: "White King",
  wQ: "White Queen",
  wR: "White Rook",
  wB: "White Bishop",
  wN: "White Knight",
  wP: "White Pawn",
  bK: "Black King",
  bQ: "Black Queen",
  bR: "Black Rook",
  bB: "Black Bishop",
  bN: "Black Knight",
  bP: "Black Pawn",
};

export default function PositionSetup({ onStartTraining }: PositionSetupProps) {
  const [position, setPosition] = useState<PositionDataType>(() => fenToPosition(STANDARD_FEN));
  const [side, setSide] = useState<Side>("w");
  const [playerSide, setPlayerSide] = useState<Side>("w");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [selectedPiece, setSelectedPiece] = useState("wP");
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare) return false;
    setPosition((current) => {
      const piece = current[sourceSquare];
      if (!piece) return current;
      const next = { ...current };
      delete next[sourceSquare];
      next[targetSquare] = piece;
      return next;
    });
    return true;
  }

  function startTraining() {
    const whiteKing = Object.values(position).filter(({ pieceType }) => pieceType === "wK").length;
    const blackKing = Object.values(position).filter(({ pieceType }) => pieceType === "bK").length;
    if (whiteKing !== 1 || blackKing !== 1) {
      setError("Training positions need exactly one white king and one black king.");
      return;
    }
    const fen = positionToFen(position, side);
    try {
      new Chess(fen);
    } catch {
      setError("This position is invalid. Check king placement and pawns on the first or last rank.");
      return;
    }
    setError(null);
    onStartTraining(fen, playerSide, boardOrientation);
  }

  function removePiece(square: string) {
    setPosition((current) => {
      if (!current[square]) return current;
      const next = { ...current };
      delete next[square];
      return next;
    });
  }

  const boardTap = useBoardTap(({ square }) => removing ? removePiece(square) :
    setPosition((current) => ({ ...current, [square]: { pieceType: selectedPiece } })));

  return (
    <section className="workspace" aria-labelledby="setup-title">
      <div className="board-column">
        <div className="screen-heading">
          <p className="eyebrow section-eyebrow">01 / THE POSITION</p>
          <h2 id="setup-title">Set up a position</h2>
          <p>Drag pieces to arrange them, or choose a piece and tap a square.</p>
        </div>
        <div className="board-frame">
          <div className="board-meta"><span>YOUR STARTING POINT</span><span><span className={`side-indicator side-${side}`} aria-hidden="true" />{side === "w" ? "White" : "Black"} to move</span></div>
          <div className="board-shell" {...boardTap.handlers}>
            <Chessboard options={{
              ...boardAppearance,
              position,
              boardOrientation,
              onPieceDrop,
              onSquareClick: boardTap.onSquareClick,
              showAnimations: false,
              onSquareRightClick: ({ square }) => removePiece(square),
              allowDragOffBoard: true,
              allowDragging: !removing,
            }} />
          </div>
          <div className="board-caption"><span>A position full of possibilities.</span><span>Make the next move yours.</span></div>
        </div>
      </div>
      <aside className="control-panel" aria-label="Position controls">
        <div className="panel-heading"><p className="eyebrow">02 / MAKE IT YOURS</p><h3>A place to begin.</h3><p className="setup-note">Choose your pieces. Find your perspective.</p></div>
        <div className="panel-section">
          <div className="palette-heading"><h3 className="control-label">Piece to place</h3><p className="setup-note active-tool" aria-live="polite">{removing ? "Remove mode" : PIECE_NAMES[selectedPiece]}</p></div>
          {["w", "b"].map((color) => (
            <div key={color} className="palette-group" role="group" aria-label={`${color === "w" ? "White" : "Black"} pieces`}>
              <p className="control-label">{color === "w" ? "White" : "Black"}</p>
              <div className="piece-palette">
                {palette.filter((piece) => piece[0] === color).map((piece) => {
                  const PieceIcon = defaultPieces[piece];
                  const active = !removing && selectedPiece === piece;
                  return <button key={piece} type="button" className={`piece-choice${active ? " active" : ""}`}
                    onClick={() => { setSelectedPiece(piece); setRemoving(false); }}
                    aria-label={`Place ${PIECE_NAMES[piece]}`} aria-pressed={active} title={PIECE_NAMES[piece]}>
                    <span className="piece-svg-wrap">{PieceIcon ? <PieceIcon /> : piece[1]}</span>
                  </button>;
                })}
              </div>
            </div>
          ))}
          <button type="button" className="button-secondary remove-toggle" aria-pressed={removing} onClick={() => setRemoving((current) => !current)}>Remove pieces</button>
          <p className="setup-note palette-note">{removing ? "Tap a square to remove its piece." : "Tip: right-click a square to remove a piece."}</p>
        </div>
        <div className="panel-section side-settings">
          <label className="control-label">I play
            <select className="select-control" value={playerSide} onChange={(event) => {
              const next = event.target.value as Side;
              setPlayerSide(next); setBoardOrientation(next === "w" ? "white" : "black");
            }}><option value="w">White</option><option value="b">Black</option></select>
          </label>
          <label className="control-label">Side to move
            <select className="select-control" value={side} onChange={(event) => setSide(event.target.value as Side)}>
              <option value="w">White</option><option value="b">Black</option>
            </select>
          </label>
        </div>
        <div className="panel-section board-actions">
          <button type="button" className="button-secondary" onClick={() => setBoardOrientation((current) => current === "white" ? "black" : "white")}><Icon name="flip" />Flip board</button>
          <button type="button" className="button-secondary" onClick={() => {
            setPosition(fenToPosition(STANDARD_FEN)); setSide("w"); setError(null); setRemoving(false);
          }}><Icon name="reset" />Reset position</button>
        </div>
        <div className="start-actions">
          {error && <p className="error-message" role="alert">{error}</p>}
          <button type="button" className="button-primary" onClick={startTraining}>Start training <Icon name="arrow" /></button>
          <p className="start-note">A focused session. Up to 10 moves.</p>
        </div>
      </aside>
    </section>
  );
}
