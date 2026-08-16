"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const links = [
  { href: "/tools/transcript", label: "Transkrip" },
  { href: "/tools/preview", label: "Preview" },
  { href: "/tools/clip", label: "Klip" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-editorial flex h-16 items-center justify-between">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          SyahrClips
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "micro-label transition-colors duration-200",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
