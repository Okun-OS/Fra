import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { isToday, isPast, format } from "date-fns";
import { sortByPriority } from "@/lib/priority";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type Tasks = Awaited<ReturnType<typeof db.task.findMany>>;

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
  const todayTasks = tasks.filter(
    (t) => t.isToday || (t.dueDate && isToday(new Date(t.dueDate)))
  );

  const stats = {
    open: tasks.length,
    critical: critical.length,
    overdue: overdue.length,
    followUps: followUps.length,
    today: todayTasks.length,
  };

  const topTask = sortByPriority(tasks)[0];

  // Use Claude if available, else fall back to rule-based
  if (anthropic && tasks.length > 0) {
    try {
      const { briefing, recommendations } = await generateWithClaude(
        tasks, critical, overdue, followUps, todayTasks
      );
      return Response.json({ briefing, recommendations, topTask, stats });
    } catch {
      // fall through to rule-based
    }
  }

  const briefing = generateBriefingRuleBased({ tasks, critical, overdue, followUps, todayTasks });
  const recommendations = generateRecommendationsRuleBased({ tasks, critical, overdue, followUps });
  return Response.json({ briefing, recommendations, topTask, stats });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message } = body;

  const tasks = await db.task.findMany({
    where: { status: { in: ["open", "in_progress"] } },
    orderBy: { priority: "desc" },
    take: 30,
  });

  if (anthropic) {
    try {
      const reply = await chatWithClaude(message, tasks);
      return Response.json({ reply });
    } catch {
      // fall through to rule-based
    }
  }

  const reply = generateReplyRuleBased(message, tasks);
  return Response.json({ reply });
}

// ─── Claude-powered functions ───────────────────────────────────────────────

async function generateWithClaude(
  tasks: Tasks,
  critical: Tasks,
  overdue: Tasks,
  followUps: Tasks,
  todayTasks: Tasks
): Promise<{ briefing: string; recommendations: string[] }> {
  const taskSummary = tasks
    .slice(0, 15)
    .map(
      (t) =>
        `- [${t.category.toUpperCase()}] ${t.title}` +
        (t.priority >= 70 ? ` (PRIORITÄT: ${t.priority})` : "") +
        (t.dueDate ? ` | Deadline: ${format(new Date(t.dueDate), "dd.MM.")}` : "") +
        (t.isFollowUp ? ` | FOLLOW-UP` : "") +
        (t.revenueImpact === "high" ? ` | 💰 Umsatzrelevant` : "") +
        (t.clientName ? ` | Kunde: ${t.clientName}` : "")
    )
    .join("\n");

  const greetingHour = new Date().getHours();
  const tageszeit = greetingHour < 12 ? "Morgen" : greetingHour < 17 ? "Tag" : "Abend";

  const prompt = `Du bist Frank, ein präziser digitaler Executive Assistant für die Geschäftsführung.
Heute ist ${format(new Date(), "EEEE, dd. MMMM yyyy")}, guten ${tageszeit}.

Aktuelle Lage:
- ${tasks.length} offene Aufgaben
- ${critical.length} kritisch (Priorität ≥ 80)
- ${overdue.length} überfällig
- ${followUps.length} Follow-ups offen
- ${todayTasks.length} für heute geplant

Top-Aufgaben:
${taskSummary}

Erstelle:
1. Ein kurzes, präzises Tages-Briefing (2-3 Sätze, direkt und klar)
2. Genau 3-4 konkrete Handlungsempfehlungen (je 1 Satz)

Antwort als JSON: { "briefing": "...", "recommendations": ["...", "...", "..."] }
Ton: professionell, direkt, keine Floskeln. Deutsch.`;

  const message = await anthropic!.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    briefing: parsed.briefing ?? "",
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}

