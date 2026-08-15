import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { youtubeDl } from "youtube-dl-exec";
import type { Format } from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";
import { buildAttempts, pickFormats } from "@/lib/clip-formats";
import { isVideoId } from "@/lib/youtube";
import {
  CLIP_RESOLUTIONS,
  DEFAULT_CLIP_RESOLUTION,
  MAX_CLIP_SECONDS,
} from "@/lib/constants";

// ── Batas waktu ────────────────────────────────────────────────
// maxDuration Vercel = 300s (Fluid Compute, Hobby). Budget internal sedikit
// di bawahnya agar masih ada margin untuk resolve yt-dlp + mengirim respons.
const CLIP_BUDGET_MS = 280_000;
const MIN_REMAINING_MS = 25_000;

// Prefer ffmpeg sistem bila ada: build statis (ffmpeg-static) bisa segfault
// pada input https di sebagian lingkungan. ffmpeg-static dipakai sebagai
// fallback (mis. di Vercel yang tidak punya ffmpeg sistem).
function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  for (const candidate of ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (existsSync(candidate)) return candidate;
  }
  if (ffmpegPath) return ffmpegPath;
  throw new ClipError("Binary ffmpeg tidak ditemukan di server.", 500);
}

export class ClipError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ClipError";
    this.status = status;
  }
}

export interface ClipInput {
  videoId: string;
  start: number;
  end: number;
  /** Tinggi maksimal (piksel) — default 1080. */
  resolution?: number;
}

export interface ClipResult {
  /** Path file mp4 hasil — pemanggil yang membersihkan direktori kerja. */
  filePath: string;
  size: number;
  filename: string;
  contentType: string;
  /** Tinggi yang benar-benar dipakai (bisa lebih rendah dari diminta). */
  resolution: number;
  codec: string; // h264 | av1 | vp9
  degraded: boolean;
}

interface ResolvedVideo {
  duration: number;
  formats: Format[];
}

// ── Cache stream URL per videoId (in-memory, TTL pendek) ──────
// Mengurangi panggilan yt-dlp -J untuk klip berulang video yang sama,
// sekaligus menekan rate-limit YouTube. Berlaku per instance serverless
// (best-effort); di dev lokal berlaku penuh. TTL bisa ditimpa via env untuk
// pengujian: STREAM_CACHE_TTL_SECONDS.
const STREAM_CACHE_TTL_MS = (Number(process.env.STREAM_CACHE_TTL_SECONDS) || 600) * 1000;
const STREAM_CACHE_MAX = 50;

interface StreamCacheEntry {
  resolved: ResolvedVideo;
  expiresAt: number;
}

const streamCache = new Map<string, StreamCacheEntry>();

function getCachedStream(videoId: string): ResolvedVideo | null {
  const entry = streamCache.get(videoId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    streamCache.delete(videoId);
    return null;
  }
  return entry.resolved;
}

function setCachedStream(videoId: string, resolved: ResolvedVideo): void {
  if (streamCache.size >= STREAM_CACHE_MAX) {
    // Buang entri terlama (Map iterasi sesuai urutan insert).
    const oldest = streamCache.keys().next().value;
    if (oldest !== undefined) streamCache.delete(oldest);
  }
  streamCache.set(videoId, { resolved, expiresAt: Date.now() + STREAM_CACHE_TTL_MS });
}

function invalidateStreamCache(videoId: string): void {
  streamCache.delete(videoId);
}

function classifyYtdlpError(err: unknown): ClipError {
  const msg = err instanceof Error ? err.message : String(err);
  if (/sign in to confirm|not a bot|429|too many request/i.test(msg)) {
    return new ClipError("Terlalu banyak permintaan ke YouTube, coba lagi sebentar lagi.", 429);
  }
  if (/private|unavailable|not available|removed|age.?restrict|drm/i.test(msg)) {
    return new ClipError("Video tidak dapat diunduh (privat, dibatasi usia/VEVO, atau tidak tersedia).", 403);
  }
  return new ClipError("Gagal mengambil informasi video dari YouTube.", 502);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|too many request|rate limit/i.test(msg);
}

