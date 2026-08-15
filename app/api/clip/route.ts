import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { ClipError, downloadClip } from "@/lib/clip";
import { parseYouTubeUrl } from "@/lib/youtube";
import { CLIP_RESOLUTIONS, DEFAULT_CLIP_RESOLUTION } from "@/lib/constants";

// Fluid Compute (default proyek Vercel baru): Hobby = 300s (5 menit) maks.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: {
    videoId?: unknown;
    url?: unknown;
    start?: unknown;
    end?: unknown;
    resolution?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body harus JSON dengan field videoId/url, start, dan end." },
      { status: 400 },
    );
  }

  const rawVideoId = typeof body?.videoId === "string" ? body.videoId.trim() : "";
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  const videoId = rawVideoId || (rawUrl ? parseYouTubeUrl(rawUrl) ?? "" : "");

  const start = Number(body?.start);
  const end = Number(body?.end);

  if (!videoId) {
    return NextResponse.json(
      { error: "videoId atau URL YouTube wajib diisi." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return NextResponse.json(
      { error: "start dan end wajib berupa angka (detik)." },
      { status: 400 },
    );
  }

  const rawResolution = body?.resolution;
  const resolution =
    rawResolution === undefined || rawResolution === null || rawResolution === ""
      ? DEFAULT_CLIP_RESOLUTION
      : Number(rawResolution);
  if (!Number.isFinite(resolution) || !CLIP_RESOLUTIONS.includes(resolution)) {
    return NextResponse.json(
      { error: `Resolusi tidak didukung (pilih ${CLIP_RESOLUTIONS.join("/")}p).` },
      { status: 400 },
    );
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "syahrclips-"));
  try {
    const clip = await downloadClip({ videoId, start, end, resolution }, workDir);
    const cleanup = () => {
      fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    };
    const nodeStream = createReadStream(clip.filePath);
    nodeStream.on("close", cleanup);
    nodeStream.on("error", cleanup);
    // Streaming (bukan buffer): batas body 4,5 MB di Vercel tidak berlaku
    // untuk streaming function — klip berapa pun besarnya tetap terkirim.
    const bodyStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    return new NextResponse(bodyStream, {
      headers: {
        "Content-Type": clip.contentType,
        "Content-Disposition": `attachment; filename="${clip.filename}"`,
        "Content-Length": String(clip.size),
        "X-Clip-Resolution": String(clip.resolution),
        "X-Clip-Codec": clip.codec,
        "X-Clip-Degraded": clip.degraded ? "1" : "0",
      },
    });
  } catch (err) {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (err instanceof ClipError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat membuat klip." },
      { status: 500 },
    );
  }
}
