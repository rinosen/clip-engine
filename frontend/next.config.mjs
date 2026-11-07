import fs from "node:fs";
import path from "node:path";

// Fix for Node.js 22 on Windows: libuv returns EISDIR on non-symlinks instead of EINVAL,
// which breaks Webpack's symlink resolution.
const origReadlink = fs.readlink;
const origReadlinkSync = fs.readlinkSync;
const origPromisesReadlink = fs.promises ? fs.promises.readlink : null;

fs.readlink = function (...args) {
  const cb = args[args.length - 1];
  if (typeof cb === "function") {
    args[args.length - 1] = (err, linkString) => {
      if (err && (err.code === "EISDIR" || err.code === "UNKNOWN")) {
        err.code = "EINVAL";
      }
      cb(err, linkString);
    };
  }
  return origReadlink.apply(this, args);
};

fs.readlinkSync = function (...args) {
  try {
    return origReadlinkSync.apply(this, args);
  } catch (err) {
    if (err && (err.code === "EISDIR" || err.code === "UNKNOWN")) {
      err.code = "EINVAL";
    }
    throw err;
  }
};

if (origPromisesReadlink) {
  fs.promises.readlink = async function (...args) {
    try {
      return await origPromisesReadlink.apply(this, args);
    } catch (err) {
      if (err && (err.code === "EISDIR" || err.code === "UNKNOWN")) {
        err.code = "EINVAL";
      }
      throw err;
    }
  };
}

// Ensure middleware-manifest.json always exists as a safety fallback
try {
  const serverDir = path.join(process.cwd(), ".next", "server");
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }
  const manifestPath = path.join(serverDir, "middleware-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ version: 3, middleware: {}, functions: {}, sortedMiddleware: [] }, null, 2)
    );
  }
} catch (e) {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/py/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/media/:path*",
        destination: "http://127.0.0.1:8000/media/:path*",
      },
    ];
  },
};

export default nextConfig;
