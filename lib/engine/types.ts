export type EngineSettings = {
  movetime: number;
  depth?: number;
  threads: number;
  hashMb: number;
};

export type EngineRequest = { fen: string; movetime?: number; signal?: AbortSignal };
// UCI scores are relative to the side to move, including on Black's turns.
export type EngineScore = { type: "cp" | "mate"; value: number };
export type EngineLine = { move: string; score?: EngineScore };
export type EngineAnalysis = { move: string; lines: EngineLine[] };
export type CandidateRequest = EngineRequest & { multiPV: number };
export interface CandidateEngine {
  findCandidateMoves(request: CandidateRequest): Promise<EngineAnalysis>;
}
export type EngineStatus = "starting" | "ready" | "thinking" | "unavailable";
export type EngineCommand =
  | { type: "init"; settings: EngineSettings }
  | { type: "search"; id: number; fen: string; movetime: number; depth?: number; multiPV?: number }
  | { type: "stop"; id: number };
export type EngineEvent =
  | { type: "ready" }
  | { type: "result"; id: number; move: string; lines?: EngineLine[] }
  | { type: "error"; id?: number; message: string };

export interface MoveEngine {
  findBestMove(request: EngineRequest): Promise<string>;
}
