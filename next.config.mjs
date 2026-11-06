/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pages fusionnées : les anciennes adresses restent valides.
  async redirects() {
    return [
      { source: "/documentation", destination: "/developpeurs#reference", permanent: true },
      { source: "/a-propos", destination: "/contact", permanent: true },
    ];
  },
  // Photos métiers (Unsplash, licence libre) — optimisées par next/image.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  // Évite la race « Cannot find module for page » de la collecte parallèle
  // des données de page sous Windows (Next 14) en sérialisant les workers.
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
