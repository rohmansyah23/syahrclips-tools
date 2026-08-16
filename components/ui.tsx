import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "sm" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-foreground text-background hover:opacity-85",
  secondary: "border border-border bg-transparent hover:border-foreground",
  ghost: "hover:bg-muted",
};

const buttonSizes: Record<ButtonSize, string> = {
  default: "h-10 px-5 text-sm",
  sm: "h-8 px-3.5 text-xs",
  icon: "h-10 w-10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "default", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-sm border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:border-foreground",
        className,
      )}
      {...props}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-sm border border-border bg-card px-3.5 py-2 font-mono text-xs leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:border-foreground",
        className,
      )}
      {...props}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-sm border border-border bg-card px-3.5 py-2 text-sm text-foreground focus:outline-none focus-visible:border-foreground",
        className,
      )}
      {...props}
    />
  );
}

type BadgeVariant = "default" | "accent" | "solid";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "border-border text-muted-foreground",
  accent: "border-accent/40 bg-accent/10 text-accent",
  solid: "border-transparent bg-foreground text-background",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card",
        interactive && "transition-colors duration-200 hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

interface SectionHeaderProps {
  index: string;
  label: string;
  title: string;
  description?: string;
  breadcrumb?: string;
  children?: ReactNode;
}

export function SectionHeader({
  index,
  label,
  title,
  description,
  breadcrumb,
  children,
}: SectionHeaderProps) {
  return (
    <section className="mb-10 max-w-2xl">
      {breadcrumb && (
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-2 font-mono text-xs tracking-wider text-muted-foreground"
        >
          <Link href="/" className="transition-colors duration-200 hover:text-foreground">
            Home
          </Link>
          <span aria-hidden="true" className="text-border">
            /
          </span>
          <span className="text-foreground">{breadcrumb}</span>
        </nav>
      )}
      <p className="micro-label mb-4 text-accent">
        {index} / {label}
      </p>
      <h1 className="font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
      {description && (
        <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
      )}
      {children}
    </section>
  );
}
