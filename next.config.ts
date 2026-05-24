import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle to .next/standalone for the Docker
  // image. See app/03-api-reference/05-config/01-next-config-js/output.md.
  output: "standalone",
};

export default nextConfig;
