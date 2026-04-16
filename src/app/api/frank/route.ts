import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isToday, isPast, format } from "date-fns";
import { sortByPriority } from "@/lib/priority";

export async function GET() {
  const tasks = await db.task.findMany({
    where: { status: { in: ["open", "in_progress"] } },
    orderBy: { priority: "desc" },
  });

  const critical = tasks.filter((t) => t.priority >= 80);
  const overdue = tasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
  );
  const followUps = tasks.filter((t) => t.isFollowUp);
  const todayTasks = tasks.filter((t) => t.isToday || (t.dueDate && isToday(new Date(t.dueDate))));

  const briefing = generateBriefing({ tasks, critical, overdue, followUps, todayTasks });
  const recommendations = generateRecommendations({ tasks, critical, overdue, followUps });
  const topTask = sortByPriority(tasks)[0];

  return Response.json({ briefing, recommendations, topTask, stats: {
    open: tasks.length,
    critical: critical.length,
    overdue: overdue.length,
    followUps: followUps.length,
    today: todayTasks.length,
  }});
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message } = body;

  const tasks = await db.task.findMany({
    where: { status: { in: ["open", "in_progress"] } },
    orderBy: { priority: "desc" },
    take: 20,
  });

  const context = buildContext(tasks);
  const reply = generateReply(message, tasks, context);

  return Response.json({ reply });
}

function generateBriefing({ tasks, critical, overdue, followUps, todayTasks }: {
  tasks: Awaited<ReturnType<typeof db.task.findMany>>;
  critical: typeof tasks;
  overdue: typeof tasks;
  followUps: typeof tasks;
  todayTasks: typeof tasks;
}): string {
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Guten Morgen" : greetingHour < 17 ? "Guten Tag" : "Guten Abend";

  const parts: string[] = [`${greeting}. Hier ist dein Überblick für ${format(new Date(), "dd. MMMM yyyy")}.`];

  if (critical.length > 0) {
    parts.push(`⚠️ ${critical.length} kritische Aufgabe${critical.length > 1 ? "n" : ""} erfordern sofortige Aufmerksamkeit.`);
  }
  if (overdue.length > 0) {
    parts.push(`🔴 ${overdue.length} Aufgabe${overdue.length > 1 ? "n sind" : " ist"} überfällig.`);
  }
  if (followUps.length > 0) {
    parts.push(`📬 ${followUps.length} offene Follow-up${followUps.length > 1 ? "s" : ""} warten auf deine Rückmeldung.`);
  }
  if (todayTasks.length > 0) {
    parts.push(`📋 Heute stehen ${todayTasks.length} Aufgaben an.`);
  }

  const highRevenue = tasks.filter((t) => t.revenueImpact === "high");
  if (highRevenue.length > 0) {
    parts.push(`💰 ${highRevenue.length} umsatzrelevante Aufgabe${highRevenue.length > 1 ? "n" : ""} sind offen.`);
  }

  return parts.join(" ");
}

function generateRecommendations({ tasks, critical, overdue, followUps }: {
  tasks: Awaited<ReturnType<typeof db.task.findMany>>;
  critical: typeof tasks;
  overdue: typeof tasks;
  followUps: typeof tasks;
}): string[] {
  const recs: string[] = [];
  const sorted = sortByPriority(tasks);

  if (overdue.length > 0) {
    recs.push(`Sofort: "${overdue[0].title}" ist überfällig und sollte heute erledigt werden.`);
  }

  const topFollowUp = followUps.sort((a, b) => {
    if (!a.followUpDate) return 1;
    if (!b.followUpDate) return -1;
    return new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime();
  })[0];

  if (topFollowUp) {
    recs.push(`Follow-up: "${topFollowUp.title}" – kontaktiere ${topFollowUp.followUpContact ?? "den Kunden"} noch heute.`);
  }

  if (sorted[0] && !overdue.includes(sorted[0])) {
    recs.push(`Fokus: "${sorted[0].title}" hat die höchste Priorität heute.`);
  }

  const quickWins = sorted.filter((t) => t.effort === "quick" && t.revenueImpact !== "none").slice(0, 2);
  for (const qw of quickWins) {
    if (!recs.some((r) => r.includes(qw.title))) {
      recs.push(`Quick Win: "${qw.title}" – schnell erledigt, hoher Impact.`);
    }
  }

  return recs.slice(0, 4);
}

function buildContext(tasks: Awaited<ReturnType<typeof db.task.findMany>>): string {
  return tasks
    .slice(0, 10)
    .map((t) => `- ${t.title} (Priorität: ${t.priority}, Kategorie: ${t.category})`)
    .join("\n");
}

function generateReply(
  message: string,
  tasks: Awaited<ReturnType<typeof db.task.findMany>>,
  _context: string
): string {
  const lower = message.toLowerCase();

  if (lower.includes("was soll ich") || lower.includes("was jetzt") || lower.includes("nächste")) {
    const top = sortByPriority(tasks)[0];
    if (!top) return "Keine offenen Aufgaben gefunden. Gut gemacht!";
    return `Ich empfehle: "${top.title}". Diese Aufgabe hat Priorität ${top.priority}/100 und gehört zur Kategorie "${top.category}". ${top.dueDate ? `Deadline: ${format(new Date(top.dueDate), "dd.MM.yyyy")}.` : ""}`;
  }

  if (lower.includes("überfällig") || lower.includes("overdue")) {
    const overdue = tasks.filter(
      (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
    );
    if (overdue.length === 0) return "Keine überfälligen Aufgaben – alles im grünen Bereich.";
    return `${overdue.length} überfällige Aufgaben:\n${overdue.map((t) => `• ${t.title}`).join("\n")}`;
  }

  if (lower.includes("follow-up") || lower.includes("nachfassen")) {
    const fups = tasks.filter((t) => t.isFollowUp);
    if (fups.length === 0) return "Keine offenen Follow-ups.";
    return `${fups.length} Follow-ups offen:\n${fups.map((t) => `• ${t.title}${t.followUpContact ? ` (${t.followUpContact})` : ""}`).join("\n")}`;
  }

  if (lower.includes("zusammenfassung") || lower.includes("überblick") || lower.includes("status")) {
    const byCategory: Record<string, number> = {};
    for (const t of tasks) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    }
    const lines = Object.entries(byCategory).map(([cat, n]) => `• ${cat}: ${n} Aufgaben`);
    return `Aktueller Status (${tasks.length} offene Aufgaben):\n${lines.join("\n")}`;
  }

  return `Ich habe deine Anfrage verstanden: "${message}". Aktuell sind ${tasks.length} Aufgaben offen. Die wichtigste ist: "${sortByPriority(tasks)[0]?.title ?? "–"}".`;
}
