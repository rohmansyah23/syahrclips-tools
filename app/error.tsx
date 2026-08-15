"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="container-editorial py-24">
      <p className="micro-label mb-4 text-accent">ERROR</p>
      <h1 className="font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
        Terjadi kesalahan.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
        Halaman ini gagal dimuat. Coba muat ulang, atau kembali ke beranda.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Coba lagi</Button>
        <Button variant="secondary" onClick={() => router.push("/")}>
          Ke beranda
        </Button>
      </div>
    </div>
  );
}
