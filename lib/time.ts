const RANGE_RE = /^\s*(.+?)\s*[-–]\s*(.+?)\s*$/;
const TIME_RE = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?$/;
const SECONDS_RE = /^\d+(?:\.\d+)?$/;

export function parseTimeToSeconds(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  if (SECONDS_RE.test(raw)) return Number(raw);

  const m = raw.match(TIME_RE);
  if (!m) return null;
  const hasHours = m[3] !== undefined;
  const h = hasHours ? Number(m[1]) : 0;
  const mm = Number(m[hasHours ? 2 : 1]);
  const ss = Number(m[hasHours ? 3 : 2]);
  if (mm > 59 || ss > 59) return null;
  return h * 3600 + mm * 60 + ss;
}

export function parseRangeToSeconds(value: unknown): { start: number; end: number } | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(RANGE_RE);
  if (!m) return null;
  const start = parseTimeToSeconds(m[1]);
  const end = parseTimeToSeconds(m[2]);
  if (start === null || end === null) return null;
  return { start, end };
}
