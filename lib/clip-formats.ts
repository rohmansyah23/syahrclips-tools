import type { Format } from "youtube-dl-exec";

// Resolusi yang didukung (tinggi dalam piksel, urutan prioritas).
// Tinggal di sini (bukan constants.ts) agar modul ini bebas runtime-import
// dan bisa diuji unit langsung dengan runner bawaan Node (node:test).
export const CLIP_RESOLUTIONS = [1080, 720, 480, 360, 240, 144];

export function codecName(f: Format): string {
  const v = f.vcodec ?? "";
  if (v.startsWith("avc1")) return "h264";
  if (v.startsWith("av01")) return "av1";
  if (v.startsWith("vp9")) return "vp9";
  return "other";
}

export interface PickedFormats {
  video: Format;
  audio?: Format;
}

// Pilih format terbaik untuk tinggi target:
// - h264 dulu (kompatibilitas); av01/vp9 kalau preferLight (data jauh lebih kecil).
// - Kalau ada format progresif (video+audio jadi satu), pakai itu.
// - Kalau tidak (DASH — 1080p hampir selalu DASH), ambil video-only + audio-only
//   untuk di-mux dengan ffmpeg `-c copy` (tanpa re-encode).
export function pickFormats(
  formats: Format[],
  targetHeight: number,
  preferLight: boolean,
): { picked: PickedFormats; codec: string } | null {
  const direct = (f: Format) =>
    f.url && !f.has_drm && !Array.isArray(f.fragments) && f.protocol !== "m3u8_native";
  const candidates = formats.filter(direct).filter(
    (f) => typeof f.height === "number" && f.height <= targetHeight,
  );
  if (!candidates.length) return null;

  // Ambil tinggi tertinggi yang tersedia (tidak pernah upscale).
  const heights = [...new Set(candidates.map((f) => Number(f.height)))].sort((a, b) => b - a);
  const at = candidates.filter((f) => f.height === heights[0]);

  const isH264 = (f: Format) => codecName(f) === "h264";
  const isLight = (f: Format) => codecName(f) === "av1" || codecName(f) === "vp9";
  const progressive = (f: Format) => !!f.acodec && f.acodec !== "none";
  const isMp4 = (f: Format) => f.ext === "mp4";

  const rank = (f: Format): number => {
    let codecRank: number;
    if (preferLight) codecRank = isLight(f) ? 0 : isH264(f) ? 1 : 2;
    else codecRank = isH264(f) ? 0 : isLight(f) ? 1 : 2;
    return codecRank * 4 + (progressive(f) ? 0 : 1) * 2 + (isMp4(f) ? 0 : 1);
  };
  at.sort((a, b) => rank(a) - rank(b));
  const video = at[0];

  if (progressive(video)) return { picked: { video }, codec: codecName(video) };

  // DASH: cari audio-only (m4a/mp4, AAC) — preferensi bitrate ~128kbps
  // (itag 140): kualitas bagus tanpa file membengkak.
  const audios = formats
    .filter(direct)
    .filter((f) => (!f.vcodec || f.vcodec === "none") && f.acodec && f.acodec !== "none")
    .filter((f) => f.ext === "m4a" || f.ext === "mp4")
    .sort((a, b) => Math.abs((a.abr ?? 0) - 128) - Math.abs((b.abr ?? 0) - 128));
  if (!audios.length) return null;
  return { picked: { video, audio: audios[0] }, codec: codecName(video) };
}

// Rantai percobaan: resolusi diminta dulu (h264), lalu versi ringan (av1/vp9)
// pada resolusi sama, lalu turun ke resolusi lebih rendah. Auto-degrade
// memastikan selalu ada hasil dalam budget waktu, walau YouTube lambat.
export function buildAttempts(requested: number): Array<{ height: number; light: boolean }> {
  const heights = CLIP_RESOLUTIONS.filter((h) => h <= requested);
  if (!heights.length) heights.push(CLIP_RESOLUTIONS[CLIP_RESOLUTIONS.length - 1]);
  const attempts: Array<{ height: number; light: boolean }> = [];
  for (const h of heights) {
    attempts.push({ height: h, light: false });
    if (h > 360) attempts.push({ height: h, light: true });
  }
  return attempts;
}
