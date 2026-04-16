import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { getOAuthClient } from "@/lib/google";
import { format } from "date-fns";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type GmailPart = {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
};

function decodeBody(part: GmailPart): string {
  if (part.mimeType === "text/html") return "";
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64").toString("utf-8");
  }
  if (Array.isArray(part.parts)) {
    for (const p of part.parts) {
      const text = decodeBody(p);
      if (text) return text;
    }
  }
  return "";
}

function extractEmail(raw: string): string {
  return raw.match(/<(.+?)>/)?.[1] ?? raw.trim();
}

function getGmailClient(config: { email: string; tokens: object }) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(config.tokens);
  return google.gmail({ version: "v1", auth: oauth2Client });
}

// Fetch all messages in the current task thread
async function fetchCurrentThread(
  gmail: ReturnType<typeof google.gmail>,
  threadId: string,
  myEmail: string
): Promise<string> {
  const threadDetail = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  const messages = threadDetail.data.messages ?? [];
  if (messages.length === 0) return "";

  const parts = messages.map((msg, idx) => {
    const getHeader = (name: string) =>
      msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const from = getHeader("From");
    const to = getHeader("To");
    const date = getHeader("Date");
    const fromEmail = extractEmail(from).toLowerCase();
    const isMe = fromEmail === myEmail || fromEmail.includes(myEmail.split("@")[0]);

    const body = msg.payload ? decodeBody(msg.payload as GmailPart) : "";
    const bodyText = (body || msg.snippet || "").slice(0, 800).replace(/\s+/g, " ").trim();

    return `--- Nachricht ${idx + 1} von ${messages.length} ---
Von: ${from}${isMe ? " [ICH]" : ""}
An: ${to}
Datum: ${date}
${bodyText}`;
  });

  return parts.join("\n\n");
}

// Search all past threads with this contact (for full history awareness)
async function fetchContactHistory(
  gmail: ReturnType<typeof google.gmail>,
  contactEmail: string,
  currentThreadId: string,
  myEmail: string
): Promise<string> {
  const threadsRes = await gmail.users.threads.list({
    userId: "me",
    q: `(from:${contactEmail} OR to:${contactEmail}) -in:spam`,
    maxResults: 20,
  });

  const threads = (threadsRes.data.threads ?? []).filter((t) => t.id !== currentThreadId);
  if (threads.length === 0) return "Keine früheren Threads mit diesem Kontakt gefunden.";

  const summaries: string[] = [];
  for (const thread of threads.slice(0, 10)) {
    if (!thread.id) continue;
    try {
      const detail = await gmail.users.threads.get({
        userId: "me",
        id: thread.id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });
      const msgs = detail.data.messages ?? [];
      if (msgs.length === 0) continue;

      const firstMsg = msgs[0];
      const lastMsg = msgs[msgs.length - 1];
      const getHeader = (msg: typeof firstMsg, name: string) =>
        msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const subject = getHeader(firstMsg, "Subject") || "(kein Betreff)";
      const date = getHeader(lastMsg, "Date");
      const lastFrom = getHeader(lastMsg, "From");
      const lastFromEmail = extractEmail(lastFrom).toLowerCase();
      const lastIsMe = lastFromEmail === myEmail || lastFromEmail.includes(myEmail.split("@")[0]);
      const snippet = lastMsg.snippet ?? "";

      summaries.push(
        `• ${date ? new Date(date).toLocaleDateString("de-DE") : "?"} | „${subject}" | ${msgs.length} Nachrichten | Letzte von: ${lastIsMe ? "MIR" : lastFrom} | Vorschau: ${snippet.slice(0, 100)}`
      );
    } catch {
      // skip failed thread
    }
  }

  return summaries.length > 0
    ? summaries.join("\n")
    : "Keine weiteren Threads mit diesem Kontakt.";
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

  let fullThreadContent = "";
  let contactHistoryContent = "";

  if (isEmailTask && task.sourceId) {
    const integration = await db.integration.findFirst({
      where: { type: { startsWith: "email_" }, isActive: true },
    });

    if (integration) {
      const config = JSON.parse(integration.config) as { email: string; tokens: object };
      const myEmail = config.email.toLowerCase();
      const gmail = getGmailClient(config);

      // Fetch both in parallel
      const [threadContent, contactHistory] = await Promise.all([
        fetchCurrentThread(gmail, task.sourceId, myEmail),
        fetchContactHistory(gmail, task.emailThread!.fromEmail, task.sourceId, myEmail),
      ]);
      fullThreadContent = threadContent;
      contactHistoryContent = contactHistory;
    }
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
E-Mail Kontakt: ${task.emailThread!.fromName ?? ""} <${task.emailThread!.fromEmail}>
Betreff: ${task.emailThread!.subject}
Anzahl Nachrichten in diesem Thread: ${task.emailThread!.messageCount}
Ausstehende Antwort von mir: ${task.emailThread!.hasPendingReply ? "JA" : "NEIN"}
` : ""}`.trim();

  const systemPrompt = `Du bist Frank, ein präziser Executive Assistant.
Du hast vollständigen Zugriff auf den E-Mail-Verlauf und die gesamte Korrespondenz mit diesem Kontakt.

AUFGABE:
${taskContext}

${fullThreadContent ? `AKTUELLER THREAD (vollständig, alle Nachrichten):
${fullThreadContent}` : ""}

${contactHistoryContent ? `FRÜHERE KORRESPONDENZ MIT DIESEM KONTAKT:
${contactHistoryContent}` : ""}

Deine Rolle:
1. Analysiere die Situation und erkläre kurz was zu tun ist
2. Beantworte alle Fragen über den Verlauf — du hast Zugriff auf alle Nachrichten
3. Wenn eine E-Mail-Antwort nötig ist: Erstelle sofort einen fertigen Entwurf
4. Passe dich an Feedback an: "kürzer", "formeller", "auf Englisch", etc.
5. E-Mail-Entwurf immer im JSON-Format zurückgeben:
   { "type": "email_draft", "to": "...", "subject": "...", "body": "..." }
   WICHTIG: Der Entwurf enthält KEINEN Signatur-Platzhalter — die Signatur wird automatisch angehängt.
6. Für Nicht-E-Mail-Aufgaben: Konkrete nächste Schritte vorschlagen

Ton: Professionell, direkt, auf Deutsch. Keine Floskeln.`;

  if (!anthropic) {
    const fallback = isEmailTask
      ? `Diese Aufgabe basiert auf einer E-Mail von **${task.emailThread!.fromEmail}** zum Thema "${task.emailThread!.subject}".\n\nEmpfohlene Antwort:\n\nSehr geehrte/r ${task.emailThread!.fromName ?? "Damen und Herren"},\n\nvielen Dank für Ihre Nachricht. Ich melde mich kurzfristig.\n\nMit freundlichen Grüßen`
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
    max_tokens: 1200,
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
