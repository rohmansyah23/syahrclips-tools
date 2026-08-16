import Link from "next/link";
import { Badge, Card } from "@/components/ui";

const steps = [
  {
    href: "/tools/transcript",
    index: "01",
    label: "TRANSCRIPT",
    title: "Unduh Transkrip YouTube",
    description:
      "Tempel URL video, dapatkan transkrip ber-timestamp [HH:MM:SS] siap untuk analisis LLM.",
    cta: "Mulai langkah 1",
  },
  {
    href: "/tools/preview",
    index: "02",
    label: "PREVIEW",
    title: "Preview Candidate Klip",
    description:
      "Tempel JSON candidate dari LLM, lihat pratinjau tiap rentang langsung di player.",
    cta: "Mulai langkah 2",
  },
  {
    href: "/tools/clip",
    index: "03",
    label: "CLIP",
    title: "Download Klip Video",
    description:
      "Potong dan unduh klip mp4 dari rentang waktu tertentu, cepat tanpa re-encode.",
    cta: "Mulai langkah 3",
  },
];

const alur = [
  "Unduh transkrip ber-timestamp dari video YouTube.",
  "Tempel transkrip ke ChatGPT/Claude, minta daftar momen menarik dalam format JSON.",
  "Tempel JSON + link video di halaman Preview untuk melihat pratinjau tiap rentang.",
  "Unduh rentang pilihan sebagai klip mp4, tanpa re-encode.",
];

export default function Home() {
  return (
    <div className="container-editorial py-16 sm:py-24">
      <section className="mb-12 max-w-2xl">
        <p className="micro-label mb-4 text-accent">TOOLS</p>
        <h1 className="font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          Riset klip YouTube dalam 3 langkah.
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Ambil transkrip → pilih momen menarik dengan bantuan LLM → preview dan
          unduh klip. Tanpa akun, tanpa API key, tanpa database.
        </p>
      </section>

      <section className="mb-14 max-w-2xl">
        <Card className="p-6">
          <p className="micro-label mb-3 text-accent">Bagaimana alur lengkapnya?</p>
          <ol className="space-y-2.5">
            {alur.map((item, i) => (
              <li
                key={i}
                className="grid grid-cols-[24px_1fr] gap-3 text-sm leading-6 text-muted-foreground"
              >
                <span className="font-mono text-xs text-foreground">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="border-b border-border">
        {steps.map((step, i) => (
          <div key={step.href}>
            <Link
              href={step.href}
              className="group grid grid-cols-[64px_1fr] gap-x-5 gap-y-3 border-t border-border py-8 sm:grid-cols-[96px_1fr_auto] sm:items-center sm:gap-x-8"
            >
              <span className="font-serif text-4xl tracking-tight text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
                {step.index}
              </span>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <span className="micro-label text-accent">{step.label}</span>
                  <Badge>Baru</Badge>
                </div>
                <h2 className="font-serif text-2xl tracking-tight">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
              <span className="micro-label col-span-2 text-muted-foreground transition-colors duration-200 group-hover:text-foreground sm:col-span-1 sm:text-right">
                {step.cta} →
              </span>
            </Link>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1 font-mono text-xs text-border">
                ↓
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
