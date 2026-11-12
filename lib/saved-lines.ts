export type SavedLine = {
  id: string;
  name: string;
  fen: string;
  playerSide: "w" | "b";
  boardOrientation: "white" | "black";
  completedLines: string[];
};

const STORAGE_KEY = "openrep.saved-lines.v1";

export function readSavedLines(): SavedLine[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.fen === "string" && ["w", "b"].includes(item.playerSide) && ["white", "black"].includes(item.boardOrientation) && Array.isArray(item.completedLines) && item.completedLines.every((line: unknown) => typeof line === "string"))) {
    throw new Error("Saved positions could not be read.");
  }
  return data as SavedLine[];
}

export function writeSavedLines(lines: SavedLine[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
}

export function addCompletedLine(lines: SavedLine[], id: string, moves: string[]): SavedLine[] {
  if (!moves.length) return lines;
  const sequence = moves.join(" ");
  return lines.map((line) => line.id !== id || line.completedLines.includes(sequence)
    ? line : { ...line, completedLines: [...line.completedLines, sequence] });
}
