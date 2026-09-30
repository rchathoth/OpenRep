type SuccessOverlayProps = {
    visible: boolean
};

export default function SucessOverlay({ visible }: SuccessOverlayProps) {
    if (!visible) return null;
    return <div className="error-overlay" role="status" aria-label="Correct move"><span>×</span></div>;
}