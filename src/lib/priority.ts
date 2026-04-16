import type { Task } from "@/generated/prisma/client";
import { isPast, isToday, differenceInDays } from "date-fns";

/**
 * Rule-based priority engine for Frank.
 *
 * Returns a score 0-100. Higher = more urgent.
 * Combines category weight, deadline urgency, revenue impact, and effort.
 */

const CATEGORY_WEIGHTS: Record<string, number> = {
  delivery: 40,
  sales: 35,
  system: 25,
  admin: 15,
  vision: 5,
};

const REVENUE_BONUS: Record<string, number> = {
  high: 25,
  medium: 15,
  low: 5,
  none: 0,
};

export function computePriority(task: Partial<Task>): number {
  let score = CATEGORY_WEIGHTS[task.category ?? "admin"] ?? 15;

  // Revenue impact
  score += REVENUE_BONUS[task.revenueImpact ?? "none"] ?? 0;

  // Deadline urgency
  if (task.dueDate) {
    const due = new Date(task.dueDate as Date);
    if (isPast(due) && !isToday(due)) {
      score += 30; // overdue penalty → becomes priority
    } else if (isToday(due)) {
      score += 20;
    } else {
      const days = differenceInDays(due, new Date());
      if (days <= 1) score += 18;
      else if (days <= 3) score += 12;
      else if (days <= 7) score += 6;
    }
  }

  // Follow-up due
  if (task.isFollowUp) {
    score += 8;
    if (task.followUpDate) {
      const fup = new Date(task.followUpDate as Date);
      if (isPast(fup) || isToday(fup)) score += 10;
    }
  }

  // Source weight
  if (task.source === "email") score += 5;
  if (task.source === "okunos") score += 5;
  if (task.source === "portal") score += 5;

  // Effort inverse: quick wins get a bump
  if (task.effort === "quick") score += 5;

  return Math.min(100, Math.max(0, score));
}

export function sortByPriority<T extends { priority: number; dueDate?: Date | null; createdAt?: Date | null }>(
  tasks: T[]
): T[] {
  return [...tasks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // Secondary sort: due date ascending
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}

export function categorizeDaySlot(
  tasks: Task[]
): { now: Task[]; later: Task[]; skip: Task[] } {
  const sorted = sortByPriority(tasks.filter((t) => t.status === "open" || t.status === "in_progress"));
  const now = sorted.slice(0, 5);
  const later = sorted.slice(5, 12);
  const skip = sorted.slice(12);
  return { now, later, skip };
}
