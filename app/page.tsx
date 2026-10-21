"use client";

import { useState } from "react";
import PositionSetup from "@/components/PositionSetup";
import TrainerBoard from "@/components/TrainerBoard";
import { BrandMark } from "@/components/Brand";

export default function Home() {
  const [training, setTraining] = useState<{ fen: string; playerSide: "w" | "b"; boardOrientation: "white" | "black" } | null>(null);
  return (
    <div className="app-main">
      <a className="skip-link" href="#practice">Skip to practice</a>
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#practice" aria-label="Open Rep — practice">
            <BrandMark className="brand-mark" />
            <span className="wordmark">open rep<span className="brand-period">.</span></span>
          </a>
          <nav className="app-nav" aria-label="Main navigation">
            <a href="#practice" aria-current="page">Opening practice</a>
          </nav>
          <details className="practice-guide">
            <summary>How to practice</summary>
            <div className="guide-content">
              <h2>A little repetition goes a long way.</h2>
              <ol>
                <li>Set a position and choose your side.</li>
                <li>Find Stockfish’s best move. Use a hint when you need one.</li>
                <li>Practice against varied replies, then review your line.</li>
              </ol>
              <p>Each session runs for up to ten full moves.</p>
            </div>
          </details>
        </div>
      </header>
      <main id="practice" className="app-frame" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <h1>{training ? "Make the next move count." : "Set up your next line."}</h1>
            <p>{training ? "Find the strongest move. Build your opening intuition." : "Choose a position. Practice finding the strongest move."}</p>
          </div>
          <span className="stage-label"><span aria-hidden="true" />{training ? "Training session" : "Position setup"}</span>
        </div>
        {training ? <TrainerBoard key={training.fen} startingFen={training.fen} playerSide={training.playerSide} boardOrientation={training.boardOrientation} onBackToSetup={() => setTraining(null)} /> : <PositionSetup onStartTraining={(fen, playerSide, boardOrientation) => setTraining({ fen, playerSide, boardOrientation })} />}
        <footer className="workspace-footer"><span>Good moves come with practice.</span><span>Opening theory, put into practice.</span></footer>
      </main>
    </div>
  );
}
