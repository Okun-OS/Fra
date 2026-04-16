"use client";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const baseInput = "w-full rounded-lg border border-[#222] bg-[#111] px-3 text-sm text-white/90 placeholder:text-white/25 outline-none transition-all focus:border-white/20 focus:ring-0";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(baseInput, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(baseInput, "py-2.5 resize-none", className)} rows={3} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(baseInput, "h-9 cursor-pointer appearance-none pr-8", className)}
      {...props}
    >
      {children}
    </select>
  );
}
