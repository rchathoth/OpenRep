import { validateMovetime, validateSettings } from "./settings.ts";
import type { EngineCommand, EngineEvent, EngineSettings } from "./types.ts";

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

// Runs in the adapter worker. UCI has no request IDs, so a stopped search must
// emit its final bestmove before the client is allowed to start another search.
export class UciSession {
  private settings?: EngineSettings;
  private stage: "new" | "uci" | "readying" | "ready" = "new";
  private activeId?: number;
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
          const move = parseBestMove(line);
          if (move !== undefined) {
            this.activeId = undefined;
            this.emit({ type: "result", id, move });
          }
        } catch (error) {
          this.activeId = undefined;
          this.emit({ type: "error", id, message: (error as Error).message });
        }
      }
    }
  }
}
