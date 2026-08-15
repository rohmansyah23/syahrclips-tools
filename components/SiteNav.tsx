import Link from "next/link";

const links = [
  { href: "/tools/transcript", label: "Transkrip" },
  { href: "/tools/preview", label: "Preview" },
  { href: "/tools/clip", label: "Klip" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-editorial flex h-16 items-center justify-between">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          SyahrClips
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="micro-label text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
