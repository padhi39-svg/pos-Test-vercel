/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config, { isServer }) => {
    config.optimization.minimize = false
    if (isServer) {
      config.externals = [...(config.externals || []), 'exceljs', 'better-sqlite3']
    }
    return config
  },
};

export default nextConfig;
