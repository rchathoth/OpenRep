// Shared presentation only; board input and chess rules belong to each screen.
export const boardAppearance = {
  // Distinguish a tap from a drag before the library activates its sensors.
  dragActivationDistance: 6,
  boardStyle: { borderRadius: "12px" },
  lightSquareStyle: { backgroundColor: "var(--board-light)" },
  darkSquareStyle: { backgroundColor: "var(--board-dark)" },
};
