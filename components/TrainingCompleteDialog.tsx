"use client";

import { useEffect, useRef } from "react";

type Props = { open: boolean; onPracticeDifferentLines: () => void; onReview: () => void; returnFocusRef: React.RefObject<HTMLButtonElement | null> };

export default function TrainingCompleteDialog({ open, onPracticeDifferentLines, onReview, returnFocusRef }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      primary.current?.focus();
    } else if (!open && element.open) {
      element.close();
      returnFocusRef.current?.focus();
    }
  }, [open, returnFocusRef]);

  return <dialog ref={dialog} className="training-complete-dialog" aria-labelledby="training-complete-title" aria-describedby="training-complete-description"
    onCancel={(event) => { event.preventDefault(); onReview(); }}
    onClose={() => { if (open) onReview(); }}>
    <h2 id="training-complete-title">Good depth reached</h2>
    <p id="training-complete-description">You&apos;ve practiced this line to a good depth — 10 moves. Go back and practice different lines to build a broader repertoire.</p>
    <div className="dialog-actions">
      <button ref={primary} type="button" className="button-primary" onClick={onPracticeDifferentLines}>Practice different lines</button>
      <button type="button" className="button-secondary" onClick={onReview}>Review this line</button>
    </div>
  </dialog>;
}
