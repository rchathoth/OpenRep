// Shared presentation only; board input and chess rules belong to each screen.
export const boardAppearance = {
  // Distinguish a tap from a drag before the library activates its sensors.
  dragActivationDistance: 6,
  boardStyle: { borderRadius: "2px" },
  lightSquareStyle: { backgroundColor: "var(--board-light)" },
  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
  lightSquareNotationStyle: { color: "var(--board-coordinate-light)" },
  darkSquareNotationStyle: { color: "var(--board-coordinate-dark)" },
};
