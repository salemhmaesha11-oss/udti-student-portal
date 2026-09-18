/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