async function chatWithClaude(message: string, tasks: Tasks): Promise<string> {
  const taskContext = tasks
    .slice(0, 20)
    .map(
      (t) =>
        `[${t.category.toUpperCase()}] ${t.title}` +
        ` | Prio: ${t.priority}` +
        (t.status === "in_progress" ? " | IN BEARBEITUNG" : "") +
        (t.dueDate ? ` | Fällig: ${format(new Date(t.dueDate), "dd.MM.")}` : "") +
        (t.isFollowUp ? ` | Follow-up${t.followUpContact ? ` bei ${t.followUpContact}` : ""}` : "") +
        (t.revenueImpact === "high" ? " | Umsatzrelevant" : "") +
        (t.clientName ? ` | ${t.clientName}` : "")
    )
    .join("\n");

  const systemPrompt = `Du bist Frank, ein intelligenter Executive Assistant für die Geschäftsführung.
Du hast Zugriff auf alle offenen Aufgaben (${tasks.length} gesamt).
Antworte präzise, professionell und auf Deutsch. Keine unnötigen Floskeln.
Bei konkreten Fragen: direkte Antworten mit konkreten Aufgabennamen.

Offene Aufgaben:
${taskContext}`;

  const response = await anthropic!.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

// ─── Rule-based fallback ─────────────────────────────────────────────────────

function generateBriefingRuleBased({ tasks, critical, overdue, followUps, todayTasks }: {
  tasks: Tasks; critical: Tasks; overdue: Tasks; followUps: Tasks; todayTasks: Tasks;
}): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 17 ? "Guten Tag" : "Guten Abend";
  const parts = [`${greeting}. Überblick für ${format(new Date(), "dd. MMMM yyyy")}.`];
  if (critical.length > 0) parts.push(`${critical.length} kritische Aufgaben erfordern sofortige Aufmerksamkeit.`);
  if (overdue.length > 0) parts.push(`${overdue.length} Aufgaben sind überfällig.`);
  if (followUps.length > 0) parts.push(`${followUps.length} Follow-ups offen.`);
  if (todayTasks.length > 0) parts.push(`${todayTasks.length} Aufgaben für heute.`);
  return parts.join(" ");
}

function generateRecommendationsRuleBased({ tasks, critical, overdue, followUps }: {
  tasks: Tasks; critical: Tasks; overdue: Tasks; followUps: Tasks;
}): string[] {
  const recs: string[] = [];
  const sorted = sortByPriority(tasks);
  if (overdue[0]) recs.push(`Sofort: "${overdue[0].title}" ist überfällig.`);
  const topFup = followUps.sort((a, b) =>
    (a.followUpDate ? new Date(a.followUpDate).getTime() : Infinity) -
    (b.followUpDate ? new Date(b.followUpDate).getTime() : Infinity)
  )[0];
  if (topFup) recs.push(`Follow-up: "${topFup.title}" – ${topFup.followUpContact ?? "Kunden"} kontaktieren.`);
  if (sorted[0] && !overdue.includes(sorted[0])) recs.push(`Fokus: "${sorted[0].title}"`);
  const qw = sorted.find((t) => t.effort === "quick" && t.revenueImpact !== "none");
  if (qw && !recs.some((r) => r.includes(qw.title))) recs.push(`Quick Win: "${qw.title}"`);
  return recs.slice(0, 4);
}

function generateReplyRuleBased(message: string, tasks: Tasks): string {
  const lower = message.toLowerCase();
  if (lower.includes("was soll") || lower.includes("was jetzt") || lower.includes("nächste")) {
    const top = sortByPriority(tasks)[0];
    return top ? `Empfehlung: "${top.title}" (Priorität ${top.priority}/100).` : "Keine offenen Aufgaben.";
  }
  if (lower.includes("überfällig")) {
    const od = tasks.filter((t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)));
    return od.length === 0 ? "Keine überfälligen Aufgaben." : od.map((t) => `• ${t.title}`).join("\n");
  }
  if (lower.includes("follow-up")) {
    const fups = tasks.filter((t) => t.isFollowUp);
    return fups.length === 0 ? "Keine offenen Follow-ups." : fups.map((t) => `• ${t.title}`).join("\n");
  }
  const top = sortByPriority(tasks)[0];
  return `${tasks.length} offene Aufgaben. Wichtigste: "${top?.title ?? "–"}"`;
}
