import { Chess } from "chess.js";

// Families describe the catalog, not detector coverage. Add concepts only when
// their wording and detection rules are ready; quiet moves stay unclassified.
export type HintFamily = "forcing" | "tactics" | "positional" | "pawn" | "defense";
type HintConcept = { readonly family: HintFamily; readonly text: string };

export const hintCatalog = {
  "forcing.check": { family: "forcing", text: "Look for checks." },
  "forcing.capture": { family: "forcing", text: "Look for captures." },
} as const satisfies Record<string, HintConcept>;

export type HintConceptId = keyof typeof hintCatalog;
export type HintClassification = {
  readonly concepts: readonly HintConceptId[];
  readonly primary: HintConceptId | null;
};

export const fallbackHint = "Consider your opponent’s threats and your available options.";

/** Classify a validated, normalized engine move without changing the trainer. */
export function classifyHint(fen: string, expectedMove: string): HintClassification {
  const position = new Chess(fen);
  const move = position.move({
    from: expectedMove.slice(0, 2),
    to: expectedMove.slice(2, 4),
    promotion: expectedMove[4],
  });
  const concepts: HintConceptId[] = [];
  // Ordered by teaching priority. A checking capture retains both concepts.
  if (position.isCheck()) concepts.push("forcing.check");
  if (move.captured) concepts.push("forcing.capture");
  return { concepts, primary: concepts[0] ?? null };
}

export function hintText(classification: HintClassification): string {
  return classification.primary === null ? fallbackHint : hintCatalog[classification.primary].text;
}
