type ErrorOverlayProps = { visible: boolean };
export default function ErrorOverlay({ visible }: ErrorOverlayProps) {
  if (!visible) return null;
  return <div className="error-overlay" role="status" aria-label="Incorrect move"><span>×</span></div>;
}
