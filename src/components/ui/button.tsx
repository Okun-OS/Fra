"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary: "bg-white text-black hover:bg-white/90 font-medium",
  secondary: "bg-white/8 text-white/80 hover:bg-white/12 border border-white/10",
  ghost: "text-white/60 hover:text-white hover:bg-white/6",
  danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-7 px-3 text-xs rounded-md gap-1.5",
  md: "h-9 px-4 text-sm rounded-lg gap-2",
  lg: "h-11 px-6 text-sm rounded-xl gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "secondary", size = "md", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
