"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Badge, Button, Card, Input, SectionHeader } from "@/components/ui";
import { FlowSteps } from "@/components/FlowSteps";
import { ErrorNotice } from "@/components/ErrorNotice";
import { formatRange } from "@/lib/format";
import { buildPromptBundle } from "@/lib/llm";
import { copyText } from "@/lib/clipboard";
import { clearVideoContext, saveVideoContext } from "@/lib/session";
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
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const INITIAL_SEGMENTS = 10;
  const visibleSegments = showAll ? result?.segments ?? [] : (result?.segments ?? []).slice(0, INITIAL_SEGMENTS);

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
    setShowAll(false);
    setCopyError(null);
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
      saveVideoContext({
        videoUrl: url.trim(),
        videoId: data.videoId,
        title: data.title || undefined,
        author: data.author || undefined,
      });
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
    try {
      await copyText(result.text);
    } catch {
      setCopyError("Salin gagal, silakan salin manual dari teks di bawah.");
    }
  }

  async function copyPromptBundle() {
    if (!result) return;
    try {
      await copyText(buildPromptBundle(result.text));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Salin gagal, silakan salin manual dari teks di bawah.");
    }
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

  function resetAll() {
    setUrl("");
    setResult(null);
    setError(null);
    setLoading(false);
    setCopied(false);
    setCopyError(null);
    setShowAll(false);
    sessionStorage.removeItem(SESSION_KEY);
    clearVideoContext();
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
        <Button type="submit" disabled={loading || !url.trim()} className="w-full sm:w-auto sm:shrink-0">
          {loading ? "Mengambil transkrip…" : "Ambil transkrip"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={resetAll}
          disabled={!url.trim() && !result}
          className="w-full sm:w-auto sm:shrink-0"
        >
          Reset
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
              <span className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <Button size="sm" onClick={copyPromptBundle} className="w-full sm:w-auto">
                  {copied ? "Prompt tersalin ✓" : "Salin prompt + transkrip"}
                </Button>
                <Button size="sm" variant="secondary" onClick={copyAll} className="w-full sm:w-auto">
                  Salin semua
                </Button>
                <Button size="sm" variant="secondary" onClick={downloadTxt} className="w-full sm:w-auto">
                  ↓ .txt
                </Button>
              </span>
            </div>
            {copyError && (
              <p className="mb-3 text-xs text-accent" role="alert">
                {copyError}
              </p>
            )}
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
            <p className="mt-2 text-xs leading-5 text-accent">
              Video ini otomatis terisi di Preview (langkah 2) dan Klip (langkah 3).
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
            {visibleSegments.map((segment, i) => (
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

          {result.segments.length > INITIAL_SEGMENTS && (
            <div className="text-center">
              <Button variant="secondary" onClick={() => setShowAll((v) => !v)} className="w-full sm:w-auto">
                {showAll
                  ? "Tampilkan lebih sedikit"
                  : `Lihat semua transkrip (${result.segments.length} segmen)`}
              </Button>
            </div>
          )}

          <Card className="max-w-2xl border-accent/40 bg-accent/10 p-5">
            <p className="micro-label mb-2 text-accent">Langkah berikutnya</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Setelah LLM mengeluarkan daftar momen dalam JSON, tempel JSON beserta
              link videonya di halaman Preview untuk melihat pratinjau tiap rentang
              sebelum diunduh.
            </p>
            <Link
              href="/tools/preview"
              className="mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-foreground px-5 text-sm font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98] sm:w-auto"
            >
              Lanjut ke Preview → video sudah terisi
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
