import { db } from "@/lib/db";
import { isToday, isPast } from "date-fns";

export async function GET() {
  const [allTasks, integrations] = await Promise.all([
    db.task.findMany({ where: { status: { in: ["open", "in_progress"] } } }),
    db.integration.findMany(),
  ]);

  const critical = allTasks.filter((t) => t.priority >= 80);
  const overdue = allTasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
  );
  const followUps = allTasks.filter((t) => t.isFollowUp);
  const todayTasks = allTasks.filter((t) => t.isToday || (t.dueDate && isToday(new Date(t.dueDate))));

  const byCategory: Record<string, number> = {};
  for (const t of allTasks) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
  }

  return Response.json({
    stats: {
      open: allTasks.length,
      critical: critical.length,
      overdue: overdue.length,
      followUps: followUps.length,
      today: todayTasks.length,
    },
    byCategory,
    criticalTasks: critical.slice(0, 5),
    overdueTasks: overdue.slice(0, 5),
    followUpTasks: followUps.slice(0, 5),
    todayTasks: todayTasks.slice(0, 8),
    integrations,
  });
}
