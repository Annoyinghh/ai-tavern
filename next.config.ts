import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.2.102',
    '192.168.2.102:8080',
    '0.0.0.0',
    '*.local',
  ],
};

export default nextConfig;
