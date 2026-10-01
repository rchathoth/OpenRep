import { normalizeLegalUci } from "./training.ts";

export type OpeningCandidate = { uci: string; count: number };
export const COMMON_MOVE_COVERAGE = 0.95;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse the public response contract. Invalid rows are discarded independently. */
export function parseOpeningCandidates(payload: unknown): OpeningCandidate[] {
  if (!isRecord(payload) || !Array.isArray(payload.moves)) return [];
  const result: OpeningCandidate[] = [];
  for (const row of payload.moves) {
    if (!isRecord(row) || typeof row.uci !== "string") continue;
    const count = row.count;
    if (!Number.isSafeInteger(count) || (count as number) < 0) continue;
    result.push({ uci: row.uci, count: count as number });
  }
  return result;
}

/** Validate legality, merge normalized duplicates, then retain the common 95% prefix. */
export function commonLegalMoves(fen: string, candidates: readonly OpeningCandidate[], coverage = COMMON_MOVE_COVERAGE): OpeningCandidate[] {
  const merged = new Map<string, number>();
  for (const { uci, count } of candidates) {
    if (!Number.isSafeInteger(count) || count <= 0) continue;
    const normalized = normalizeLegalUci(fen, uci);
    if (!normalized) continue;
    const next = (merged.get(normalized) ?? 0) + count;
    if (!Number.isSafeInteger(next)) continue;
    merged.set(normalized, next);
  }
  const sorted = [...merged].map(([uci, count]) => ({ uci, count }))
    .sort((a, b) => b.count - a.count || (a.uci < b.uci ? -1 : a.uci > b.uci ? 1 : 0));
  const total = sorted.reduce((sum, row) => sum + row.count, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || sorted.length === 0) return [];
  const target = total * Math.min(1, Math.max(0, coverage));
  let covered = 0;
  const common: OpeningCandidate[] = [];
  for (const row of sorted) {
    common.push(row);
    covered += row.count;
    if (covered >= target) break;
  }
  return common;
}

export function sampleWeightedMove(candidates: readonly OpeningCandidate[], random: () => number = Math.random): string | null {
  const total = candidates.reduce((sum, row) => sum + row.count, 0);
  if (!Number.isSafeInteger(total) || total <= 0) return null;
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) return null;
  const target = value * total;
  let cumulative = 0;
  for (const candidate of candidates) {
    if (!Number.isSafeInteger(candidate.count) || candidate.count <= 0) continue;
    cumulative += candidate.count;
    if (target < cumulative) return candidate.uci;
  }
  return null;
}
