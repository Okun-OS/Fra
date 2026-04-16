"use client";
import { cn } from "@/lib/utils";

type Variant = "default" | "critical" | "warning" | "success" | "info" | "sales" | "delivery" | "muted";

const variants: Record<Variant, string> = {
  default: "bg-white/10 text-white/80",
  critical: "bg-red-500/15 text-red-400 border border-red-500/20",
  warning: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  success: "bg-green-500/15 text-green-400 border border-green-500/20",
  info: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  sales: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
  delivery: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20",
  muted: "bg-white/5 text-white/40",
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
