/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "golden-bridge-deal-img.s3.us-west-2.amazonaws.com",
        pathname: "/**"
      }
    ]
  },
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
