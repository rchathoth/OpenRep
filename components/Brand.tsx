import type { ReactNode, SVGProps } from "react";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 20V8h12M28 8h12v12M40 28v12H28M20 40H8V28" />
        <path d="M16 24v-8h8M24 32h8v-8" />
      </g>
      <path d="M21 21h6v6h-6z" fill="currentColor" />
    </svg>
  );
}

type IconName = "arrow" | "flip" | "reset" | "hint";

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    flip: <path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" />,
    reset: <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />,
    hint: <><path d="M9 17h6m-5 4h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z" /><path d="M12 1v1M2 8l1 1m18-1-1 1" /></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function PracticeIllustration() {
  return (
    <svg className="practice-illustration" viewBox="0 0 260 190" fill="none" aria-hidden="true">
      <circle cx="158" cy="88" r="69" fill="var(--accent)" />
      <path d="M40 143c-37-47 1-89 38-67 32 19-15 55-29 36-15-20 27-72 60-58"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 7" />
      <path d="m100 43 11 11-15 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M128 128c0-23 31-30 31-53l-19 15-20-8 14-24 18-7-1-21 17 12c28 2 40 25 35 48-4 17-18 26-17 38"
        fill="var(--page)" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m138 61 12-4m24-2c14 11 13 31 3 46M122 130h72l5 14h-82l5-14Zm-7 15h86v11h-86z"
        stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="150" cy="65" r="2.5" fill="currentColor" />
      <path d="M216 40v16m-8-8h16M68 150v10m-5-5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M96 171c33 4 80 4 120-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
