"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Input, SectionHeader, Textarea } from "@/components/ui";
import { formatRange } from "@/lib/format";
import { parseYouTubeUrl } from "@/lib/youtube";
import type { ClipCandidate } from "@/lib/types";

const EXAMPLE_JSON = `[
  { "start": 65, "end": 70, "reason": "momen paling menarik" },
  { "start": 120, "end": 135 }
]`;

interface CandidateView extends ClipCandidate {
  invalid?: string;
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
    const start = Number(obj?.start);
    const end = Number(obj?.end);
    const base: CandidateView = {
      start: Number.isFinite(start) ? start : NaN,
      end: Number.isFinite(end) ? end : NaN,
      reason: typeof obj?.reason === "string" ? obj.reason : undefined,
      score: typeof obj?.score === "number" ? obj.score : undefined,
      title: typeof obj?.title === "string" ? obj.title : undefined,
    };
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      base.invalid = `Item #${i + 1}: start/end harus berupa angka.`;
    } else if (start < 0 || end <= start) {
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
  }

  async function copyCandidate(c: ClipCandidate) {
    const payload: Record<string, number | string> = { start: c.start, end: c.end };
    if (c.reason) payload.reason = c.reason;
    if (typeof c.score === "number") payload.score = c.score;
    if (c.title) payload.title = c.title;
    await navigator.clipboard.writeText(JSON.stringify(payload));
  }

  const validCount = candidates.filter((c) => !c.invalid).length;

  return (
    <div className="container-editorial py-14 sm:py-20">
      <SectionHeader
        index="03"
        label="PREVIEW"
        title="Preview Candidate Klip"
        description="Tempel JSON candidate dari LLM bersama videoId/URL video, lalu pratinjau tiap rentang."
      />

      <div className="mb-8 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="videoId atau URL YouTube"
            className="sm:max-w-md"
          />
          <Button onClick={handlePreview} className="sm:shrink-0">
            Preview
          </Button>
        </div>
        {videoError && <p className="text-sm text-foreground">⚠ {videoError}</p>}
        <Textarea
          rows={8}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={EXAMPLE_JSON}
        />
        {jsonError && <p className="text-sm text-foreground">⚠ {jsonError}</p>}
      </div>

      {videoId && candidates.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="accent">YouTube</Badge>
            <span className="font-mono text-xs text-muted-foreground">{videoId}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {validCount} dari {candidates.length} candidate valid
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {candidates.map((c, i) => (
              <Card key={i} className="flex flex-col overflow-hidden">
                <div className="aspect-video w-full bg-black">
                  {c.invalid ? (
                    <div className="flex h-full items-center justify-center px-6 text-center">
                      <p className="font-mono text-xs text-background/70">{c.invalid}</p>
                    </div>
                  ) : (
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${Math.floor(c.start)}&end=${Math.ceil(c.end)}`}
                      title={`Preview ${formatRange(c.start, c.end)}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-accent">
                      {formatRange(c.start, c.end)}
                    </span>
                    {typeof c.score === "number" && (
                      <Badge variant="solid">Skor {c.score}</Badge>
                    )}
                  </div>
                  {c.reason && <p className="text-sm leading-6 text-muted-foreground">{c.reason}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
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
                      className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-sm bg-foreground px-3.5 text-xs font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
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
    </div>
  );
}
