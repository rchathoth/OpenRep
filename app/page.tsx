"use client";

import { useCallback, useEffect, useState } from "react";
import PositionSetup from "@/components/PositionSetup";
import TrainerBoard from "@/components/TrainerBoard";
import { BrandMark } from "@/components/Brand";
import { addCompletedLine, readSavedLines, writeSavedLines, type SavedLine } from "@/lib/saved-lines";

type Screen = { kind: "home" } | { kind: "setup" } | { kind: "training"; line: SavedLine; session: number };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [lines, setLines] = useState<SavedLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      try { setLines(readSavedLines()); setError(null); }
      catch { setError("Saved positions are unavailable. Check your browser storage settings."); }
      setLoaded(true);
    }
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const update = useCallback((change: (current: SavedLine[]) => SavedLine[]) => {
    try {
      const next = change(readSavedLines());
      writeSavedLines(next);
      setLines(next);
      setError(null);
      return true;
    } catch {
      setError("Could not save your changes. Check your browser storage settings and try again.");
      return false;
    }
  }, []);

  function createLine(name: string, fen: string, playerSide: "w" | "b", boardOrientation: "white" | "black") {
    const line: SavedLine = { id: crypto.randomUUID(), name, fen, playerSide, boardOrientation, completedLines: [] };
    if (update((current) => [...current, line])) setScreen({ kind: "training", line, session: 0 });
  }

  const home = () => setScreen({ kind: "home" });
  return <div className="app-main">
    <a className="skip-link" href="#practice">Skip to main content</a>
    <header className="app-header"><div className="header-inner">
      <a className="brand" href="#practice" onClick={home} aria-label="Open Rep — home"><BrandMark className="brand-mark" /><span className="wordmark">open rep<span className="brand-period">.</span></span></a>
      <nav className="app-nav" aria-label="Main navigation"><a href="#practice" onClick={home} aria-current={screen.kind === "home" ? "page" : undefined}>Your lines</a></nav>
      <details className="practice-guide"><summary>How to practice</summary><div className="guide-content"><h2>A little repetition goes a long way.</h2><ol><li>Build a position and choose your side.</li><li>Find Stockfish’s best move. Use a hint when you need one.</li><li>Practice against varied replies and discover different lines.</li></ol><p>Each session runs for up to five full moves.</p></div></details>
    </div></header>
    <main id="practice" className="app-frame" tabIndex={-1}>
      <div className="page-heading"><div><h1>{screen.kind === "home" ? "Your opening practice." : screen.kind === "setup" ? "Build your line." : "Make the next move count."}</h1><p>{screen.kind === "home" ? "Pick up where you left off, or start something new." : screen.kind === "setup" ? "Choose a position, give it a name, and make it yours." : `Practicing ${screen.line.name}. Find the strongest move.`}</p></div><span className="stage-label"><span aria-hidden="true" />{screen.kind === "home" ? "Your lines" : screen.kind === "setup" ? "Position setup" : "Training session"}</span></div>
      {error && <p className="error-message storage-error" role="alert">{error}</p>}
      {screen.kind === "home" && <section className="home-panel" aria-labelledby="your-lines-title">
        <div className="home-intro"><div><p className="home-eyebrow">A little repetition goes a long way</p><h2 id="your-lines-title">Your lines</h2><p>Save a starting position and explore its possibilities, one move at a time.</p></div><button type="button" className="button-primary" onClick={() => setScreen({ kind: "setup" })}>Build your line <span aria-hidden="true">→</span></button></div>
        {!loaded ? <p className="home-empty">Loading your positions…</p> : lines.length === 0 ? <div className="home-empty"><strong>No saved positions yet.</strong><p>Build your first line to start practicing.</p></div> : <ul className="saved-lines">{lines.map((line) => <li className="saved-line" key={line.id}>
          <div className="saved-line-info">{renaming === line.id ? <form onSubmit={(event) => { event.preventDefault(); const name = newName.trim(); if (name && update((current) => current.map((item) => item.id === line.id ? { ...item, name } : item))) setRenaming(null); }}><label className="control-label">Position name<input autoFocus className="select-control" maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} required /></label><div className="saved-actions"><button className="button-primary" type="submit">Save name</button><button className="button-secondary" type="button" onClick={() => setRenaming(null)}>Cancel</button></div></form> : <><h3>{line.name}</h3><p>Play {line.playerSide === "w" ? "White" : "Black"} <span aria-hidden="true">·</span> {line.completedLines.length} {line.completedLines.length === 1 ? "line" : "lines"} completed</p></>}</div>
          {renaming !== line.id && <div className="saved-actions"><button type="button" className="button-primary" onClick={() => setScreen({ kind: "training", line, session: 0 })}>Practice</button><button type="button" className="button-secondary" onClick={() => { setRenaming(line.id); setNewName(line.name); }} aria-label={`Rename ${line.name}`}>Rename</button>{deleting === line.id ? <><span>Delete this position and its progress?</span><button type="button" className="button-secondary" onClick={() => { if (update((current) => current.filter((item) => item.id !== line.id))) setDeleting(null); }}>Confirm delete</button><button type="button" className="button-secondary" onClick={() => setDeleting(null)}>Cancel</button></> : <button type="button" className="button-secondary" onClick={() => setDeleting(line.id)} aria-label={`Delete ${line.name}`}>Delete</button>}</div>}
        </li>)}</ul>}
        <p className="storage-note">Positions and progress are saved in this browser on this device.</p>
      </section>}
      {screen.kind === "setup" && <PositionSetup onStartTraining={createLine} onBack={home} />}
      {screen.kind === "training" && <TrainerBoard key={`${screen.line.id}:${screen.session}`} startingFen={screen.line.fen} playerSide={screen.line.playerSide} boardOrientation={screen.line.boardOrientation} onBackToSetup={home} onPracticeAgain={() => setScreen({ ...screen, session: screen.session + 1 })} onComplete={(moves) => { update((current) => addCompletedLine(current, screen.line.id, moves)); }} />}
      <footer className="workspace-footer"><span>Good moves come with practice.</span><span>Opening theory, put into practice.</span></footer>
    </main>
  </div>;
}
