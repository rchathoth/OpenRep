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
        </header>

        <main id="practice" tabIndex={-1}>
          <div className={`intro${training ? " intro-training" : ""}`}>
            <div className="intro-copy">
              <h1>{training ? <>One move.<br /><em>A little stronger.</em></> : <>Good moves.<br /><em>Made a habit.</em></>}</h1>
            </div>
            <PracticeIllustration />
          </div>
          {training ? <TrainerBoard key={training.fen} startingFen={training.fen} playerSide={training.playerSide} boardOrientation={training.boardOrientation} onBackToSetup={() => setTraining(null)} /> : <PositionSetup onStartTraining={(fen, playerSide, boardOrientation) => setTraining({ fen, playerSide, boardOrientation })} />}
        </main>

      </div>
    </div>
  );
}
