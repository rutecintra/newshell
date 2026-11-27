import { getSiteUrl } from "./lib/site.js";

const siteUrl = getSiteUrl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: { SITE_URL: siteUrl },
  poweredByHeader: false,
};

export default nextConfig;
