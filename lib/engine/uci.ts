import { validateMovetime, validateSettings } from "./settings.ts";
import type { EngineCommand, EngineEvent, EngineLine, EngineSettings } from "./types.ts";

export function searchCommands(fen: string, movetime: number, depth?: number) {
  // Only framing belongs here. The training domain validates chess legality.
  if (typeof fen !== "string" || fen.length > 200 || /[\r\n]/.test(fen) || fen.trim().split(/\s+/).length !== 6) {
    throw new Error("The engine requires a single FEN position.");
  }
  validateMovetime(movetime);
  if (depth !== undefined && (!Number.isInteger(depth) || depth < 1 || depth > 128)) throw new Error("Invalid engine depth.");
  return [`position fen ${fen}`, `go movetime ${movetime}${depth === undefined ? "" : ` depth ${depth}`}`];
}

export function parseBestMove(line: string): string | undefined {
  if (!/^bestmove(?:\s|$)/.test(line.trim())) return undefined;
  const match = /^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)(?:\s+ponder\s+[a-h][1-8][a-h][1-8][qrbn]?)?$/.exec(line.trim());
  if (!match) throw new Error("Stockfish returned no usable best move.");
  return match[1];
}

/** Ignore bounds: they are not exact scores suitable for a 100cp comparison. */
export function parseInfoLine(line: string): { depth: number; rank: number; line: EngineLine } | undefined {
  if (!line.startsWith("info ")) return;
  const depth = /\bdepth (\d+)\b/.exec(line);
  const rank = /\bmultipv (\d+)\b/.exec(line);
  const pv = /\bpv ([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/.exec(line);
  if (!depth || !pv) return;
  const score = /\bscore (cp|mate) (-?\d+)\b/.exec(line);
  const exact = score && !/\b(?:lowerbound|upperbound)\b/.test(line);
  return {
    depth: Number(depth[1]), rank: rank ? Number(rank[1]) : 1,
    line: { move: pv[1], ...(exact ? { score: { type: score[1] as "cp" | "mate", value: Number(score[2]) } } : {}) },
  };
}

// Runs in the adapter worker. UCI has no request IDs, so a stopped search must
// emit its final bestmove before the client is allowed to start another search.
export class UciSession {
  private settings?: EngineSettings;
  private stage: "new" | "uci" | "readying" | "ready" = "new";
  private activeId?: number;
  private multiPV = 1;
  private pendingDepth = -1;
  private pendingLines = new Map<number, EngineLine>();
  private completedDepth = -1;
  private completedLines: EngineLine[] = [];
  private send: (command: string) => void;
  private emit: (event: EngineEvent) => void;

  constructor(send: (command: string) => void, emit: (event: EngineEvent) => void) {
    this.send = send;
    this.emit = emit;
  }

  command(message: EngineCommand) {
    if (message.type === "init") {
      if (this.stage !== "new") throw new Error("Engine already initialized.");
      validateSettings(message.settings);
      this.settings = message.settings;
      this.stage = "uci";
      this.send("uci");
    } else if (message.type === "stop") {
      if (message.id === this.activeId) this.send("stop");
    } else {
      if (this.stage !== "ready" || this.activeId !== undefined) throw new Error("Engine is busy or not ready.");
      const commands = searchCommands(message.fen, message.movetime, message.depth);
      const multiPV = message.multiPV ?? 1;
      if (!Number.isInteger(multiPV) || multiPV < 1 || multiPV > 5) throw new Error("Invalid MultiPV count.");
      this.multiPV = multiPV;
      this.pendingDepth = this.completedDepth = -1;
      this.pendingLines.clear();
      this.completedLines = [];
      this.send(`setoption name MultiPV value ${multiPV}`);
      this.activeId = message.id;
      commands.forEach(this.send);
    }
  }

  line(output: string) {
    for (const line of output.split(/\r?\n/).map((line) => line.trim())) {
      if (line === "uciok" && this.stage === "uci") {
        this.stage = "readying";
        this.send("setoption name Threads value 1");
        this.send(`setoption name Hash value ${this.settings!.hashMb}`);
        this.send("setoption name MultiPV value 1");
        this.send("setoption name UCI_Chess960 value false");
        this.send("isready");
      } else if (line === "readyok" && this.stage === "readying") {
        this.stage = "ready";
        this.emit({ type: "ready" });
      } else if (this.activeId !== undefined) {
        const id = this.activeId;
        try {
          const info = parseInfoLine(line);
          if (info && info.rank >= 1 && info.rank <= this.multiPV && info.depth >= this.pendingDepth) {
            if (info.depth > this.pendingDepth) {
              this.pendingDepth = info.depth;
              this.pendingLines.clear();
            }
            this.pendingLines.set(info.rank, info.line);
            if (this.pendingLines.size === this.multiPV && info.depth >= this.completedDepth) {
              this.completedDepth = info.depth;
              this.completedLines = Array.from({ length: this.multiPV }, (_, index) => this.pendingLines.get(index + 1)!);
            }
          }
          const move = parseBestMove(line);
          if (move !== undefined) {
            this.activeId = undefined;
            this.emit({ type: "result", id, move, ...(this.multiPV > 1 ? { lines: this.completedLines } : {}) });
          }
        } catch (error) {
          this.activeId = undefined;
          this.emit({ type: "error", id, message: (error as Error).message });
        }
      }
    }
  }
}
