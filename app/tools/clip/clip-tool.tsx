"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Input, SectionHeader, Select } from "@/components/ui";
import { FlowSteps } from "@/components/FlowSteps";
import { ErrorNotice } from "@/components/ErrorNotice";
import { CLIP_RESOLUTIONS, DEFAULT_CLIP_RESOLUTION, MAX_CLIP_SECONDS } from "@/lib/constants";
import { formatRange, formatTimestamp } from "@/lib/format";
import { clearVideoContext, getVideoContext } from "@/lib/session";
import { parseTimeToSeconds } from "@/lib/time";
import { parseYouTubeUrl } from "@/lib/youtube";

type Status = "idle" | "loading" | "done" | "error";

interface ApiError {
  status: number;
  message: string;
}

function formatInitialSeconds(value: string): string {
  const seconds = parseTimeToSeconds(value);
  return seconds === null ? value : formatTimestamp(seconds);
}

export function ClipTool({
  initialVideoId,
  initialStart,
  initialEnd,
}: {
  initialVideoId: string;
  initialStart: string;
  initialEnd: string;
}) {
  const [videoInput, setVideoInput] = useState(initialVideoId);
  const [start, setStart] = useState(() => formatInitialSeconds(initialStart));
  const [end, setEnd] = useState(() => formatInitialSeconds(initialEnd));
  const [resolution, setResolution] = useState(String(DEFAULT_CLIP_RESOLUTION));
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [videoFromTranscript, setVideoFromTranscript] = useState(false);

  useEffect(() => {
    if (initialVideoId) return;
    const ctx = getVideoContext();
    if (ctx) {
      setVideoInput(ctx.videoUrl || ctx.videoId); // eslint-disable-line react-hooks/set-state-in-effect
      setVideoFromTranscript(true);
    }
  }, [initialVideoId]);

  const startSeconds = parseTimeToSeconds(start);
  const endSeconds = parseTimeToSeconds(end);
  const rangeValid = startSeconds !== null && endSeconds !== null && endSeconds > startSeconds;

  const done = [
    videoInput ? 1 : null,
    start && end ? 2 : null,
  ].filter((n): n is number => n !== null);

  async function submitDownload() {
    const videoId = parseYouTubeUrl(videoInput);
    if (!videoId) {
      setStatus("error");
      setError({ status: 0, message: "URL atau videoId YouTube tidak valid." });
      return;
    }
    if (!start || !end) {
      setStatus("error");
      setError({ status: 0, message: "Isi start dan end (mis. 65, 01:05, atau 00:01:05)." });
      return;
    }
    const s = parseTimeToSeconds(start);
    const en = parseTimeToSeconds(end);
    if (s === null || en === null) {
      setStatus("error");
      setError({
        status: 0,
        message: "Start/end tidak dikenali — terima 65, 01:05, atau 00:01:05.",
      });
      return;
    }
    if (s < 0 || en <= s) {
      setStatus("error");
      setError({ status: 0, message: "Rentang tidak valid: start ≥ 0 dan end > start." });
      return;
    }

    setStatus("loading");
    setError(null);
    setMessage("Mempersiapkan klip…");
    try {
      const res = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          start: Math.floor(s),
          end: Math.ceil(en),
          resolution: Number(resolution),
        }),
      });
      if (!res.ok) {
        let msg = "Gagal membuat klip.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          // body bukan JSON — biarkan pesan default
        }
        setStatus("error");
        setError({ status: res.status, message: msg });
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `klip-${videoId}.mp4`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke ditunda — revoke langsung bisa membatalkan download yang baru mulai.
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);

      const usedRes = res.headers.get("X-Clip-Resolution");
      const usedCodec = res.headers.get("X-Clip-Codec");
      const degraded = res.headers.get("X-Clip-Degraded") === "1";
      const used = Number(usedRes);
      const target = Number(resolution);
      let msg = "Klip selesai diunduh.";
      if (Number.isFinite(used) && used > 0) {
        if (degraded && used < target) {
          msg = `Klip selesai diunduh — diturunkan otomatis ke ${used}p (stream YouTube lambat).`;
        } else if (degraded) {
          msg = `Klip selesai diunduh — ${used}p dengan codec ${usedCodec ?? "ringan"} (kualitas penuh terlalu lambat).`;
        } else {
          msg = `Klip selesai diunduh (${used}p${usedCodec ? `, ${usedCodec}` : ""}).`;
        }
      }
      setStatus("done");
      setMessage(msg);
    } catch {
      setStatus("error");
      setError({ status: 0, message: "Gagal terhubung ke server, coba lagi." });
    }
  }

  async function handleDownload(e: FormEvent) {
    e.preventDefault();
    await submitDownload();
  }

  function resetAll() {
    setVideoInput("");
    setStart("");
    setEnd("");
    setResolution(String(DEFAULT_CLIP_RESOLUTION));
    setStatus("idle");
    setMessage("");
    setError(null);
    setVideoFromTranscript(false);
    clearVideoContext();
  }

  return (
    <div className="container-editorial py-14 sm:py-20">
      <SectionHeader
        index="03"
        label="CLIP"
        breadcrumb="Klip"
        title="Download Klip Video"
        description={`Potong rentang video menjadi klip mp4 (maks ${MAX_CLIP_SECONDS / 60} menit, hingga ${CLIP_RESOLUTIONS[0]}p) tanpa re-encode — cepat dan siap diputar.`}
      />

      <FlowSteps current={3} done={done} />

      {initialVideoId && (
        <Card className="mb-8 max-w-xl bg-muted px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Klip dari candidate preview
          </p>
          <p className="mt-1 text-sm leading-6">
            Video dan rentang sudah terisi dari halaman Preview. Ubah bila perlu,
            lalu unduh.
          </p>
          <Link
            href="/tools/preview"
            className="mt-2 inline-block text-xs font-medium underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-foreground"
          >
            ← Kembali ke Preview
          </Link>
        </Card>
      )}

      {!initialVideoId && videoFromTranscript && (
        <Card className="mb-8 max-w-xl bg-muted px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Video dari transkrip (langkah 1)
          </p>
          <p className="mt-1 text-sm leading-6">
            Kolom video sudah terisi otomatis. Isi rentang start/end di bawah, atau
            pilih rentang dari halaman Preview.
          </p>
          <Link
            href="/tools/preview"
            className="mt-2 inline-block text-xs font-medium underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-foreground"
          >
            Pilih rentang di Preview →
          </Link>
        </Card>
      )}

      <form onSubmit={handleDownload} className="mb-8 max-w-xl space-y-4">
        <div>
          <label htmlFor="clip-video" className="micro-label mb-2 block text-muted-foreground">
            videoId atau URL YouTube
          </label>
          <Input
            id="clip-video"
            value={videoInput}
            onChange={(e) => {
              setVideoInput(e.target.value);
              setVideoFromTranscript(false);
            }}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="clip-start" className="micro-label mb-2 block text-muted-foreground">
              Start
            </label>
            <Input
              id="clip-start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="00:01:05"
            />
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Terima 65, 01:05, atau 00:01:05.
            </p>
          </div>
          <div>
            <label htmlFor="clip-end" className="micro-label mb-2 block text-muted-foreground">
              End
            </label>
            <Input
              id="clip-end"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="00:01:10"
            />
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Terima 70, 01:10, atau 00:01:10.
            </p>
          </div>
          <div>
            <label htmlFor="clip-resolution" className="micro-label mb-2 block text-muted-foreground">
              Resolusi maksimal
            </label>
            <Select
              id="clip-resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              {CLIP_RESOLUTIONS.map((r) => (
                <option key={r} value={String(r)}>
                  {r}p
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Otomatis turun ke resolusi lebih rendah bila stream YouTube lambat.
            </p>
          </div>
        </div>
        {rangeValid && (
          <div className="border-t border-border pt-4">
            <p className="micro-label mb-1 text-muted-foreground">Rentang aktif</p>
            <p className="font-mono text-sm text-accent">
              {formatRange(startSeconds, endSeconds)}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Format sama dengan di halaman Preview.
            </p>
          </div>
        )}
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Menyiapkan klip…" : "Download klip"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={resetAll}
          disabled={status === "loading" || (!videoInput && !start && !end)}
        >
          Reset
        </Button>
      </form>

      {status === "error" && error && (
        <ErrorNotice
          key={`${error.status}-${error.message}`}
          className="max-w-xl"
          code={error.status || undefined}
          message={error.message}
          onRetry={
            error.status === 429 || error.status === 502 || error.status === 504
              ? submitDownload
              : undefined
          }
        />
      )}

      {message && status !== "idle" && status !== "error" && (
        <Card className="max-w-xl bg-muted px-4 py-3 text-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {status === "loading" ? "Status" : "Selesai"}
          </p>
          <p className="mt-1">{message}</p>
        </Card>
      )}
    </div>
  );
}
