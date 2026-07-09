import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "substackcdn.com",
      },
      {
        protocol: "https",
        hostname: "substack-post-media.s3.amazonaws.com",
      },
    ],
  },
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
