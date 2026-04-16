import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { getOAuthClient } from "@/lib/google";
import { format } from "date-fns";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function decodeBody(part: { body?: { data?: string | null } | null; parts?: unknown[] | null; mimeType?: string | null }): string {
  if (part.mimeType === "text/html") return ""; // prefer plain text
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64").toString("utf-8");
  }
  if (Array.isArray(part.parts)) {
    for (const p of part.parts as typeof part[]) {
      const text = decodeBody(p);
      if (text) return text;
    }
  }
  return "";
}

function extractEmail(raw: string): string {
  return raw.match(/<(.+?)>/)?.[1] ?? raw.trim();
}

async function fetchFullThread(threadId: string): Promise<string> {
  try {
    const integration = await db.integration.findFirst({
      where: { type: { startsWith: "email_" }, isActive: true },
    });
    if (!integration) return "";

    const config = JSON.parse(integration.config) as { email: string; tokens: object };
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(config.tokens);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const threadDetail = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = threadDetail.data.messages ?? [];
    const myEmail = config.email.toLowerCase();

    const parts = messages.map((msg, idx) => {
      const getHeader = (name: string) =>
        msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const from = getHeader("From");
      const to = getHeader("To");
      const date = getHeader("Date");
      const subject = getHeader("Subject");
      const fromEmail = extractEmail(from).toLowerCase();
      const isMe = fromEmail === myEmail || fromEmail.includes(myEmail.split("@")[0]);

      const body = msg.payload ? decodeBody(msg.payload as Parameters<typeof decodeBody>[0]) : (msg.snippet ?? "");
      const bodyPreview = body.slice(0, 600).replace(/\s+/g, " ").trim();

      return `--- Nachricht ${idx + 1} von ${messages.length} ---
Von: ${from}${isMe ? " [ICH]" : ""}
An: ${to}
Datum: ${date}
Betreff: ${subject}
Inhalt: ${bodyPreview || msg.snippet || "(leer)"}`;
    });

    return parts.join("\n\n");
  } catch {
    return "";
  }
}

// POST /api/tasks/[id]/frank
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

  // Fetch full Gmail thread history for email tasks
  let fullThreadHistory = "";
  if (isEmailTask && task.sourceId) {
    fullThreadHistory = await fetchFullThread(task.sourceId);
  }

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
E-Mail Thread Metadaten:
  Betreff: ${task.emailThread!.subject}
  Von: ${task.emailThread!.fromName ?? ""} <${task.emailThread!.fromEmail}>
  Nachrichten gesamt: ${task.emailThread!.messageCount}
  Ausstehende Antwort: ${task.emailThread!.hasPendingReply ? "Ja" : "Nein"}
` : ""}`.trim();

  const threadSection = fullThreadHistory
    ? `\n\nVOLLSTÄNDIGER E-MAIL-VERLAUF (alle Nachrichten):\n${fullThreadHistory}`
    : "";

  const systemPrompt = `Du bist Frank, ein präziser Executive Assistant.
Du hilfst dabei, diese konkrete Aufgabe zu lösen.

${taskContext}${threadSection}

Deine Rolle:
1. Erkläre kurz was zu tun ist (2-3 Sätze)
2. Wenn es eine E-Mail-Aufgabe ist: Schlage eine fertige Antwort vor
3. Beantworte Fragen über den E-Mail-Verlauf direkt — du hast Zugriff auf alle Nachrichten
4. Passe dich an Feedback an — der Nutzer kann sagen "kürzer", "formeller", "erwähne X"
5. Wenn eine E-Mail-Antwort bereit ist: Gib sie im Format JSON zurück:
   { "type": "email_draft", "to": "...", "subject": "...", "body": "..." }
6. Für andere Aufgaben: Schlage konkrete nächste Schritte vor

Ton: Professionell, direkt, auf Deutsch.
Keine Floskeln. Wenn du einen E-Mail-Entwurf lieferst, liefere ihn sofort — nicht erst fragen ob du soll.`;

  if (!anthropic) {
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

  const messages: Anthropic.MessageParam[] = history.length > 0
    ? history
    : [{ role: "user", content: message ?? "Analysiere diese Aufgabe und hilf mir sie zu lösen." }];

  if (message && history.length > 0) {
    messages.push({ role: "user", content: message });
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: systemPrompt,
    messages,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let emailDraft = null;
  const jsonMatch = text.match(/\{[\s\S]*?"type"\s*:\s*"email_draft"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      emailDraft = JSON.parse(jsonMatch[0]);
    } catch { /* ignore */ }
  }

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
