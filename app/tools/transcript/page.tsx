"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { ErrorNotice } from "@/components/ErrorNotice";
import { formatRange } from "@/lib/format";
import type { TranscriptResult } from "@/lib/types";

interface ApiError {
  status: number;
  message: string;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro-label mb-1 text-muted-foreground">{label}</p>
      <p className="font-mono text-lg">{value}</p>
    </div>
  );
}

export default function TranscriptPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ status: res.status, message: data?.error || "Gagal mengambil transkrip." });
        return;
      }
      setResult(data as TranscriptResult);
    } catch (err) {
      setError({
        status: 0,
        message: err instanceof Error ? err.message : "Terjadi kesalahan.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await submit();
  }

  async function copyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
  }

  function downloadTxt() {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.videoId}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="container-editorial py-14 sm:py-20">
      <SectionHeader
        index="02"
        label="TRANSCRIPT"
        title="Unduh Transkrip YouTube"
        description="Tempel URL video untuk mendapatkan transkrip ber-timestamp, siap disalin ke LLM."
      />

      <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-3 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="sm:max-w-xl"
        />
        <Button type="submit" disabled={loading || !url.trim()} className="sm:shrink-0">
          {loading ? "Mengambil transkrip…" : "Ambil transkrip"}
        </Button>
      </form>

      {error && (
        <ErrorNotice
          key={`${error.status}-${error.message}`}
          className="mb-8 sm:max-w-xl"
          code={error.status || undefined}
          message={error.message}
          onRetry={error.status === 429 || error.status === 502 ? submit : undefined}
        />
      )}

      {result && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge variant="accent">YouTube</Badge>
              <span className="font-mono text-xs text-muted-foreground">{result.videoId}</span>
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="secondary" onClick={copyAll}>
                  Salin semua
                </Button>
                <Button size="sm" variant="secondary" onClick={downloadTxt}>
                  ↓ .txt
                </Button>
              </span>
            </div>
            {result.title && (
              <h2 className="font-serif text-2xl tracking-tight">{result.title}</h2>
            )}
            {result.author && (
              <p className="mt-1 text-sm text-muted-foreground">{result.author}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-8 border-t border-border pt-5">
              <Stat label="Segmen" value={String(result.stats.segments)} />
              <Stat label="Kata" value={String(result.stats.words)} />
              <Stat label="Karakter" value={String(result.stats.chars)} />
            </div>
          </Card>

          <Card className="divide-y divide-border">
            {result.segments.length === 0 && (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Transkrip kosong untuk video ini.
              </p>
            )}
            {result.segments.map((segment, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[190px_1fr] sm:gap-6"
              >
                <span className="font-mono text-xs text-muted-foreground sm:pt-0.5">
                  {formatRange(segment.start, segment.end)}
                </span>
                <p className="text-sm leading-6">{segment.text}</p>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
