import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 워크스페이스 패키지는 빌드 산출물 없이 TS 소스로 소비한다.
  transpilePackages: ["@sheet/core"],
  compiler: { styledComponents: true },
};

export default nextConfig;
