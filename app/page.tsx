"use client";
import { useState } from "react";
import PositionSetup from "@/components/PositionSetup";
import TrainerBoard from "@/components/TrainerBoard";
import { BrandMark, PracticeIllustration } from "@/components/Brand";

export default function Home() {
  const [training, setTraining] = useState<{ fen: string; playerSide: "w" | "b"; boardOrientation: "white" | "black" } | null>(null);
  return (
    <div className="app-main">
      <a className="skip-link" href="#practice">Skip to practice</a>
      <div className="app-frame">
        <header className="app-header">
          <a className="brand" href="#practice" aria-label="Open Rep — practice">
            <span className="brand-tile"><BrandMark /></span>
            <span className="wordmark">open rep<span className="brand-period">.</span></span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <a href="#practice" className="nav-practice">Practice</a>
            <a href="#method">The method</a>
          </nav>
          <span className="phase-badge"><span aria-hidden="true" />{training ? "In practice" : "Chess, with intention"}</span>
        </header>

        <main id="practice" tabIndex={-1}>
          <div className={`intro${training ? " intro-training" : ""}`}>
            <div className="intro-copy">
              <p className="eyebrow">YOUR DAILY REPERTOIRE PRACTICE</p>
              <h1>{training ? <>One move.<br /><em>A little stronger.</em></> : <>Good moves.<br /><em>Made a habit.</em></>}</h1>
              <p className="intro-description">{training ? "Take your time. Find the move that makes the position yours." : "Build a repertoire you can rely on. One thoughtful move at a time."}</p>
            </div>
            <PracticeIllustration />
          </div>
          {training ? <TrainerBoard key={training.fen} startingFen={training.fen} playerSide={training.playerSide} boardOrientation={training.boardOrientation} onBackToSetup={() => setTraining(null)} /> : <PositionSetup onStartTraining={(fen, playerSide, boardOrientation) => setTraining({ fen, playerSide, boardOrientation })} />}
        </main>

        <section id="method" className="method-section" aria-labelledby="method-title">
          <div className="method-heading"><BrandMark /><div><p className="eyebrow">THE METHOD</p><h2 id="method-title">Small reps. Lasting instinct.</h2></div></div>
          <ol className="method-steps">
            <li><span>01</span><h3>Make it yours.</h3><p>Start from the opening, or set up a position you want to understand.</p></li>
            <li><span>02</span><h3>Find your move.</h3><p>Play the strongest move. Get a hint when you need a fresh perspective.</p></li>
            <li><span>03</span><h3>Come back stronger.</h3><p>Practice a line for 10 moves, then explore another. Repetition builds recall.</p></li>
          </ol>
        </section>
        <footer className="app-footer"><span className="footer-wordmark">open rep.</span><p>A little practice goes a long way.</p><span className="footer-note">Made for the next move.</span></footer>
      </div>
    </div>
  );
}
