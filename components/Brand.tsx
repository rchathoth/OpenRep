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
