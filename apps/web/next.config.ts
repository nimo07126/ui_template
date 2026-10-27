import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@template/design-tokens"],
};

export default nextConfig;
