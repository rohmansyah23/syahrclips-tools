"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { FlowSteps } from "@/components/FlowSteps";
import { ErrorNotice } from "@/components/ErrorNotice";
import { formatRange } from "@/lib/format";
import { buildPromptBundle } from "@/lib/llm";
import type { TranscriptResult } from "@/lib/types";

const SESSION_KEY = "syahrclips:transcript";

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        // Dipulihkan sekali setelah hydration — state client-only, bukan
        // sinkronisasi antar-render (lazy init akan mismatch dengan SSR).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResult(JSON.parse(saved) as TranscriptResult);
      }
    } catch {
      // data sesi rusak — abaikan
    }
  }, []);

  useEffect(() => {
    if (result) sessionStorage.setItem(SESSION_KEY, JSON.stringify(result));
  }, [result]);

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

  async function copyPromptBundle() {
    if (!result) return;
    await navigator.clipboard.writeText(buildPromptBundle(result.text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        index="01"
        label="TRANSCRIPT"
        breadcrumb="Transkrip"
        title="Unduh Transkrip YouTube"
        description="Tempel URL video untuk mendapatkan transkrip ber-timestamp, siap disalin ke LLM."
      />

      <FlowSteps current={1} />

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
              <span className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" onClick={copyPromptBundle}>
                  {copied ? "Prompt tersalin ✓" : "Salin prompt + transkrip"}
                </Button>
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
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Satu klik: prompt + transkrip sudah tergabung, tinggal tempel ke
              ChatGPT/Claude. LLM akan memilih momen dalam format JSON{" "}
              <code className="font-mono">{"{ start, end }"}</code>.
            </p>
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

          <Card className="max-w-2xl border-accent/40 bg-accent/10 p-5">
            <p className="micro-label mb-2 text-accent">Langkah berikutnya</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Setelah LLM mengeluarkan daftar momen dalam JSON, tempel JSON beserta
              link videonya di halaman Preview untuk melihat pratinjau tiap rentang
              sebelum diunduh.
            </p>
            <Link
              href="/tools/preview"
              className="mt-3 inline-block text-sm font-medium underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-foreground"
            >
              Buka Preview →
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
