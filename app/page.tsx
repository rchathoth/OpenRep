"use client";
import { useState } from "react";
import PositionSetup from "@/components/PositionSetup";
import TrainerBoard from "@/components/TrainerBoard";

export default function Home() {
  const [training, setTraining] = useState<{ fen: string; playerSide: "w" | "b"; boardOrientation: "white" | "black" } | null>(null);
  return <main className="app-main"><div className="app-frame">
    <header className="app-header"><h1>OpenReps</h1><span>{training ? "Training" : "Setup"}</span></header>
    <div className="board-column">{training ? <TrainerBoard key={training.fen} startingFen={training.fen} playerSide={training.playerSide} boardOrientation={training.boardOrientation} onBackToSetup={() => setTraining(null)} /> : <PositionSetup onStartTraining={(fen, playerSide, boardOrientation) => setTraining({ fen, playerSide, boardOrientation })} />}</div>
  </div></main>;
}
