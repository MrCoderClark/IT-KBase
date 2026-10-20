import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // auth/web sits next to frontend/. Turbopack otherwise refuses that import.
    root: path.resolve(frontendDir, ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