async function resolveVideo(videoId: string): Promise<ResolvedVideo> {
  const cached = getCachedStream(videoId);
  if (cached) {
    console.log(`[clip] cache hit ${videoId}`);
    return cached;
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const payload = await youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, {
        dumpSingleJson: true,
        noWarnings: true,
        noPlaylist: true,
        skipDownload: true,
        quiet: true,
        noCheckCertificates: true,
        jsRuntimes: "node",
        cacheDir: "/tmp/yt-dlp-cache",
      });

      if (typeof payload !== "object" || payload === null || !Array.isArray(payload.formats)) {
        throw new ClipError("Respons yt-dlp tidak valid.", 502);
      }

      const resolved: ResolvedVideo = {
        duration: Number(payload.duration) || 0,
        formats: payload.formats as Format[],
      };
      setCachedStream(videoId, resolved);
      console.log(`[clip] cache miss ${videoId} — resolved via yt-dlp`);
      return resolved;
    } catch (err) {
      lastErr = err;
      // 429/rate limit: tunggu sebentar lalu coba sekali lagi.
      if (isRateLimit(err) && attempt === 0) {
        await sleep(2000);
        continue;
      }
      if (err instanceof ClipError) throw err;
      throw classifyYtdlpError(err);
    }
  }
  throw classifyYtdlpError(lastErr);
}

function buildHeaders(format: Format): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(format.http_headers ?? {})) {
    parts.push(`${key}: ${String(value)}`);
  }
  if (!parts.some((p) => p.toLowerCase().startsWith("user-agent"))) {
    parts.push("User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0 Safari/537.36");
  }
  return parts.join("\r\n") + "\r\n";
}

// ffmpeg melakukan range-seeking sendiri dari stream URL (moov di akhir file
// tetap terbaca via HTTP range) — lebih robust daripada byte-range manual.
function classifyFfmpegError(exitCode: number | null, stderr: string): ClipError {
  if (/HTTP error 4(03|29)|403 Forbidden|429|Error opening input/i.test(stderr)) {
    return new ClipError("YouTube membatasi permintaan stream, coba lagi sebentar lagi.", 429);
  }
  return new ClipError(`Pemotongan klip gagal (ffmpeg exit ${exitCode}).`, 500);
}

interface TrimInput {
  url: string;
  headers: string;
}

// Tanda bahwa stream terlalu lambat — pemanggil turun ke resolusi/codec
// berikutnya (bukan error fatal).
class SlowError extends Error {}

// Jalankan ffmpeg dengan pemantauan progres: kalau perkiraan waktu selesai
// melebihi budget, proses dibunuh dan ditolak dengan SlowError agar pemanggil
// bisa auto-degrade. Dua input = muxing DASH (video-only + audio-only).
function trimWithFfmpeg(
  inputs: TrimInput[],
  output: string,
  start: number,
  duration: number,
  budgetMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let bin: string;
    try {
      bin = getFfmpegPath();
    } catch (err) {
      reject(err);
      return;
    }
    const args: string[] = ["-y"];
    for (const inp of inputs) {
      args.push("-headers", inp.headers, "-ss", String(start), "-t", String(duration), "-i", inp.url);
    }
    if (inputs.length === 2) {
      args.push("-map", "0:v:0", "-map", "1:a:0");
    }
    args.push("-c", "copy", "-movflags", "+faststart", "-f", "mp4", output);

    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const t0 = Date.now();
    let latestTime = 0;

    proc.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      stderr += s;
      const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m) latestTime = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    });

    const timer = setInterval(() => {
      const elapsed = Date.now() - t0;
      const kill = () => {
        clearInterval(timer);
        proc.kill("SIGKILL");
        reject(new SlowError("Stream terlalu lambat untuk budget waktu klip."));
      };
      if (latestTime > 0.5 && duration > 0) {
        const fraction = Math.min(latestTime / duration, 1);
        const eta = elapsed / fraction;
        if (eta > budgetMs) return kill();
      }
      // Backstop: budget habis, atau tidak ada progres sama sekali (20s).
      if (elapsed > budgetMs || (latestTime === 0 && elapsed > 20_000)) return kill();
    }, 2000);

    proc.on("error", (err) => {
      clearInterval(timer);
      reject(new ClipError(`Gagal menjalankan ffmpeg: ${err.message}`, 500));
    });
    proc.on("close", (code) => {
      clearInterval(timer);
      if (code === 0) resolve();
      else reject(classifyFfmpegError(code, stderr));
    });
  });
}

