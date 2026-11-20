import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_LOOKUPS_ROUTE: process.env.NEXT_PUBLIC_LOOKUPS_ROUTE,
    NEXT_PUBLIC_LOOKUP_BY_ID_ROUTE: process.env.NEXT_PUBLIC_LOOKUP_BY_ID_ROUTE,
    NEXT_PUBLIC_LOOKUP_STATUS_ROUTE: process.env.NEXT_PUBLIC_LOOKUP_STATUS_ROUTE,
    NEXT_PUBLIC_LOOKUP_SUBLOOKUPS_ROUTE:
      process.env.NEXT_PUBLIC_LOOKUP_SUBLOOKUPS_ROUTE,
    NEXT_PUBLIC_SUBLOOKUP_BY_ID_ROUTE:
      process.env.NEXT_PUBLIC_SUBLOOKUP_BY_ID_ROUTE,
    NEXT_PUBLIC_SUBLOOKUP_STATUS_ROUTE:
      process.env.NEXT_PUBLIC_SUBLOOKUP_STATUS_ROUTE,
  },
};

export default nextConfig;