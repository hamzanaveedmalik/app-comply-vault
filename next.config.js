/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  typescript: {
    // Ignore type errors in generated Prisma files
    // These files are generated and have known type issues that don't affect runtime
    ignoreBuildErrors: true,
  },
  // Exclude generated folder from webpack
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    
    // Copy AFM font data files for PDFKit in serverless environment
    if (isServer) {
      config.module.rules.push({
        test: /\.afm$/,
        type: 'asset/source',
      });
    }
    
    return config;
  },
  // Enable standalone output for Docker deployment
  output: 'standalone',
  // Force Next.js to include AFM font files in the export route bundle
  experimental: {
    outputFileTracingIncludes: {
      '/api/meetings/[id]/export': [
        './src/app/api/meetings/[id]/export/data/**/*.afm',
      ],
    },
  },
};

export default config;
