/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Évite la race « Cannot find module for page » de la collecte parallèle
  // des données de page sous Windows (Next 14) en sérialisant les workers.
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