export async function downloadClip(input: ClipInput, workDir: string): Promise<ClipResult> {
  const { videoId, start, end } = input;
  const requested = input.resolution ?? DEFAULT_CLIP_RESOLUTION;

  if (!CLIP_RESOLUTIONS.includes(requested)) {
    throw new ClipError(`Resolusi tidak didukung (pilih ${CLIP_RESOLUTIONS.join("/")}p).`, 400);
  }
  if (!isVideoId(videoId)) {
    throw new ClipError("videoId tidak valid.", 400);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new ClipError("Rentang waktu tidak valid: start ≥ 0 dan end > start.", 400);
  }
  const clipDuration = end - start;
  if (clipDuration > MAX_CLIP_SECONDS) {
    throw new ClipError(`Klip terlalu panjang (maksimal ${MAX_CLIP_SECONDS / 60} menit).`, 400);
  }

  const outPath = path.join(workDir, "output.mp4");
  const attempts = buildAttempts(requested);
  const t0 = Date.now();
  let lastErr: unknown = new ClipError("Gagal membuat klip setelah beberapa percobaan.", 504);

  for (let i = 0; i < attempts.length; i++) {
    const remaining = CLIP_BUDGET_MS - (Date.now() - t0);
    if (remaining < MIN_REMAINING_MS) break;
    const { height, light } = attempts[i];

    try {
      const resolved = await resolveVideo(videoId);
      if (resolved.duration <= 0) {
        throw new ClipError("Durasi video tidak diketahui.", 502);
      }
      if (end > resolved.duration) {
        throw new ClipError(
          `Akhir klip (${end}s) melebihi durasi video (${Math.floor(resolved.duration)}s).`,
          400,
        );
      }
      const picked = pickFormats(resolved.formats, height, light);
      if (!picked) {
        lastErr = new ClipError(`Tidak ada format video yang cocok (maks ${height}p).`, 502);
        continue;
      }
      const inputs: TrimInput[] = [
        { url: picked.picked.video.url, headers: buildHeaders(picked.picked.video) },
      ];
      if (picked.picked.audio) {
        inputs.push({ url: picked.picked.audio.url, headers: buildHeaders(picked.picked.audio) });
      }
      const budget = Math.max(remaining - 15_000, 20_000);
      await trimWithFfmpeg(inputs, outPath, start, clipDuration, budget);

      // Tinggi AKTUAL dari format (bisa lebih rendah dari target saat
      // resolusi maksimum video di bawah target percobaan).
      const actualHeight = picked.picked.video.height ?? height;
      const size = (await fs.stat(outPath)).size;
      const degraded = actualHeight < requested || picked.codec !== "h264";
      const filename = `klip-${videoId}-${Math.floor(start)}-${Math.floor(end)}-${actualHeight}p-${picked.codec}.mp4`;
      return {
        filePath: outPath,
        size,
        filename,
        contentType: "video/mp4",
        resolution: actualHeight,
        codec: picked.codec,
        degraded,
      };
    } catch (err) {
      lastErr = err;
      console.log(
        `[clip] percobaan ${i + 1}/${attempts.length} (${height}p${light ? " light" : ""}) gagal: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Validasi user (400) & video privat/tak tersedia (403) tidak akan hilang
      // dengan percobaan lain — langsung hentikan.
      if (err instanceof ClipError && (err.status === 400 || err.status === 403)) throw err;
      if (err instanceof SlowError) continue; // lambat → coba resolusi/codec berikutnya
      // Error stream/429/502: URL bisa basi — buang cache agar percobaan
      // berikutnya mengambil URL segar dari yt-dlp.
      invalidateStreamCache(videoId);
      await sleep(i === 0 ? 2000 : 1000);
    }
  }

  if (lastErr instanceof SlowError) {
    throw new ClipError(
      "Stream YouTube terlalu lambat untuk resolusi yang diminta; coba resolusi lebih rendah.",
      504,
    );
  }
  if (lastErr instanceof ClipError) throw lastErr;
  throw new ClipError("Gagal membuat klip setelah beberapa percobaan.", 504);
}
