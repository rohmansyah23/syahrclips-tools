import type { NextConfig } from "next";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let ytdlpPath = "";
try {
  ytdlpPath = path.relative(process.cwd(), require.resolve("youtube-dl-exec/bin/yt-dlp"));
} catch {
  // binary belum ter-download — abaikan, hanya memengaruhi tracing deploy
}

const nextConfig: NextConfig = {
  // Package ini butuh __dirname asli untuk menemukan binary-nya — jangan di-bundle.
  serverExternalPackages: ["youtube-dl-exec", "ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/clip": [
      ...(ffmpegPath ? [path.relative(process.cwd(), ffmpegPath)] : []),
      ...(ytdlpPath ? [ytdlpPath] : []),
    ],
  },
};

export default nextConfig;
