"use client";

import { useBoardTap } from "@/components/useBoardTap";
import { boardAppearance } from "@/components/boardAppearance";
import { Icon } from "@/components/Brand";
import { useState } from "react";
import { Chess } from "chess.js";
import { availableCastlingRights, CASTLING_OPTIONS, positionToFen } from "@/lib/position";
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
  const [castlingRights, setCastlingRights] = useState("KQkq");
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
    const fen = positionToFen(position, side, castlingRights);
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
    <section className="workspace setup-workspace" aria-labelledby="setup-title">
      <div className="board-column">
        <div className="screen-heading">
          <h2 id="setup-title">Starting position</h2>
          <p>Drag pieces, or choose one and tap a square.</p>
        </div>
        <div className="board-frame">
          <div className="board-meta"><span className="board-meta-label">Opening practice</span><span><span className={`side-indicator side-${side}`} aria-hidden="true" />{side === "w" ? "White" : "Black"} to move</span></div>
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
        </div>
        <div className="board-caption"><span>Arrange your position, then start.</span><span>10 moves per session</span></div>
      </div>
      <aside className="control-panel" aria-label="Position controls">
        <div className="panel-heading"><div><h3>Build your position</h3><p className="panel-description">Choose a piece, then tap a square.</p></div></div>
        <div className="tool-heading"><span>Piece tools</span><p className="active-tool" aria-live="polite">{removing ? "Remove mode" : PIECE_NAMES[selectedPiece]}</p></div>
        <div className="panel-section">
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
          {removing && <p className="setup-note">Tap a square to remove its piece.</p>}
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
        <fieldset className="panel-section castling-settings">
          <legend className="control-label">Castling rights</legend>
          <p className="setup-note">Allow only if the king and rook have never moved.</p>
          <div className="castling-options">
            {CASTLING_OPTIONS.map(({ right, label }) => {
              const available = availableCastlingRights(position).includes(right);
              return <label key={right} className="castling-option">
                <input type="checkbox" checked={available && castlingRights.includes(right)} disabled={!available}
                  onChange={(event) => setCastlingRights((current) => event.target.checked ? current + right : current.replace(right, ""))} />
                {label}
              </label>;
            })}
          </div>
        </fieldset>
        <div className="panel-section board-actions">
          <button type="button" className="button-secondary" onClick={() => setBoardOrientation((current) => current === "white" ? "black" : "white")}><Icon name="flip" />Flip board</button>
          <button type="button" className="button-secondary" onClick={() => {
            setPosition(fenToPosition(STANDARD_FEN)); setCastlingRights("KQkq"); setSide("w"); setError(null); setRemoving(false);
          }}><Icon name="reset" />Reset position</button>
        </div>
        <div className="start-actions">
          {error && <p className="error-message" role="alert">{error}</p>}
          <button type="button" className="button-primary" onClick={startTraining}>Start training <Icon name="arrow" /></button>
          <p className="start-note">Your moves are checked against Stockfish’s best move. Hints are available as you practice.</p>
        </div>
      </aside>
    </section>
  );
}
