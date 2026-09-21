/// <reference lib="webworker" />
import { ENGINE_SCRIPT } from "./settings.ts";
import { UciSession } from "./uci.ts";
import type { EngineCommand, EngineEvent } from "./types.ts";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let engine: Worker | undefined;
let session: UciSession | undefined;
const emit = (event: EngineEvent) => scope.postMessage(event);
const fail = () => {
  engine?.terminate();
  emit({ type: "error", message: "Engine unavailable; reload to retry." });
};

scope.onmessage = ({ data }: MessageEvent<EngineCommand>) => {
  try {
    if (data.type === "init" && !session) {
      if (typeof WebAssembly !== "object") throw new Error("WebAssembly is unavailable.");
      // The unmodified GPL engine runs in its own classic worker. This small
      // adapter keeps all UCI protocol handling off the React/main thread too.
      engine = new Worker(/* webpackIgnore: true */ ENGINE_SCRIPT);
      session = new UciSession((command) => engine!.postMessage(command), emit);
      engine.onmessage = ({ data }) => {
        try {
          if (typeof data !== "string") throw new Error("Invalid engine output.");
          session!.line(data);
        } catch { fail(); }
      };
      engine.onerror = (event) => { event.preventDefault(); fail(); };
      engine.onmessageerror = fail;
    }
    if (!session) throw new Error("Engine not initialized.");
    session.command(data);
  } catch { fail(); }
};
