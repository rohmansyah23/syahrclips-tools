"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Input, SectionHeader, Textarea } from "@/components/ui";
import { CandidateModal } from "@/components/CandidateModal";
import { FlowSteps } from "@/components/FlowSteps";
import { formatRange } from "@/lib/format";
import { parseYouTubeUrl } from "@/lib/youtube";
import { parseRangeToSeconds, parseTimeToSeconds } from "@/lib/time";
import { LLM_PROMPT, TIME_CONVERSIONS } from "@/lib/constants";
import { copyText } from "@/lib/clipboard";
import { clearVideoContext, getVideoContext } from "@/lib/session";
import type { ClipCandidate } from "@/lib/types";

const SESSION_KEY = "syahrclips:preview";

const EXAMPLE_JSON = `[
  { "start": 65, "end": 70, "reason": "momen paling menarik" },
  { "start": 120, "end": 135 }
]`;

const EXAMPLE_VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

interface CandidateView extends ClipCandidate {
  invalid?: string;
  convertedNote?: string;
}

function toSeconds(value: unknown): { seconds: number; converted?: string } | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? { seconds: value } : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const seconds = parseTimeToSeconds(trimmed);
  if (seconds === null) return null;
  return { seconds, converted: trimmed === String(seconds) ? undefined : trimmed };
}

function parseCandidates(raw: string): { candidates: CandidateView[]; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { candidates: [], error: "JSON tidak valid. Periksa tanda kurung dan koma." };
  }

  if (Array.isArray(parsed)) {
    return { candidates: validate(parsed), error: null };
  }
  if (parsed && typeof parsed === "object") {
    const arr = (parsed as { candidates?: unknown }).candidates;
    if (Array.isArray(arr)) return { candidates: validate(arr), error: null };
  }
  return {
    candidates: [],
    error: "Format salah — harus array, misalnya: " + EXAMPLE_JSON,
  };
}

function validate(items: unknown[]): CandidateView[] {
  return items.map((item, i) => {
    const obj = item as Record<string, unknown>;
    const base: CandidateView = {
      start: NaN,
      end: NaN,
      reason: typeof obj?.reason === "string" ? obj.reason : undefined,
      score: typeof obj?.score === "number" ? obj.score : undefined,
      title: typeof obj?.title === "string" ? obj.title : undefined,
    };

    const rawStart = obj?.start;
    const rawEnd = obj?.end;
    const range = typeof rawStart === "string" ? parseRangeToSeconds(rawStart) : null;

    if (range) {
      base.start = range.start;
      base.end = range.end;
      base.convertedNote = `rentang dipecah: ${rawStart} → ${Math.floor(range.start)}–${Math.floor(range.end)} dtk`;
    } else {
      const s = toSeconds(rawStart);
      const e = toSeconds(rawEnd);
      if (!s || !e) {
        base.invalid = `Item #${i + 1}: start/end tidak dikenali — contoh "65", "01:05", atau "00:01:05".`;
      } else {
        base.start = s.seconds;
        base.end = e.seconds;
        const parts: string[] = [];
        if (s.converted) parts.push(`${s.converted} → ${s.seconds} dtk`);
        if (e.converted) parts.push(`${e.converted} → ${e.seconds} dtk`);
        if (parts.length > 0) base.convertedNote = "auto-konversi: " + parts.join(" · ");
      }
    }

    if (!base.invalid && (base.start < 0 || base.end <= base.start)) {
      base.invalid = `Item #${i + 1}: start ≥ 0 dan end > start.`;
    }
    return base;
  });
}

