import {
  YoutubeTranscript,
  YoutubeTranscriptError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";
import type { TranscriptResponse } from "youtube-transcript";
import { formatTimestamp } from "@/lib/format";
import { parseYouTubeUrl } from "@/lib/youtube";
import type { TranscriptResult, TranscriptSegment } from "@/lib/types";

export class TranscriptError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "TranscriptError";
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMetadata(videoId: string): Promise<{ title: string; author: string }> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { title: "", author: "" };
    const data = (await res.json()) as { title?: string; author_name?: string };
    return { title: data.title ?? "", author: data.author_name ?? "" };
  } catch {
    return { title: "", author: "" };
  }
}

function toTranscriptError(err: unknown): TranscriptError {
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return new TranscriptError("Video tidak tersedia atau tidak ditemukan.", 404);
  }
  if (err instanceof YoutubeTranscriptDisabledError) {
    return new TranscriptError("Transkrip dinonaktifkan pada video ini.", 404);
  }
  if (err instanceof YoutubeTranscriptNotAvailableError) {
    return new TranscriptError("Video tidak memiliki transkrip (caption tidak tersedia).", 404);
  }
  if (err instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return new TranscriptError("Transkrip tidak tersedia untuk video ini.", 404);
  }
  if (err instanceof YoutubeTranscriptTooManyRequestError) {
    return new TranscriptError("Terlalu banyak permintaan ke YouTube, coba lagi sebentar lagi.", 429);
  }
  return new TranscriptError("Gagal mengambil transkrip, coba lagi.", 502);
}

async function fetchTranscriptWithRetry(videoId: string): Promise<TranscriptResponse[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await YoutubeTranscript.fetchTranscript(videoId);
    } catch (err) {
      lastErr = err;
      if (err instanceof YoutubeTranscriptTooManyRequestError) {
        if (attempt < 2) await sleep(1500 * (attempt + 1));
        continue;
      }
      if (err instanceof YoutubeTranscriptError) {
        throw toTranscriptError(err);
      }
      // Error tak dikenal (mis. jaringan) → retry sebentar.
      if (attempt < 2) await sleep(600 * (attempt + 1));
    }
  }
  return Promise.reject(toTranscriptError(lastErr));
}

export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  const [metadata, raw] = await Promise.all([
    fetchMetadata(videoId),
    fetchTranscriptWithRetry(videoId),
  ]);

  // youtube-transcript v1.x mengembalikan offset/duration dalam milidetik.
  const segments: TranscriptSegment[] = raw.map((s) => ({
    start: s.offset / 1000,
    end: (s.offset + s.duration) / 1000,
    text: s.text.trim(),
  }));

  const text = segments
    .map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
    .join("\n");

  const words = text.split(/\s+/).filter(Boolean).length;

  return {
    videoId,
    title: metadata.title,
    author: metadata.author,
    segments,
    text,
    stats: {
      segments: segments.length,
      words,
      chars: text.length,
    },
  };
}

export { parseYouTubeUrl };
