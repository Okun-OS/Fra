import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { db } from "@/lib/db";
import { computePriority } from "@/lib/priority";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// POST /api/integrations/gmail/sync  body: { slot: "email_1" }
export async function POST(request: NextRequest) {
  const { slot = "email_1" } = await request.json();

  const integration = await db.integration.findUnique({ where: { type: slot } });
  if (!integration || !integration.isActive) {
    return Response.json({ error: "Integration not connected" }, { status: 400 });
  }

  const config = JSON.parse(integration.config) as { email: string; tokens: object };

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(config.tokens);

  // Refresh token if needed
  oauth2Client.on("tokens", async (newTokens) => {
    const merged = { ...config.tokens, ...newTokens };
    await db.integration.update({
      where: { type: slot },
      data: { config: JSON.stringify({ ...config, tokens: merged }) },
    });
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Fetch unread threads from last 7 days
  const threadsRes = await gmail.users.threads.list({
    userId: "me",
    q: "is:unread newer_than:7d -from:me",
    maxResults: 20,
  });

  const threads = threadsRes.data.threads ?? [];
  let newTaskCount = 0;

  for (const thread of threads) {
    if (!thread.id) continue;

    // Skip if already processed
    const existing = await db.emailThread.findUnique({
      where: { threadId: thread.id },
    });
    if (existing) continue;

    // Get thread detail
    const threadDetail = await gmail.users.threads.get({
      userId: "me",
      id: thread.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Date"],
    });

    const messages = threadDetail.data.messages ?? [];
    if (messages.length === 0) continue;

    const firstMsg = messages[0];
    const headers = firstMsg.payload?.headers ?? [];
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "(Kein Betreff)";
    const from = headers.find((h) => h.name === "From")?.value ?? "";
    const to = headers.find((h) => h.name === "To")?.value ?? "";
    const dateStr = headers.find((h) => h.name === "Date")?.value;
    const snippet = firstMsg.snippet ?? "";

    const fromEmail = from.match(/<(.+)>/)?.[1] ?? from;
    const fromName = from.replace(/<.+>/, "").trim().replace(/"/g, "");

    // Use Claude to decide if this email needs action
    let needsAction = false;
    let taskTitle = subject;
    let isFollowUp = false;
    let description = snippet;

    if (anthropic) {
      try {
        const analysis = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `Analysiere diese E-Mail und entscheide ob sie eine Aufgabe/Reaktion erfordert.

Betreff: ${subject}
Von: ${from}
Vorschau: ${snippet}

Antworte als JSON:
{
  "needsAction": true/false,
  "taskTitle": "kurzer Aufgabentitel",
  "isFollowUp": true/false,
  "reason": "kurze Begründung"
}`,
          }],
        });

        const text = analysis.content[0].type === "text" ? analysis.content[0].text : "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          needsAction = parsed.needsAction === true;
          taskTitle = parsed.taskTitle ?? subject;
          isFollowUp = parsed.isFollowUp === true;
          description = parsed.reason ?? snippet;
        }
      } catch {
        // If Claude fails, default to creating a task for unread emails
        needsAction = true;
      }
    } else {
      // Without Claude: create task for all unread threads
      needsAction = true;
    }

    if (!needsAction) continue;

    const lastMsg = messages[messages.length - 1];
    const lastDateHeaders = lastMsg.payload?.headers ?? [];
    const lastDateStr = lastDateHeaders.find((h) => h.name === "Date")?.value ?? dateStr;

    const priority = computePriority({
      category: "admin",
      source: "email",
      isFollowUp,
      revenueImpact: "none",
    });

    // Create task
    const task = await db.task.create({
      data: {
        title: taskTitle,
        description,
        status: "open",
        category: "admin",
        source: "email",
        sourceId: thread.id,
        isFollowUp,
        followUpContact: fromEmail,
        priority,
      },
    });

    // Link email thread
    await db.emailThread.create({
      data: {
        threadId: thread.id,
        subject,
        fromEmail,
        fromName,
        toEmails: JSON.stringify([to]),
        snippet,
        lastMessageAt: lastDateStr ? new Date(lastDateStr) : new Date(),
        messageCount: messages.length,
        hasPendingReply: true,
        isRead: false,
        taskId: task.id,
      },
    });

    newTaskCount++;
  }

  // Update integration sync status
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
