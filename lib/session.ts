export interface VideoContext {
  videoUrl: string;
  videoId: string;
  title?: string;
  author?: string;
}

export const VIDEO_CONTEXT_KEY = "syahrclips:video";

/**
 * Konteks video bersama untuk alur 3 langkah (Transkrip → Preview → Klip).
 * Ditulis saat transkrip berhasil diambil, dibaca halaman Preview/Klip
 * untuk mengisi otomatis kolom video. Client-only — hanya boleh dipanggil
 * dari efek/event handler, bukan saat render (aman untuk SSR).
 */
export function getVideoContext(): VideoContext | null {
  try {
    const raw = sessionStorage.getItem(VIDEO_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VideoContext>;
    if (typeof parsed.videoId === "string" && parsed.videoId) {
      return {
        videoUrl: typeof parsed.videoUrl === "string" ? parsed.videoUrl : parsed.videoId,
        videoId: parsed.videoId,
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        author: typeof parsed.author === "string" ? parsed.author : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveVideoContext(ctx: VideoContext): void {
  try {
    sessionStorage.setItem(VIDEO_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    // storage penuh / mode privat — abaikan, auto-fill tidak kritis
  }
}

export function clearVideoContext(): void {
  try {
    sessionStorage.removeItem(VIDEO_CONTEXT_KEY);
  } catch {
    // abaikan
  }
}
