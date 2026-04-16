"use client";
import { cn } from "@/lib/utils";

interface FrankAvatarProps {
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
}

const sizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export function FrankAvatar({ size = "md", animated = false, className }: FrankAvatarProps) {
  const px = sizes[size];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/8 to-white/3",
        animated && "frank-pulse",
        className
      )}
      style={{ width: px, height: px, minWidth: px }}
    >
      <svg
        width={px * 0.55}
        height={px * 0.55}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Geometric face – minimal, premium */}
        <circle cx="16" cy="11" r="5.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
        <path
          d="M7 27c0-4.97 4.03-9 9-9s9 4.03 9 9"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Status dot */}
        <circle cx="22" cy="8" r="2" fill="#22c55e" />
      </svg>
    </div>
  );
}
