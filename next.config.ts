
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'wochzxpmsjscfjkenhpu.supabase.co',
      }
    ],
  },
   experimental: {
    allowedDevOrigins: [
        "https://6000-firebase-studio-1748374989254.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev"
    ],
  },
};

export default nextConfig;
