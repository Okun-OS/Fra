import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { db } from "@/lib/db";
import { computePriority } from "@/lib/priority";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function extractEmail(raw: string): string {
  return raw.match(/<(.+?)>/)?.[1] ?? raw.trim();
}

function extractName(raw: string): string {
  return raw.replace(/<.+?>/, "").trim().replace(/^"|"$/g, "");
}

function decodeBody(part: { body?: { data?: string | null } | null; parts?: unknown[] | null }): string {
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

// POST /api/integrations/gmail/sync  body: { slot: "email_1" }
export async function POST(request: NextRequest) {
  const { slot = "email_1" } = await request.json();

  const integration = await db.integration.findUnique({ where: { type: slot } });
  if (!integration?.isActive) {
    return Response.json({ error: "Integration not connected" }, { status: 400 });
  }

  const config = JSON.parse(integration.config) as { email: string; tokens: object };
  const myEmail = config.email.toLowerCase();

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(config.tokens);
  oauth2Client.on("tokens", async (newTokens) => {
    await db.integration.update({
      where: { type: slot },
      data: { config: JSON.stringify({ ...config, tokens: { ...config.tokens, ...newTokens } }) },
    });
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Fetch threads from last 14 days — inbox only, not sent/spam
  // We'll analyze each thread ourselves to determine action needed
  const threadsRes = await gmail.users.threads.list({
    userId: "me",
    q: "in:inbox newer_than:14d",
    maxResults: 30,
  });

  const threads = threadsRes.data.threads ?? [];
  let newTaskCount = 0;

  for (const thread of threads) {
    if (!thread.id) continue;

    // Skip already processed threads
    const existing = await db.emailThread.findUnique({ where: { threadId: thread.id } });
    if (existing) continue;

    // Fetch full thread with message content
    const threadDetail = await gmail.users.threads.get({
      userId: "me",
      id: thread.id,
      format: "full",
    });

    const messages = threadDetail.data.messages ?? [];
    if (messages.length === 0) continue;

    // ── Key insight: look at the LAST message in the thread ──
    const lastMsg = messages[messages.length - 1];
    const firstMsg = messages[0];

    const getHeader = (msg: typeof lastMsg, name: string) =>
      msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const lastFrom = getHeader(lastMsg, "From");
    const lastFromEmail = extractEmail(lastFrom).toLowerCase();
    const subject = getHeader(firstMsg, "Subject") || "(Kein Betreff)";
    const firstFrom = getHeader(firstMsg, "From");
    const firstFromEmail = extractEmail(firstFrom).toLowerCase();
    const firstFromName = extractName(firstFrom);
    const toField = getHeader(firstMsg, "To");
    const lastDateStr = getHeader(lastMsg, "Date");

    // ── Determine what kind of action is needed ──
    const iLastSender = lastFromEmail === myEmail || lastFromEmail.includes(myEmail.split("@")[0]);

    // Case 1: Last message is FROM me → I'm waiting for their reply (follow-up)
    // Case 2: Last message is FROM them → They wrote to me, I need to respond
    // Case 3: Last message is from neither → probably a mailing list, skip

    const lastMsgIsFromMe = iLastSender;
    const lastMsgIsFromOther = !iLastSender && !lastFromEmail.includes("noreply") &&
                                !lastFromEmail.includes("no-reply") &&
                                !lastFromEmail.includes("mailer-daemon") &&
                                !lastFromEmail.includes("newsletter") &&
                                !lastFromEmail.includes("notifications@") &&
                                !lastFromEmail.includes("info@") && // adjust as needed
                                lastFromEmail !== "";

    // Skip automated/newsletter emails
    const labelIds = lastMsg.labelIds ?? [];
    const isPromotion = labelIds.includes("CATEGORY_PROMOTIONS");
    const isSocial = labelIds.includes("CATEGORY_SOCIAL");
    const isSpam = labelIds.includes("SPAM");
    if (isPromotion || isSocial || isSpam) continue;

    // Get readable body of last message for better AI analysis
    const bodyText = lastMsg.payload ? decodeBody(lastMsg.payload as Parameters<typeof decodeBody>[0]) : "";
    const snippet = lastMsg.snippet ?? "";
    const bodyPreview = (bodyText || snippet).slice(0, 400).replace(/\s+/g, " ").trim();

    let needsAction = false;
    let isFollowUp = false;
    let taskTitle = subject;
    let description = bodyPreview;
    let taskCategory = "admin";
    let revenueImpact = "none";
    let contactEmail = lastMsgIsFromMe ? firstFromEmail : lastFromEmail;
    let contactName = lastMsgIsFromMe ? firstFromName : extractName(lastFrom);

    if (anthropic) {
      try {
        const prompt = `Du analysierst einen E-Mail-Thread für einen Geschäftsführer.

Meine E-Mail-Adresse: ${myEmail}
Betreff: ${subject}
Letzte Nachricht von: ${lastFrom}
Letzte Nachricht Vorschau: ${bodyPreview}
Anzahl Nachrichten im Thread: ${messages.length}
Letzte Nachricht ist von mir: ${lastMsgIsFromMe ? "JA" : "NEIN"}

Situation:
${lastMsgIsFromMe
  ? "Ich habe zuletzt geschrieben und warte auf eine Antwort (Follow-up Situation)."
  : "Jemand hat mir zuletzt geschrieben und ich habe noch nicht geantwortet."
}

Entscheide:
1. Erfordert das eine Aktion von mir?
2. Was genau muss ich tun?
3. Ist es umsatzrelevant (Kunde, Lead, Angebot)?

Antworte NUR als JSON:
{
  "needsAction": true/false,
  "taskTitle": "präziser Aufgabentitel (max 80 Zeichen)",
  "isFollowUp": ${lastMsgIsFromMe ? "true" : "false"},
  "description": "kurze Beschreibung was zu tun ist",
  "category": "sales|delivery|admin",
  "revenueImpact": "high|medium|low|none",
  "skipReason": "nur wenn needsAction=false: warum nicht"
}`;

        const analysis = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        });

        const text = analysis.content[0].type === "text" ? analysis.content[0].text : "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          needsAction = parsed.needsAction === true;
          taskTitle = parsed.taskTitle ?? subject;
          isFollowUp = parsed.isFollowUp === true;
          description = parsed.description ?? bodyPreview;
          taskCategory = parsed.category ?? "admin";
          revenueImpact = parsed.revenueImpact ?? "none";
        }
      } catch {
        // Fallback: use rule-based logic
        needsAction = lastMsgIsFromOther || lastMsgIsFromMe;
        isFollowUp = lastMsgIsFromMe;
      }
    } else {
      // Without Claude: simple rule-based
      needsAction = lastMsgIsFromOther || lastMsgIsFromMe;
      isFollowUp = lastMsgIsFromMe;
      taskTitle = lastMsgIsFromMe
        ? `Follow-up: ${subject}`
        : `Antworten: ${subject}`;
      description = bodyPreview;
    }

    if (!needsAction) continue;

    const priority = computePriority({
      category: taskCategory,
      source: "email",
      isFollowUp,
      revenueImpact,
    });

    const task = await db.task.create({
      data: {
        title: taskTitle,
        description,
        status: "open",
        category: taskCategory,
        source: "email",
        sourceId: thread.id,
        isFollowUp,
        followUpContact: contactEmail,
        revenueImpact,
        priority,
      },
    });

    await db.emailThread.create({
      data: {
        threadId: thread.id,
        subject,
        fromEmail: firstFromEmail,
        fromName: firstFromName || contactName,
        toEmails: JSON.stringify([toField]),
        snippet: bodyPreview.slice(0, 200),
        lastMessageAt: lastDateStr ? new Date(lastDateStr) : new Date(),
        messageCount: messages.length,
        hasPendingReply: !lastMsgIsFromMe, // I need to reply if last msg is from them
        isRead: !!(lastMsg.labelIds ?? []).includes("UNREAD") === false,
        taskId: task.id,
      },
    });

    newTaskCount++;
  }

  await db.integration.update({
    where: { type: slot },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus: "ok",
      itemCount: { increment: newTaskCount },
    },
  });

  return Response.json({ synced: threads.length, newTasks: newTaskCount });
}
