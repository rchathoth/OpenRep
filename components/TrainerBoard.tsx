"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useBoardTap } from "@/components/useBoardTap";
import { boardAppearance } from "@/components/boardAppearance";
import ErrorOverlay from "@/components/ErrorOverlay";
import SuccessOverlay from "@/components/SuccessOverlay";
import { applyUci, getExpectedMove, toUci } from "@/lib/training";
import { getOpponentMove } from "@/lib/opponent";
import { getCompletionReason, MAX_TRAINING_PLIES } from "@/lib/session";
import TrainingCompleteDialog from "@/components/TrainingCompleteDialog";
import { EngineClient } from "@/lib/engine/engine-client";
import type { EngineStatus } from "@/lib/engine/types";
import { ENGINE_ASSET_PATH } from "@/lib/engine/settings";
import { classifyHint, hintText, parseMoveHint, type HintClassification, type HintStage } from "@/lib/hints";

type TrainerBoardProps = { startingFen: string; playerSide: "w" | "b"; boardOrientation: "white" | "black"; onBackToSetup: () => void };
type Phase = "ready" | "checking" | "replying" | "error";

export default function TrainerBoard(props: TrainerBoardProps) {
  // A new position/side owns a new game and engine lifetime.
  return <TrainingSession key={`${props.startingFen}:${props.playerSide}`} {...props} />;
}

