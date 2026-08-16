"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Input } from "@/components/ui";
import { formatRange, formatTimestamp } from "@/lib/format";
import { parseTimeToSeconds } from "@/lib/time";

interface CandidateModalProps {
  videoId: string;
  index: number;
  candidate: {
    start: number;
    end: number;
    title?: string;
    reason?: string;
    score?: number;
  };
  onTune: (index: number, start: number, end: number) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number | boolean>;
          events?: { onStateChange?: (event: { data: number }) => void };
        },
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  destroy(): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
}

const PLAYING = 1;

let iframeApiPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (!iframeApiPromise) {
    iframeApiPromise = new Promise((resolve) => {
      if (window.YT?.Player) {
        resolve();
        return;
      }
      window.onYouTubeIframeAPIReady = () => resolve();
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
  }
  return iframeApiPromise;
}

function CloseIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function CandidateModal({
  videoId,
  index,
  candidate,
  onTune,
  onClose,
}: CandidateModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endRef = useRef(candidate.end);
  const initialStartRef = useRef(Math.floor(candidate.start));
  const onCloseRef = useRef(onClose);

  const [start, setStart] = useState(candidate.start);
  const [end, setEnd] = useState(candidate.end);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    endRef.current = end;
  }, [end]);

  const stopEndTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startEndTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      if (p.getCurrentTime() >= endRef.current) {
        p.pauseVideo();
        setReachedEnd(true);
        stopEndTimer();
      }
    }, 250);
  }, [stopEndTimer]);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeIframeApi().then(() => {
      if (cancelled || !containerRef.current || window.YT?.Player == null) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1,
          start: initialStartRef.current,
        },
        events: {
          onStateChange: (e) => {
            if (e.data === PLAYING) startEndTimer();
            else stopEndTimer();
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [videoId, startEndTimer, stopEndTimer]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      stopEndTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [stopEndTimer]);

  function replay() {
    const p = playerRef.current;
    if (!p) return;
    setReachedEnd(false);
    p.seekTo(Math.floor(start), true);
    p.playVideo();
  }

  function openEdit() {
    setStartInput(formatTimestamp(start));
    setEndInput(formatTimestamp(end));
    setEditError(null);
    setEditing(true);
  }

  function saveTuning() {
    const s = parseTimeToSeconds(startInput);
    const e = parseTimeToSeconds(endInput);
    if (s === null || e === null || e <= s) {
      setEditError(
        'Nilai tidak valid — terima 65, 01:05, atau 00:01:05, dan end > start.',
      );
      return;
    }
    const floorStart = Math.floor(s);
    const ceilEnd = Math.ceil(e);
    setStart(floorStart);
    setEnd(ceilEnd);
    setEditing(false);
    setEditError(null);
    setReachedEnd(false);
    onTune(index, floorStart, ceilEnd);
    playerRef.current?.seekTo(floorStart, true);
    playerRef.current?.playVideo();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview klip"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <p className="truncate font-mono text-xs text-accent">{formatRange(start, end)}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="aspect-video w-full bg-black" ref={containerRef} />

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            {typeof candidate.score === "number" && <Badge variant="solid">Skor {candidate.score}</Badge>}
            <span className="font-mono text-xs text-muted-foreground">{videoId}</span>
          </div>
          {candidate.reason && (
            <p className="text-sm leading-6 text-muted-foreground">{candidate.reason}</p>
          )}

          {!editing && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button size="sm" variant="secondary" onClick={replay} disabled={!reachedEnd}>
                <ReplayIcon />
                Putar ulang
              </Button>
              <Button size="sm" variant="ghost" onClick={openEdit}>
                <PencilIcon />
                Tuning
              </Button>
              {reachedEnd && (
                <span className="font-mono text-xs text-muted-foreground">
                  berhenti di akhir rentang — tidak kembali ke 0
                </span>
              )}
            </div>
          )}

          {editing && (
            <div className="border-t border-border pt-4">
              <p className="micro-label mb-3 text-muted-foreground">Tuning rentang</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-start" className="micro-label mb-2 block text-muted-foreground">
                    Start
                  </label>
                  <Input
                    id="modal-start"
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    placeholder="00:01:05"
                  />
                </div>
                <div>
                  <label htmlFor="modal-end" className="micro-label mb-2 block text-muted-foreground">
                    End
                  </label>
                  <Input
                    id="modal-end"
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    placeholder="00:01:10"
                  />
                </div>
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Terima 65, 01:05, atau 00:01:05.
              </p>
              {editError && <p className="mt-2 text-sm text-foreground">⚠ {editError}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={saveTuning}>
                  Simpan & putar ulang
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                  Batal
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Tekan ESC untuk menutup.</p>
            <Link
              href={`/tools/clip?videoId=${videoId}&start=${Math.floor(start)}&end=${Math.ceil(end)}`}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-sm bg-foreground px-3.5 text-xs font-medium text-background transition-all duration-200 hover:opacity-85 active:scale-[0.98]"
            >
              Unduh klip →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
