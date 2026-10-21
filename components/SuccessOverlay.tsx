type SuccessOverlayProps = { visible: boolean };

export default function SuccessOverlay({ visible }: SuccessOverlayProps) {
  if (!visible) return null;
  return <div className="success-overlay" role="status" aria-label="Correct move"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></span></div>;
}