function TrainingSession({ startingFen, playerSide, boardOrientation, onBackToSetup }: TrainerBoardProps) {
  // Preserve move history so repetition and other game-over rules still work.
  const game = useRef(new Chess(startingFen));
  const [snapshot, setSnapshot] = useState(() => {
    const initial = new Chess(startingFen);
    return { fen: startingFen, completionReason: getCompletionReason(initial), plies: 0 };
  });
  const { fen, completionReason, plies } = snapshot;
  const complete = completionReason !== null;
  const initiallyDepthComplete = completionReason === "depth-limit";
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const engine = useRef<EngineClient | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("starting");
  const expectedCache = useRef<{ fen: string; move: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showError, setShowError] = useState(false);
  const [hint, setHint] = useState<HintClassification | null>(null);
  const [hintStage, setHintStage] = useState<HintStage>(0);
  const [expectedMove, setExpectedMove] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [promotion, setPromotion] = useState("q");
  const [message, setMessage] = useState("Find the engine's best move.");
  const [completionDialogOpen, setCompletionDialogOpen] = useState(initiallyDepthComplete);
  const completionDialogShown = useRef(initiallyDepthComplete);
  const setupButton = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  const hintAbort = useRef<AbortController | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publish = useCallback(() => {
    setSelectedSquare(null);
    const reason = getCompletionReason(game.current);
    setSnapshot({ fen: game.current.fen(), completionReason: reason, plies: game.current.history().length });
    if (reason) {
      setPhase("ready");
      setHint(null);
      setHintStage(0);
      setExpectedMove(null);
      pending.current?.abort();
      engine.current?.stop();
      if (reason === "depth-limit" && !completionDialogShown.current) {
        completionDialogShown.current = true;
        setCompletionDialogOpen(true);
      }
    }
  }, []);
  const busy = engineStatus === "starting" || phase === "checking" || phase === "replying";
  const unavailable = engineStatus === "unavailable";
  const playerTurn = new Chess(fen).turn() === playerSide;

  const expectedForPosition = useCallback(async (signal: AbortSignal) => {
    signal.throwIfAborted();
    const position = game.current.fen();
    if (expectedCache.current?.fen === position) return expectedCache.current.move;
    if (!engine.current) throw new Error("Engine unavailable; reload to retry.");
    const move = await getExpectedMove(game.current, signal, engine.current);
    expectedCache.current = { fen: position, move };
    return move;
  }, []);

  const reply = useCallback(async (controller: AbortController) => {
    if (controller.signal.aborted || getCompletionReason(game.current)) return;
    const before = game.current.fen();
    setPhase("replying");
    setMessage("Choosing an opponent reply…");
    const moveEngine = engine.current;
    if (!moveEngine) throw new Error("Engine unavailable; reload to retry.");
    const result = await getOpponentMove(game.current, controller.signal, moveEngine);
    if (controller.signal.aborted || game.current.fen() !== before || getCompletionReason(game.current)) return;
    const move = result.move;
    applyUci(game.current, move);
    setHintStage(0);
    setExpectedMove(null);
    publish();
    setMessage("Your turn — find the strongest move.");
  }, [publish]);

  const run = useCallback(async (action: (controller: AbortController) => Promise<void>) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    try {
      await action(controller);
      if (!controller.signal.aborted) setPhase("ready");
    } catch (error) {
      if (!controller.signal.aborted && !getCompletionReason(game.current)) {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Engine search failed. Please retry.");
      }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, []);

  const handleHint = useCallback(async () => {
    if (busy || unavailable || getCompletionReason(game.current) || !playerTurn || hintLoading || hintAbort.current || pending.current) return;
    if (hintStage === 1) {
      setHintStage(2);
      return;
    }
    if (hintStage === 2) {
      setHintStage(0);
      return;
    }
    // hintStage === 0
    if (expectedMove) {
      setHintStage(1);
      return;
    }
    const controller = new AbortController();
    hintAbort.current = controller;
    setHintLoading(true);
    try {
      const move = await expectedForPosition(controller.signal);
      if (controller.signal.aborted) return;
      setExpectedMove(move);
      setHintStage(1);
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessage(error instanceof Error ? error.message : "Could not get a hint. Please retry.");
      }
    } finally {
      if (hintAbort.current === controller) {
        hintAbort.current = null;
        setHintLoading(false);
      }
    }
  }, [busy, unavailable, playerTurn, hintLoading, hintStage, expectedMove, expectedForPosition]);

  useEffect(() => {
    let mounted = true;
    const client = new EngineClient({ onStatus: (status) => { if (mounted) setEngineStatus(status); } });
    engine.current = client;
    // Covers starting as Black or from any opponent-to-move position.
    void client.initialize().then(() => {
      if (!mounted || game.current.turn() === playerSide || getCompletionReason(game.current)) return;
      if (document.visibilityState === "hidden") {
        setPhase("error");
        setMessage("Engine search paused while this tab was hidden. Please retry.");
      } else void run(reply);
    }).catch((error) => {
      if (mounted) { setPhase("error"); setMessage(error.message); }
    });
    const pause = () => {
      if (document.visibilityState !== "hidden") return;
      const interrupted = pending.current || hintAbort.current;
      pending.current?.abort();
      pending.current = null;
      hintAbort.current?.abort();
      hintAbort.current = null;
      client.stop();
      if (interrupted && !getCompletionReason(game.current)) {
        setHintLoading(false);
        setPhase("error");
        setMessage("Engine search paused while this tab was hidden. Please retry.");
      }
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", pause);
      pending.current?.abort();
      pending.current = null;
      hintAbort.current?.abort();
      hintAbort.current = null;
      if (successTimer.current) clearTimeout(successTimer.current);
      client.dispose();
      if (engine.current === client) engine.current = null;
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, [playerSide, reply, run]);

  function attemptMove(sourceSquare: string, targetSquare: string | null) {
    setSelectedSquare(null);
    if (!targetSquare || busy || unavailable || pending.current || getCompletionReason(game.current) || !playerTurn) return false;
    const before = game.current.fen();
    let attempted: string;
    try { attempted = toUci(new Chess(before).move({ from: sourceSquare, to: targetSquare, promotion })); }
    catch { setMessage("That move is not legal in this position."); return false; }
    setShowError(false);
    setShowSuccess(false);
    if (successTimer.current) clearTimeout(successTimer.current);
    hintAbort.current?.abort();
    setHintLoading(false);
    void run(async (controller) => {
      setPhase("checking");
      setMessage("Checking your move…");
      const expected = await expectedForPosition(controller.signal);
      if (controller.signal.aborted) return;
      setExpectedMove(expected);
      if (attempted !== expected) {
        // Preserve the first conceptual hint for this unchanged position.
        setHint((current) => current ?? classifyHint(before, expected));
        setShowError(true);
        setMessage("Incorrect move. Try the strongest move.");
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = setTimeout(() => setShowError(false), 900);
        return;
      }
      setShowSuccess(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setShowSuccess(false), 900);
      applyUci(game.current, attempted);
      setHint(null);
      setHintStage(0);
      setExpectedMove(null);
      publish();
      if (getCompletionReason(game.current)) return;
      // Validate, commit, then await the NEW position's reply under one lock.
      await reply(controller);
    });
    // Controlled board changes only after successful validation.
    return false;
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    return attemptMove(sourceSquare, targetSquare);
  }

  function onSquareClick({ square }: { square: string }) {
    if (busy || unavailable || pending.current || complete || !playerTurn || hintLoading || hintAbort.current) return;
    if (square === selectedSquare) { setSelectedSquare(null); return; }
    const piece = game.current.get(square as Parameters<Chess["get"]>[0]);
    if (piece?.color === playerSide) { setSelectedSquare(square); return; }
    if (selectedSquare) attemptMove(selectedSquare, square);
  }

  const boardTap = useBoardTap(onSquareClick);

  const moveHint = expectedMove ? parseMoveHint(expectedMove) : null;
  const arrows = hintStage === 2 && moveHint ? [
    {
      startSquare: moveHint.fromSquare,
      endSquare: moveHint.toSquare,
      color: "rgb(245, 158, 11)",
    },
  ] : [];

  const squareRenderer = useCallback(({ square, children }: { square: string; children?: React.ReactNode }) => {
    const isSelected = selectedSquare === square;
    const isHighlighted = hintStage >= 1 && moveHint?.fromSquare === square;
    return (
      <div
        data-selected={isSelected ? "true" : undefined}
        data-highlighted={isHighlighted ? "true" : undefined}
        className={isHighlighted ? "hint-highlighted-square" : undefined}
        style={{
          width: "100%",
          height: "100%",
          outline: isSelected ? "3px solid var(--accent)" : undefined,
          outlineOffset: "-6px",
          ...(isHighlighted ? {
            backgroundColor: "rgba(245, 158, 11, 0.45)",
            boxShadow: "inset 0 0 0 3px #f59e0b",
            borderRadius: "4px",
          } : {}),
        }}
      >
        {children}
      </div>
    );
  }, [hintStage, moveHint, selectedSquare]);

  const statusKind = complete ? "complete" : unavailable || phase === "error" ? "error" : engineStatus === "starting" ? "starting" : hintLoading ? "thinking" : phase === "checking" ? "checking" : phase === "replying" ? "replying" : message.startsWith("Incorrect") || message.startsWith("That move") ? "incorrect" : "ready";
  const statusTitle = { complete: completionReason === "depth-limit" ? "Practice depth reached" : "Session complete", error: "Needs attention", starting: "Starting engine", thinking: "Finding a hint", checking: "Checking your move", replying: "Opponent’s turn", incorrect: "Try again", ready: "Your turn" }[statusKind];

  return <section className="workspace" aria-labelledby="training-title">
    <div className="board-column">
      <div className="screen-heading">
        <h2 id="training-title">Find the strongest move</h2>
        <p>Drag a piece, or tap it and then its destination.</p>
      </div>
      <div className="board-shell" {...boardTap.handlers}
        data-fen={fen}
        data-engine-status={engineStatus}
        data-hint-stage={hintStage}
        data-hint-piece={hintStage >= 1 && moveHint ? moveHint.fromSquare : undefined}
        data-hint-move={hintStage >= 2 && expectedMove ? expectedMove : undefined}
      >
        <Chessboard options={{
          ...boardAppearance,
          id: "trainer-board",
          position: fen,
          boardOrientation,
          onPieceDrop,
          onSquareClick: boardTap.onSquareClick,
          onPieceDrag: () => setSelectedSquare(null),
          allowDragging: !busy && !unavailable && !complete && playerTurn,
          squareRenderer,
          arrows,
        }} />
        <ErrorOverlay visible={showError} />
        <SuccessOverlay visible={showSuccess} />
        {!complete && (busy || hintLoading) && <div className="board-status">{engineStatus === "starting" ? "Starting engine…" : phase === "checking" ? "Checking your move…" : "Choosing an opponent reply…"}</div>}
      </div>
    </div>
    <aside className="control-panel training-panel" aria-label="Training controls">
      <div className="session-summary">
        <span className="side-badge">Playing {playerSide === "w" ? "White" : "Black"}</span>
        <p className="setup-note">{plies} / {MAX_TRAINING_PLIES} half-moves practiced · {complete ? (completionReason === "depth-limit" ? "Practice depth reached" : completionReason) : `${playerTurn ? "Your" : "Opponent's"} turn`}</p>
      </div>
      <div className={`status-card status-${statusKind}`} aria-live="polite" aria-atomic="true">
        <h3><span className={busy || hintLoading ? "status-dot loading" : "status-dot"} />{statusTitle}</h3>
        <p>{complete ? completionReason === "depth-limit" ? "Practice depth reached — 10 moves practiced." : `Training complete — ${completionReason}.` : unavailable ? "Engine unavailable; reload to retry." : engineStatus === "starting" ? "Starting engine…" : hintLoading ? "Finding the best move for your hint…" : message}</p>
        {phase === "error" && !unavailable && !complete && <div className="retry-row">
          <p className="setup-note">{playerTurn ? "Your move was not accepted. Try it again to retry the engine search." : "Your move was accepted. Retry to play the engine reply."}</p>
          {!playerTurn && <button type="button" className="button-secondary" onClick={() => void run(reply)}>Retry opponent reply</button>}
        </div>}
      </div>
      <div className="panel-section">
        <div className="hint-controls">
          <button type="button" className="button-secondary" onClick={() => void handleHint()}
            disabled={busy || unavailable || complete || !playerTurn || hintLoading}
            aria-label="Hint" data-hint-stage={hintStage}>{hintLoading ? "Hint…" : "Hint"}</button>
          <span className="setup-note">{["No visual hint", "Piece highlighted", "Move shown"][hintStage]}</span>
        </div>
        <div role="status" aria-label="Hint" aria-atomic="true">
          {hint && !complete && <p className="hint-card"><strong>Hint</strong> {hintText(hint)}</p>}
        </div>
      </div>
      <div className="panel-section">
        <label className="control-label promotion-control">Promote to
          <select className="select-control" aria-label="Promotion piece" value={promotion} disabled={busy || complete} onChange={(event) => setPromotion(event.target.value)}>
            <option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option>
          </select>
        </label>
      </div>
      <button ref={setupButton} type="button" className={complete ? "button-primary" : "button-secondary"} onClick={() => { setSelectedSquare(null); onBackToSetup(); }}>Setup</button>
      <p className="engine-footer">Stockfish 19 · <a href={`${ENGINE_ASSET_PATH}/COPYING.txt`} target="_blank" rel="noreferrer">GPLv3</a> · <a href={`${ENGINE_ASSET_PATH}/SOURCE.txt`} target="_blank" rel="noreferrer">Source code &amp; notices</a></p>
    </aside>
    <TrainingCompleteDialog open={completionDialogOpen} onPracticeDifferentLines={onBackToSetup}
      onReview={() => setCompletionDialogOpen(false)} returnFocusRef={setupButton} />
  </section>;
}
