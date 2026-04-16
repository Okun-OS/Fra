"use client";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className, onClick, hover = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-5",
        hover && "cursor-pointer transition-all duration-200 hover:border-white/10 hover:bg-[#131313]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex items-center justify-between", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-xs font-medium uppercase tracking-widest text-white/40", className)}>
      {children}
    </h3>
  );
}
