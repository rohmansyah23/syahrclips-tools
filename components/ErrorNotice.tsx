"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, cn } from "@/components/ui";
import { getErrorMeta } from "@/lib/error-meta";

interface ErrorNoticeProps {
  /** Kode HTTP dari API. Jika tidak ada, ditampilkan sebagai peringatan umum. */
  code?: number;
  /** Pesan error mentah dari server/validasi. */
  message: string;
  /** Dipanggil saat tombol "Coba lagi" ditekan (untuk error yang bisa diulang). */
  onRetry?: () => void;
  className?: string;
}

function badgeLabel(code: number): string {
  if (code === 429) return "RATE LIMIT";
  if (code === 403) return "AKSES DITOLAK";
  if (code === 404) return "TIDAK DITEMUKAN";
  if (code === 400) return "INPUT INVALID";
  return `ERR ${code}`;
}

export function ErrorNotice({ code, message, onRetry, className }: ErrorNoticeProps) {
  const meta = code !== undefined ? getErrorMeta(code) : null;
  // 429 butuh jeda lebih lama sebelum coba lagi; 502/504 cukup sebentar.
  // ErrorNotice di-remount oleh pemanggil (via key) setiap error baru.
  const retryDelay = code === 429 ? 15 : 5;
  const [retryAt] = useState(() => Date.now() + retryDelay * 1000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5">
        <Badge variant={code === 403 ? "solid" : "accent"}>
          {code !== undefined ? badgeLabel(code) : "PERHATIAN"}
        </Badge>
        {code !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">HTTP {code}</span>
        )}
      </div>
      <div className="px-5 py-4">
        {meta && <h3 className="font-serif text-lg tracking-tight">{meta.label}</h3>}
        <p className="mt-1.5 text-sm leading-6 text-foreground">{message}</p>
        {meta?.hint && <p className="mt-2 text-xs leading-5 text-muted-foreground">{meta.hint}</p>}
        {onRetry && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRetry}
            disabled={remaining > 0}
            className="mt-4"
          >
            {remaining > 0 ? `Coba lagi (${remaining}s)` : "Coba lagi"}
          </Button>
        )}
      </div>
    </Card>
  );
}
