export type EngineSettings = {
  movetime: number;
  depth?: number;
  threads: number;
  hashMb: number;
};

export type EngineRequest = { fen: string; movetime?: number; signal?: AbortSignal };
export type EngineStatus = "starting" | "ready" | "thinking" | "unavailable";
export type EngineCommand =
  | { type: "init"; settings: EngineSettings }
  | { type: "search"; id: number; fen: string; movetime: number; depth?: number }
  | { type: "stop"; id: number };
export type EngineEvent =
  | { type: "ready" }
  | { type: "result"; id: number; move: string }
  | { type: "error"; id?: number; message: string };

export interface MoveEngine {
  findBestMove(request: EngineRequest): Promise<string>;
}
