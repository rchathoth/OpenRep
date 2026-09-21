import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/engine/stockfish-19.0.0/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
};

export default nextConfig;
