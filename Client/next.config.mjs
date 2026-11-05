/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Mock mode needs no proxy; the real build proxies /api/* so the HttpOnly cookie is same-site.
    if (!API_URL) return [];
    return [{ source: "/api/:path*", destination: `${API_URL.replace(/\/$/, "")}/api/:path*` }];
  },
};

export default nextConfig;