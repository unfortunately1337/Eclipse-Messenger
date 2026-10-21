import type { NextConfig } from "next";
import path from "node:path";
import generateIconSubsets from "./scripts/generate-icon-subsets.cjs";

const iconAliases = generateIconSubsets(process.cwd());

const nextConfig: NextConfig = {
  turbopack: { resolveAlias: iconAliases },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(Object.entries(iconAliases).map(([name, file]) => [name + "$", path.resolve(file)])),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/gifs/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      ...["/emoji-picker/:path*", "/stickers/:path*", "/tgs/:path*"].map(source => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ];
  },
};

export default nextConfig;
