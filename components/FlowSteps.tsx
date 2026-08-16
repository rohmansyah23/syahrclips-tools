import Link from "next/link";

const steps = [
  { num: "1", label: "Transkrip", href: "/tools/transcript" },
  { num: "2", label: "Preview", href: "/tools/preview" },
  { num: "3", label: "Klip", href: "/tools/clip" },
];

export function FlowSteps({ current }: { current: number }) {
  return (
    <nav aria-label="Alur langkah" className="mb-10 max-w-2xl">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs tracking-wider text-muted-foreground">
        {steps.map((step, i) => {
          const active = step.num === String(current);
          return (
            <li key={step.num} className="flex flex-wrap items-center gap-x-3">
              {i > 0 && (
                <span aria-hidden="true" className="text-border">
                  →
                </span>
              )}
              {active ? (
                <span aria-current="step" className="flex items-center gap-1.5 text-foreground">
                  <span className="text-accent">{step.num}</span>
                  <span className="underline decoration-border underline-offset-4">
                    {step.label}
                  </span>
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="flex items-center gap-1.5 transition-colors duration-200 hover:text-foreground"
                >
                  <span>{step.num}</span>
                  <span>{step.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
