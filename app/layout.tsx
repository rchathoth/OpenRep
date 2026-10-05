import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenRep — Chess repertoire trainer",
  description: "Practice the strongest chess moves from any position.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
