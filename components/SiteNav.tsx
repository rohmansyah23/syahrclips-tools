"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const links = [
  { href: "/tools/transcript", label: "Transkrip" },
  { href: "/tools/preview", label: "Preview" },
  { href: "/tools/clip", label: "Klip" },
];

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-5 w-5"
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

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-editorial flex h-16 items-center justify-between">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          SyahrClips
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex h-10 w-10 items-center justify-center rounded-sm text-foreground transition-colors duration-200 hover:bg-muted sm:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>

        <nav className="hidden items-center gap-4 sm:flex sm:gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "micro-label transition-colors duration-200",
                isActive(link.href)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Menu utama"
          className="border-t border-border bg-background/95 backdrop-blur-md sm:hidden"
        >
          <ul className="container-editorial py-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 py-3 font-mono text-sm tracking-wider transition-colors duration-200",
                    isActive(link.href)
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn(isActive(link.href) ? "text-accent" : "text-border")}>
                    {isActive(link.href) ? "✓" : "•"}
                  </span>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
