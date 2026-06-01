/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a self-contained server bundle for a small Docker runtime image.
  output: "standalone",
};

export default nextConfig;
