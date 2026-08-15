const YOUTUBE_URL_RE =
  /(?:youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

/**
 * Extract a YouTube videoId from a URL (watch, short, embed, youtu.be) or
 * accept a bare 11-character id. Returns null when the input is not a
 * valid YouTube reference.
 */
export function parseYouTubeUrl(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(YOUTUBE_URL_RE);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

export function isVideoId(value: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}
