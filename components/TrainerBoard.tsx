"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import ErrorOverlay from "@/components/ErrorOverlay";
import { applyUci, expectedMoveFor, toUci } from "@/lib/training";

type TrainerBoardProps = { startingFen: string; playerSide: "w" | "b"; boardOrientation: "white" | "black"; onBackToSetup: () => void };
type Phase = "ready" | "checking" | "replying" | "error";

export default function TrainerBoard({ startingFen, playerSide, boardOrientation, onBackToSetup }: TrainerBoardProps) {
  // Preserve move history so repetition and other game-over rules still work.
  const game = useRef(new Chess(startingFen));
  const [snapshot, setSnapshot] = useState(() => ({ fen: startingFen, complete: new Chess(startingFen).isGameOver(), mate: new Chess(startingFen).isCheckmate(), plies: 0 }));
  const { fen, complete, mate, plies } = snapshot;
  const publish = useCallback(() => {
    setSnapshot({ fen: game.current.fen(), complete: game.current.isGameOver(), mate: game.current.isCheckmate(), plies: game.current.history().length });
  }, []);
  const [phase, setPhase] = useState<Phase>("ready");
  const [showError, setShowError] = useState(false);
  const [promotion, setPromotion] = useState("q");
  const [message, setMessage] = useState("Find the engine's best move.");
  const pending = useRef<AbortController | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = phase === "checking" || phase === "replying";
  const playerTurn = new Chess(fen).turn() === playerSide;

  const reply = useCallback(async (controller: AbortController) => {
    if (game.current.isGameOver()) return;
    setPhase("replying");
    setMessage("The engine is choosing its best reply…");
    const move = await expectedMoveFor(game.current.fen(), controller.signal);
    if (controller.signal.aborted) return;
    applyUci(game.current, move);
    publish();
    setMessage("Your turn — find the engine's best move.");
  }, [publish]);

  const run = useCallback(async (action: (controller: AbortController) => Promise<void>) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    try {
      await action(controller);
      if (!controller.signal.aborted) setPhase("ready");
    } catch (error) {
      if (!controller.signal.aborted) {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Evaluation failed. Please retry.");
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, []);

  useEffect(() => {
    // Covers starting as Black or from any opponent-to-move position.
    if (game.current.turn() !== playerSide && !game.current.isGameOver()) void run(reply);
    return () => {
      pending.current?.abort();
      pending.current = null;
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, [playerSide, reply, run]);

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare || pending.current || complete || !playerTurn) return false;
    const before = game.current.fen();
    let attempted: string;
    try { attempted = toUci(new Chess(before).move({ from: sourceSquare, to: targetSquare, promotion })); }
    catch { setMessage("That move is not legal in this position."); return false; }
    setShowError(false);
    void run(async (controller) => {
      setPhase("checking");
      setMessage("Checking your move…");
      const expected = await expectedMoveFor(before, controller.signal);
      if (controller.signal.aborted) return;
      if (attempted !== expected) {
        setShowError(true);
        setMessage("Incorrect move. Try the strongest move.");
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = setTimeout(() => setShowError(false), 900);
        return;
      }
      applyUci(game.current, attempted);
      publish();
      // Validate, commit, then await the NEW position's reply under one lock.
      await reply(controller);
    });
    // Controlled board changes only after successful validation.
    return false;
  }

  return <section className="space-y-5">
    <div className="trainer-bar"><span>Playing {playerSide === "w" ? "White" : "Black"}</span><button className="button-secondary" onClick={onBackToSetup}>Setup</button></div>
    <div className="board-shell" data-fen={fen}><Chessboard options={{ position: fen, boardOrientation, onPieceDrop, allowDragging: !busy && !complete && playerTurn, boardStyle: { borderRadius: "8px" } }} /><ErrorOverlay visible={showError} />{busy && <div className="board-status">{phase === "checking" ? "Checking move…" : "Engine is thinking…"}</div>}</div>
    <div className="status-card" aria-live="polite"><span className={busy ? "status-dot loading" : "status-dot"} /><p>{complete ? `Training complete — ${mate ? "checkmate" : "draw"}.` : message}</p></div>
    {phase === "error" && !complete && <div className="retry-row"><p className="setup-note">{playerTurn ? "Your move was not accepted. Try it again to retry evaluation." : "Your move was accepted. Retry to play the engine reply."}</p>{!playerTurn && <button className="button-secondary" onClick={() => void run(reply)}>Retry engine reply</button>}</div>}
    <div className="trainer-bar"><span>{plies} half-moves played · {complete ? "Game over" : `${playerTurn ? "Your" : "Engine's"} turn`}</span><label className="promotion-control">Promote to <select aria-label="Promotion piece" value={promotion} disabled={busy} onChange={(event) => setPromotion(event.target.value)}><option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option></select></label></div>
  </section>;
}
