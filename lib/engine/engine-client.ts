import { defaultSettings, validateMovetime, validateSettings } from "./settings.ts";
import type { CandidateRequest, EngineAnalysis, EngineCommand, EngineEvent, EngineRequest, EngineSettings, EngineStatus, MoveEngine } from "./types.ts";

export type WorkerPort = Pick<Worker, "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror">;
type Options = {
  settings?: EngineSettings;
  onStatus?: (status: EngineStatus) => void;
  workerFactory?: () => WorkerPort;
  initTimeoutMs?: number;
  searchGraceMs?: number;
  stopTimeoutMs?: number;
};
type Pending = {
  id: number;
  request: CandidateRequest;
  resolve: (result: EngineAnalysis) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
  settled: boolean;
  deadline?: number;
};

const aborted = () => new DOMException("Engine search cancelled.", "AbortError");

export class EngineClient implements MoveEngine {
  private worker?: WorkerPort;
  private options: Options;
  private settings: EngineSettings;
  private status: EngineStatus = "starting";
  private disposed = false;
  private nextId = 1;
  private queue: Pending[] = [];
  private active?: Pending;
  private timer?: ReturnType<typeof setTimeout>;
  private init?: Promise<void>;
  private resolveInit?: () => void;
  private rejectInit?: (error: Error) => void;

  constructor(options: Options = {}) {
    this.options = options;
    const constrained = typeof navigator !== "undefined" &&
      (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || navigator.hardwareConcurrency <= 4);
    this.settings = options.settings ?? defaultSettings(constrained);
    validateSettings(this.settings);
  }

  private setStatus(status: EngineStatus) {
    this.status = status;
    this.options.onStatus?.(status);
  }

  initialize(): Promise<void> {
    if (this.disposed || this.status === "unavailable") return Promise.reject(new Error("Engine unavailable; reload to retry."));
    if (this.init) return this.init;
    this.init = new Promise<void>((resolve, reject) => { this.resolveInit = resolve; this.rejectInit = reject; });
    this.setStatus("starting");
    try {
      this.worker = this.options.workerFactory ? this.options.workerFactory() :
        new Worker(new URL("./stockfish.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = ({ data }: MessageEvent<EngineEvent>) => this.receive(data);
      this.worker.onerror = (event) => { event.preventDefault(); this.fail(); };
      this.worker.onmessageerror = () => this.fail();
      this.timer = setTimeout(() => this.fail(), this.options.initTimeoutMs ?? 30_000);
      this.post({ type: "init", settings: this.settings });
    } catch { this.fail(); }
    return this.init;
  }

  findBestMove(request: EngineRequest): Promise<string> {
    return this.search({ ...request, multiPV: 1 }).then(result => result.move);
  }

  findCandidateMoves(request: CandidateRequest): Promise<EngineAnalysis> {
    return this.search(request);
  }

  private search(request: CandidateRequest): Promise<EngineAnalysis> {
    if (!Number.isInteger(request.multiPV) || request.multiPV < 1 || request.multiPV > 5) {
      return Promise.reject(new Error("MultiPV must be between 1 and 5."));
    }
    if (request.signal?.aborted) return Promise.reject(aborted());
    try { validateMovetime(request.movetime ?? this.settings.movetime); }
    catch (error) { return Promise.reject(error); }
    return new Promise<EngineAnalysis>((resolve, reject) => {
      const entry: Pending = { id: this.nextId++, request, resolve, reject, cleanup: () => {}, settled: false };
      const cancel = () => this.cancel(entry, aborted());
      request.signal?.addEventListener("abort", cancel, { once: true });
      entry.cleanup = () => request.signal?.removeEventListener("abort", cancel);
      this.queue.push(entry);
      void this.initialize().then(() => this.pump(), (error) => {
        this.queue = this.queue.filter((item) => item !== entry);
        this.settle(entry, error);
      });
    });
  }

  private post(message: EngineCommand) {
    try { this.worker?.postMessage(message); }
    catch { this.fail(); }
  }

  private settle(entry: Pending, error?: Error, result?: EngineAnalysis) {
    if (entry.settled) return;
    entry.settled = true;
    entry.cleanup();
    if (error) entry.reject(error);
    else entry.resolve(result!);
  }

  private pump() {
    if (this.active || this.status !== "ready" || this.disposed) return;
    const entry = this.queue.shift();
    if (!entry) return;
    this.active = entry;
    const movetime = entry.request.movetime ?? this.settings.movetime;
    const timeout = movetime + (this.options.searchGraceMs ?? 5_000);
    entry.deadline = Date.now() + timeout;
    this.setStatus("thinking");
    this.timer = setTimeout(() => this.cancel(entry, new Error("Engine search timed out. Please retry.")), timeout);
    this.post({ type: "search", id: entry.id, fen: entry.request.fen, movetime, depth: this.settings.depth, multiPV: entry.request.multiPV });
  }

  private receive(event: EngineEvent) {
    if (this.disposed || this.status === "unavailable") return;
    if (!event || typeof event !== "object") return this.fail();
    if (event.type === "ready") {
      if (this.status !== "starting") return;
      clearTimeout(this.timer);
      this.setStatus("ready");
      this.resolveInit?.();
      this.pump();
    } else if (event.type === "error" && event.id === undefined) {
      this.fail();
    } else if ((event.type === "result" || event.type === "error") && this.active && event.id === this.active.id) {
      const entry = this.active!;
      clearTimeout(this.timer);
      this.active = undefined;
      // A resumed tab can receive messages before its overdue timer fires.
      const late = entry.deadline !== undefined && Date.now() > entry.deadline;
      if (late) this.settle(entry, new Error("Engine search timed out. Please retry."));
      else if (event.type === "error") this.settle(entry, new Error(event.message));
      else if (typeof event.move !== "string") this.settle(entry, new Error("Invalid engine response. Please retry."));
      else this.settle(entry, undefined, { move: event.move, lines: event.lines ?? [] });
      this.setStatus("ready");
      this.pump();
    }
  }

  private cancel(entry: Pending, error: Error) {
    if (entry.settled) return;
    this.settle(entry, error);
    this.queue = this.queue.filter((item) => item !== entry);
    if (this.active === entry) {
      clearTimeout(this.timer);
      // Keep the active ID until bestmove drains; a late result must never be
      // mistaken for the next FEN's result.
      this.timer = setTimeout(() => this.fail(), this.options.stopTimeoutMs ?? 2_000);
      this.post({ type: "stop", id: entry.id });
    }
  }

  stop() {
    for (const entry of [...this.queue]) this.cancel(entry, aborted());
    if (this.active) this.cancel(this.active, aborted());
  }

  private fail() {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = undefined;
    const error = new Error("Engine unavailable; reload to retry.");
    this.rejectInit?.(error);
    if (this.active) this.settle(this.active, error);
    this.active = undefined;
    for (const entry of this.queue) this.settle(entry, error);
    this.queue = [];
    this.setStatus("unavailable");
  }

  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    clearTimeout(this.timer);
    this.rejectInit?.(aborted());
    this.worker?.terminate();
    this.worker = undefined;
  }
}
