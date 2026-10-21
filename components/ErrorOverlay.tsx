type ErrorOverlayProps = { visible: boolean };

export default function ErrorOverlay({ visible }: ErrorOverlayProps) {
  if (!visible) return null;
  return <div className="error-overlay" role="status" aria-label="Incorrect move"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg></span></div>;
}
