/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: output:"export" removed — the BFF proxy uses Next.js API Route Handlers
  // which require the Node.js runtime. Deploy as a standard Next.js app
  // (Vercel, Docker container, or ECS). If you still need a static build,
  // move the BFF logic to a separate Hono server and restore output:"export".
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

module.exports = nextConfig;
