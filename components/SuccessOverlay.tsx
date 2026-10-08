type SuccessOverlayProps = {
    visible: boolean
};

export default function SuccessOverlay({ visible }: SuccessOverlayProps) {
    if (!visible) return null;
    return <div className="success-overlay" role="status" aria-label="Correct move"><span>✓</span></div>;
}