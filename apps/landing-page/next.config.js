/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  transpilePackages: ["@reelbazaar/config"],
};

module.exports = nextConfig;
