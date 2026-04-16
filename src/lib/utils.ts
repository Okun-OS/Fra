import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isTomorrow, isPast, differenceInDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isToday(d)) return "Heute";
  if (isTomorrow(d)) return "Morgen";
  return format(d, "dd.MM.yyyy");
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const days = differenceInDays(d, new Date());
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  if (days === -1) return "Gestern";
  if (days < 0) return `Vor ${Math.abs(days)} Tagen`;
  return `In ${days} Tagen`;
}

export function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return isPast(d) && !isToday(d);
}

export function priorityLabel(score: number): string {
  if (score >= 85) return "Kritisch";
  if (score >= 70) return "Hoch";
  if (score >= 50) return "Mittel";
  if (score >= 30) return "Niedrig";
  return "Minimal";
}

export function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    delivery: "Delivery",
    sales: "Sales",
    system: "System",
    admin: "Admin",
    vision: "Vision",
  };
  return map[cat] ?? cat;
}

export function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    manual: "Manuell",
    email: "E-Mail",
    okunos: "OkunOS",
    portal: "Portal",
  };
  return map[source] ?? source;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "Offen",
    in_progress: "In Bearbeitung",
    done: "Erledigt",
    snoozed: "Verschoben",
    cancelled: "Abgebrochen",
  };
  return map[status] ?? status;
}

export function parseTags(tagsJson: string): string[] {
  try {
    return JSON.parse(tagsJson);
  } catch {
    return [];
  }
}

export function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}