export default function PreviewPage() {
  const [videoInput, setVideoInput] = useState("");
  const [jsonInput, setJsonInput] = useState(EXAMPLE_JSON);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(true);
  const [videoFromTranscript, setVideoFromTranscript] = useState(false);
  const [step1Done, setStep1Done] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      let restoredVideo: string | undefined;
      let restoredJson: string | undefined;
      if (saved) {
        const parsed = JSON.parse(saved) as { videoInput?: string; jsonInput?: string };
        if (typeof parsed.videoInput === "string") restoredVideo = parsed.videoInput;
        if (typeof parsed.jsonInput === "string") restoredJson = parsed.jsonInput;
      }
      // Dipulihkan sekali setelah hydration — lihat catatan di transcript page.
      const ctx = getVideoContext();
      if (ctx) {
        if (!restoredVideo) {
          restoredVideo = ctx.videoUrl || ctx.videoId;
          setVideoFromTranscript(true); // eslint-disable-line react-hooks/set-state-in-effect
        }
        setStep1Done(true);
      }
      if (typeof restoredVideo === "string") setVideoInput(restoredVideo);
      if (typeof restoredJson === "string") setJsonInput(restoredJson);
      // Sinyal bahwa pemulihan selesai — tanpa ini, efek penyimpanan menimpa
      // sessionStorage dengan nilai kosong dari render pertama (stale closure).
      setRestored(true);
    } catch {
      // data sesi rusak — abaikan
    }
  }, []);

  useEffect(() => {
    if (!restored) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ videoInput, jsonInput }));
  }, [videoInput, jsonInput, restored]);

  async function copyPrompt() {
    await copyText(LLM_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePreview() {
    const id = parseYouTubeUrl(videoInput);
    if (!id) {
      setVideoError("URL atau videoId YouTube tidak valid.");
      setVideoId(null);
      setCandidates([]);
      return;
    }
    setVideoError(null);
    setVideoId(id);

    const { candidates, error } = parseCandidates(jsonInput);
    setCandidates(candidates);
    setJsonError(error);
    if (candidates.length > 0) setFormOpen(false);
  }

  function loadExample() {
    setVideoInput(EXAMPLE_VIDEO);
    setJsonInput(EXAMPLE_JSON);
    setVideoError(null);
    setJsonError(null);
    setVideoId(parseYouTubeUrl(EXAMPLE_VIDEO));
    const { candidates, error } = parseCandidates(EXAMPLE_JSON);
    setCandidates(candidates);
    setJsonError(error);
    setFormOpen(false);
  }

  async function copyCandidate(c: ClipCandidate) {
    const payload: Record<string, number | string> = { start: c.start, end: c.end };
    if (c.reason) payload.reason = c.reason;
    if (typeof c.score === "number") payload.score = c.score;
    if (c.title) payload.title = c.title;
    await copyText(JSON.stringify(payload));
  }

  function resetAll() {
    setVideoInput("");
    setJsonInput("");
    setVideoId(null);
    setVideoError(null);
    setCandidates([]);
    setJsonError(null);
    setCopied(false);
    setActiveIndex(null);
    setFormOpen(true);
    setVideoFromTranscript(false);
    setStep1Done(false);
    sessionStorage.removeItem(SESSION_KEY);
    clearVideoContext();
  }

  function handleTune(index: number, start: number, end: number) {
    setCandidates((prev) =>
      prev.map((c, i) =>
        i === index
          ? { ...c, start, end, invalid: undefined, convertedNote: undefined }
          : c,
      ),
    );
    try {
      const arr = JSON.parse(jsonInput) as unknown[];
      const target = arr[index] as Record<string, unknown> | undefined;
      if (target && typeof target === "object") {
        target.start = start;
        target.end = end;
        setJsonInput(JSON.stringify(arr, null, 2));
      }
    } catch {
      // textarea sudah diubah sejak Preview — lewati sinkron, kartu tetap ter-update
    }
  }

  const validCount = candidates.filter((c) => !c.invalid).length;
  const hasResults = videoId !== null && candidates.length > 0;

  return (
    <div className="container-editorial py-14 sm:py-20">
      <SectionHeader
        index="02"
        label="PREVIEW"
        breadcrumb="Preview"
        title="Preview Candidate Klip"
        description="Tempel JSON candidate dari LLM bersama videoId/URL video, lalu pratinjau tiap rentang."
      />

      <FlowSteps current={2} done={step1Done ? [1] : []} />

      {formOpen && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={videoInput}
              onChange={(e) => {
                setVideoInput(e.target.value);
                setVideoFromTranscript(false);
              }}
              placeholder="videoId atau URL YouTube"
              className="sm:max-w-md"
            />
            <Button onClick={handlePreview} className="w-full sm:w-auto sm:shrink-0">
              Preview
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={loadExample}
              className="w-full sm:w-auto sm:shrink-0"
            >
              Muat contoh
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetAll}
              disabled={!videoInput && !jsonInput && candidates.length === 0}
              className="w-full sm:w-auto sm:shrink-0"
            >
              Reset
            </Button>
          </div>
          {videoFromTranscript && (
            <p className="text-xs leading-5 text-accent">
              ✓ Video otomatis terisi dari transkrip (langkah 1) — cukup tempel JSON
              candidate di bawah.
            </p>
          )}
          {videoError && <p className="text-sm text-foreground">⚠ {videoError}</p>}
          <Textarea
            rows={8}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={EXAMPLE_JSON}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            JSON candidate dibuat dari transkrip{" "}
            <Link
              href="/tools/transcript"
              className="underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-foreground"
            >
              langkah 1
            </Link>
            — tempel transkrip ke ChatGPT/Claude dan minta daftar{" "}
            <code className="font-mono">{"{ start, end }"}</code> momen menarik.
          </p>
          {jsonError && <p className="text-sm text-foreground">⚠ {jsonError}</p>}
        </div>
      )}

      {hasResults && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="accent">YouTube</Badge>
            <span className="font-mono text-xs text-muted-foreground">{videoId}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {validCount} dari {candidates.length} candidate valid
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto w-full sm:w-auto"
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? "Tutup form" : "Edit JSON"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetAll} className="w-full sm:w-auto">
              Reset
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {candidates.map((c, i) => (
              <Card key={i} className="flex flex-col">
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-accent">
                      {formatRange(c.start, c.end)}
                    </span>
                    {typeof c.score === "number" && (
                      <Badge variant="solid">Skor {c.score}</Badge>
                    )}
                  </div>
                  {c.invalid && (
                    <p className="font-mono text-xs leading-5 text-muted-foreground">
                      {c.invalid}
                    </p>
                  )}
                  {c.convertedNote && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.convertedNote}
                    </p>
                  )}
                  {c.reason && <p className="text-sm leading-6 text-muted-foreground">{c.reason}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      disabled={!!c.invalid}
                      onClick={() => setActiveIndex(i)}
                    >
                      Lihat Video
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!!c.invalid}
                      onClick={() => copyCandidate(c)}
                    >
                      Salin format
                    </Button>
                    <Link
                      href={`/tools/clip?videoId=${videoId}&start=${Math.floor(c.start)}&end=${Math.ceil(c.end)}`}
                      className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm bg-foreground px-4 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98] sm:h-8 sm:px-3.5 sm:text-xs"
                    >
                      Unduh klip
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className={hasResults ? "mb-12 mt-12 max-w-2xl p-6" : "mb-12 max-w-2xl p-6"}>
        <p className="micro-label mb-2 text-accent">Prompt untuk LLM</p>
        <p className="text-sm leading-6 text-muted-foreground">
          Transkrip memakai format{" "}
          <code className="font-mono text-xs">[HH:MM:SS – HH:MM:SS]</code> (jam:menit:detik),
          misalnya <code className="font-mono text-xs">[00:00:00 – 00:00:07]</code> berarti
          detik 0 sampai 7 — bukan 7 menit. Supaya LLM tidak salah kalkulasi, gunakan prompt
          di bawah saat menempel transkrip dari langkah 1.
        </p>

        <div className="mt-4 border-t border-border pt-4">
          <p className="micro-label mb-3 text-muted-foreground">Tabel konversi</p>
          <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-5">
            {TIME_CONVERSIONS.map((c) => (
              <div key={c.format} className="bg-card px-3 py-2">
                <p className="font-mono text-xs">{c.format}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  → {c.seconds} detik
                </p>
              </div>
            ))}
          </div>
        </div>

        <details className="group mt-5 border-t border-border pt-4">
          <summary className="micro-label cursor-pointer select-none text-muted-foreground transition-colors duration-200 hover:text-foreground">
            Lihat prompt lengkap
          </summary>
          <pre className="mt-4 whitespace-pre-wrap rounded-sm border border-border bg-card p-4 font-mono text-xs leading-6 text-muted-foreground">
            {LLM_PROMPT}
          </pre>
          <Button size="sm" variant="secondary" onClick={copyPrompt} className="mt-3">
            {copied ? "Tersalin ✓" : "Salin prompt"}
          </Button>
        </details>
      </Card>

      {activeIndex !== null && candidates[activeIndex] && (
        <CandidateModal
          videoId={videoId as string}
          index={activeIndex}
          candidate={candidates[activeIndex]}
          onTune={handleTune}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </div>
  );
}
