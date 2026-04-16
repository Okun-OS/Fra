import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { format } from "date-fns";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// POST /api/tasks/[id]/frank
// Frank analysiert die Aufgabe, zeigt E-Mail und schlägt Antwort vor
// body: { message?: string; history?: {role, content}[] }
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]/frank">
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const { message, history = [] } = body;

  const task = await db.task.findUnique({
    where: { id },
    include: { emailThread: true },
  });

  if (!task) return Response.json({ error: "Not found" }, { status: 404 });

  const isEmailTask = task.source === "email" && task.emailThread;

  // Build task context
  const taskContext = `
Aufgabe: ${task.title}
Kategorie: ${task.category}
Priorität: ${task.priority}/100
Status: ${task.status}
${task.description ? `Details: ${task.description}` : ""}
${task.dueDate ? `Deadline: ${format(new Date(task.dueDate), "dd.MM.yyyy")}` : ""}
${task.clientName ? `Kunde: ${task.clientName}` : ""}
${task.isFollowUp ? `Follow-up bei: ${task.followUpContact ?? "unbekannt"}` : ""}
${isEmailTask ? `
E-Mail Thread:
  Betreff: ${task.emailThread!.subject}
  Von: ${task.emailThread!.fromName ?? ""} <${task.emailThread!.fromEmail}>
  Vorschau: ${task.emailThread!.snippet ?? ""}
  Nachrichten: ${task.emailThread!.messageCount}
  Ausstehende Antwort: ${task.emailThread!.hasPendingReply ? "Ja" : "Nein"}
` : ""}`.trim();

  const systemPrompt = `Du bist Frank, ein präziser Executive Assistant.
Du hilfst dabei, diese konkrete Aufgabe zu lösen.

${taskContext}

Deine Rolle:
1. Erkläre kurz was zu tun ist (2-3 Sätze)
2. Wenn es eine E-Mail-Aufgabe ist: Schlage eine fertige Antwort vor
3. Passe dich an Feedback an — der Nutzer kann sagen "kürzer", "formeller", "erwähne X"
4. Wenn eine E-Mail-Antwort bereit ist: Gib sie im Format JSON zurück:
   { "type": "email_draft", "to": "...", "subject": "...", "body": "..." }
5. Für andere Aufgaben: Schlage konkrete nächste Schritte vor

Ton: Professionell, direkt, auf Deutsch.
Keine Floskeln. Wenn du einen E-Mail-Entwurf lieferst, liefere ihn sofort — nicht erst fragen ob du soll.`;

  if (!anthropic) {
    // Fallback ohne Claude
    const fallback = isEmailTask
      ? `Diese Aufgabe basiert auf einer E-Mail von **${task.emailThread!.fromEmail}** zum Thema "${task.emailThread!.subject}".\n\nEmpfohlene Antwort:\n\nSehr geehrte/r ${task.emailThread!.fromName ?? "Damen und Herren"},\n\nvielen Dank für Ihre Nachricht. Ich melde mich kurzfristig mit einer ausführlichen Rückmeldung.\n\nMit freundlichen Grüßen`
      : `Aufgabe: **${task.title}**\n\nNächste Schritte:\n1. Aufgabe prüfen\n2. Relevante Personen informieren\n3. Erledigen und abhaken`;

    return Response.json({
      reply: fallback,
      emailDraft: isEmailTask ? {
        to: task.emailThread!.fromEmail,
        subject: `Re: ${task.emailThread!.subject}`,
        body: "Sehr geehrte/r,\n\nvielen Dank für Ihre Nachricht.\n\nMit freundlichen Grüßen",
      } : null,
    });
  }

  // First message: Frank gives initial analysis + draft
  const messages: Anthropic.MessageParam[] = history.length > 0
    ? history
    : [{ role: "user", content: message ?? "Analysiere diese Aufgabe und hilf mir sie zu lösen." }];

  if (message && history.length > 0) {
    messages.push({ role: "user", content: message });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Extract email draft if present
  let emailDraft = null;
  const jsonMatch = text.match(/\{[\s\S]*?"type"\s*:\s*"email_draft"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      emailDraft = JSON.parse(jsonMatch[0]);
    } catch { /* ignore */ }
  }

  // Clean reply text (remove raw JSON block)
  const cleanReply = text.replace(/\{[\s\S]*?"type"\s*:\s*"email_draft"[\s\S]*?\}/, "").trim();

  return Response.json({
    reply: cleanReply || text,
    emailDraft,
    taskContext: {
      title: task.title,
      isEmailTask,
      emailThread: task.emailThread,
    },
  });
}
