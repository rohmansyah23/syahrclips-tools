import Link from "next/link";
import { Badge } from "@/components/ui";

const tools = [
  {
    href: "/tools/transcript",
    index: "01",
    label: "TRANSCRIPT",
    title: "Unduh Transkrip YouTube",
    description:
      "Tempel URL video, dapatkan transkrip ber-timestamp [HH:MM:SS] siap untuk analisis LLM.",
  },
  {
    href: "/tools/preview",
    index: "02",
    label: "PREVIEW",
    title: "Preview Candidate Klip",
    description:
      "Tempel JSON candidate dari LLM, lihat pratinjau tiap rentang langsung di player.",
  },
  {
    href: "/tools/clip",
    index: "03",
    label: "CLIP",
    title: "Download Klip Video",
    description:
      "Potong dan unduh klip mp4 dari rentang waktu tertentu, cepat tanpa re-encode.",
  },
];

export default function Home() {
  return (
    <div className="container-editorial py-16 sm:py-24">
      <section className="mb-14 max-w-2xl">
        <p className="micro-label mb-4 text-accent">01 / TOOLS</p>
        <h1 className="font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          Tiga utilitas untuk riset klip YouTube.
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Transkrip → analisis LLM → pilih candidate → unduh klip. Tanpa akun, tanpa
          API key, tanpa database.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex flex-col justify-between gap-10 bg-card p-8 transition-colors duration-200 hover:bg-muted"
          >
            <div>
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{tool.index}</span>
                <Badge>Baru</Badge>
              </div>
              <p className="micro-label mb-3 text-accent">{tool.label}</p>
              <h2 className="font-serif text-2xl tracking-tight">{tool.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{tool.description}</p>
            </div>
            <span className="micro-label text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
              Buka tool →
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
