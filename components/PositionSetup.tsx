"use client";

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

  return (
    <section className="space-y-5">
      <p className="setup-note">
        Drag pieces to arrange the position. Choose a piece below to add it; right-click to remove.
      </p>
      <div className="board-shell">
        <Chessboard
          options={{
            position,
            boardOrientation,
            onPieceDrop,
            onSquareClick: ({ square }) =>
              setPosition((current) => ({ ...current, [square]: { pieceType: selectedPiece } })),
            onSquareRightClick: ({ square }) =>
              setPosition((current) => {
                const next = { ...current };
                delete next[square];
                return next;
              }),
            allowDragOffBoard: true,
            boardStyle: { borderRadius: "12px" },
          }}
        />
      </div>
      <div className="setup-controls">
        <div className="piece-palette-wrap">
          <div className="piece-header">
            <p className="control-label">Piece to place</p>
            <span className="piece-active-name">{PIECE_NAMES[selectedPiece]}</span>
          </div>
          <div className="piece-palette" role="group" aria-label="Pieces to place">
            {palette.map((piece) => {
              const PieceIcon = defaultPieces[piece];
              return (
                <button
                  key={piece}
                  type="button"
                  className={selectedPiece === piece ? "piece-choice active" : "piece-choice"}
                  onClick={() => setSelectedPiece(piece)}
                  aria-label={`Place ${piece}`}
                  aria-pressed={selectedPiece === piece}
                  title={PIECE_NAMES[piece]}
                >
                  <span className="piece-svg-wrap">
                    {PieceIcon ? (
                      <PieceIcon />
                    ) : (
                      <span className={`piece-icon ${piece[0] === "w" ? "white" : "black"}`}>
                        {piece[1]}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="control-label">
            I play
            <select
              value={playerSide}
              onChange={(event) => {
                const next = event.target.value as Side;
                setPlayerSide(next);
                setBoardOrientation(next === "w" ? "white" : "black");
              }}
              className="select-control"
            >
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </label>
          <label className="control-label">
            Side to move
            <select
              value={side}
              onChange={(event) => setSide(event.target.value as Side)}
              className="select-control"
            >
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </label>
          <button
            className="button-secondary"
            onClick={() => setBoardOrientation((current) => (current === "white" ? "black" : "white"))}
          >
            Flip board
          </button>
          <button
            className="button-secondary"
            onClick={() => {
              setPosition(fenToPosition(STANDARD_FEN));
              setSide("w");
              setError(null);
            }}
          >
            Reset position
          </button>
          <button className="button-primary" onClick={startTraining}>
            Start training <span aria-hidden>→</span>
          </button>
        </div>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  );
}
