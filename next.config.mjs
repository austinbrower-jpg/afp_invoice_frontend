/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Production deploy failed at middleware invocation with
  // "ReferenceError: __dirname is not defined": Next's default Edge bundle for
  // middleware pulls in its own internal OpenTelemetry instrumentation, and something
  // in that bundle references __dirname in a way Vercel's real Edge isolate rejects,
  // even though local dev's Node-based edge simulation tolerates it. Node.js runtime
  // middleware sidesteps the whole edge-bundling incompatibility rather than fighting
  // it, and is Vercel's current recommended path over Edge Functions generally.
  experimental: {
    nodeMiddleware: true,
  },
};

export default nextConfig;
