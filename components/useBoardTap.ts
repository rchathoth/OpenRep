"use client";

import { useRef, type PointerEvent } from "react";

// Track touch taps synchronously; the board's touch-start state can lag fast taps.
export function useBoardTap(onSquare: (args: { square: string }) => void) {
  const gesture = useRef<{ square: string; x: number; y: number; moved: boolean } | null>(null);
  const handledTouch = useRef(false);
  return {
    onSquareClick: (args: { square: string }) => { if (!handledTouch.current) onSquare(args); },
    handlers: {
      onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
        handledTouch.current = false;
        const square = (event.target as Element).closest<HTMLElement>("[data-square]")?.dataset.square;
        gesture.current = event.pointerType !== "mouse" && square ? { square, x: event.clientX, y: event.clientY, moved: false } : null;
      },
      onPointerMoveCapture: (event: PointerEvent<HTMLDivElement>) => {
        const start = gesture.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) start.moved = true;
      },
      onPointerUpCapture: (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse") return;
        handledTouch.current = true;
        const start = gesture.current;
        gesture.current = null;
        if (!start || start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) return;
        onSquare({ square: start.square });
      },
      onPointerCancelCapture: () => { gesture.current = null; handledTouch.current = true; },
    },
  };
}
