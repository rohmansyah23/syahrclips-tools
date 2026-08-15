"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Card, Input, SectionHeader, Select } from "@/components/ui";
import { ErrorNotice } from "@/components/ErrorNotice";
import { CLIP_RESOLUTIONS, DEFAULT_CLIP_RESOLUTION, MAX_CLIP_SECONDS } from "@/lib/constants";
import { parseYouTubeUrl } from "@/lib/youtube";

type Status = "idle" | "loading" | "done" | "error";

interface ApiError {
  status: number;
  message: string;
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
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [resolution, setResolution] = useState(String(DEFAULT_CLIP_RESOLUTION));
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<ApiError | null>(null);

  async function submitDownload() {
    const videoId = parseYouTubeUrl(videoInput);
    if (!videoId) {
      setStatus("error");
      setError({ status: 0, message: "URL atau videoId YouTube tidak valid." });
      return;
    }
    if (!start || !end) {
      setStatus("error");
      setError({ status: 0, message: "Isi start dan end (detik)." });
      return;
    }
    const s = Number(start);
    const en = Number(end);
    if (!Number.isFinite(s) || !Number.isFinite(en) || s < 0 || en <= s) {
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
        body: JSON.stringify({ videoId, start: s, end: en, resolution: Number(resolution) }),
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

  return (
    <div className="container-editorial py-14 sm:py-20">
      <SectionHeader
        index="04"
        label="CLIP"
        title="Download Klip Video"
        description={`Potong rentang video menjadi klip mp4 (maks ${MAX_CLIP_SECONDS / 60} menit, hingga ${CLIP_RESOLUTIONS[0]}p) tanpa re-encode — cepat dan siap diputar.`}
      />

      <form onSubmit={handleDownload} className="mb-8 max-w-xl space-y-4">
        <div>
          <label htmlFor="clip-video" className="micro-label mb-2 block text-muted-foreground">
            videoId atau URL YouTube
          </label>
          <Input
            id="clip-video"
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="clip-start" className="micro-label mb-2 block text-muted-foreground">
              Start (detik)
            </label>
            <Input
              id="clip-start"
              type="number"
              min={0}
              step={1}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="65"
            />
          </div>
          <div>
            <label htmlFor="clip-end" className="micro-label mb-2 block text-muted-foreground">
              End (detik)
            </label>
            <Input
              id="clip-end"
              type="number"
              min={0}
              step={1}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="70"
            />
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
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Menyiapkan klip…" : "Download klip"}
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
