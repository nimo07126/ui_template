import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@template/design-tokens"],
  async redirects() {
    return [
      { source: "/components", destination: "/showcase", permanent: true },
    ];
  },
};

export default nextConfig;
