/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.gatcg.com",
      },
      {
        protocol: "https",
        hostname: "**.gatcg.com",
      },
    ],
  },
};

export default nextConfig;
