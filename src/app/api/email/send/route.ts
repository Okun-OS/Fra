import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { db } from "@/lib/db";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

async function fetchGmailSignature(
  gmail: ReturnType<typeof google.gmail>,
  senderEmail: string
): Promise<string> {
  try {
    const res = await gmail.users.settings.sendAs.list({ userId: "me" });
    const sendAsEntries = res.data.sendAs ?? [];
    const match =
      sendAsEntries.find((s) => s.sendAsEmail?.toLowerCase() === senderEmail.toLowerCase()) ??
      sendAsEntries.find((s) => s.isDefault) ??
      sendAsEntries[0];

    if (!match?.signature) return "";
    return stripHtml(match.signature);
  } catch {
    return "";
  }
}

// POST /api/email/send
// body: { slot, to, subject, body, taskId }
export async function POST(request: NextRequest) {
  const { slot = "email_1", to, subject, body, taskId } = await request.json();

  const integration = await db.integration.findUnique({ where: { type: slot } });
  if (!integration?.isActive) {
    return Response.json({ error: "Gmail not connected" }, { status: 400 });
  }

  const config = JSON.parse(integration.config) as { email: string; tokens: object };
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials(config.tokens);

  oauth2Client.on("tokens", async (newTokens) => {
    const merged = { ...config.tokens, ...newTokens };
    await db.integration.update({
      where: { type: slot },
      data: { config: JSON.stringify({ ...config, tokens: merged }) },
    });
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Fetch signature and append if present
  const signature = await fetchGmailSignature(gmail, config.email);
  const fullBody = signature ? `${body}\n\n-- \n${signature}` : body;

  // Encode email as RFC 2822
  const emailLines = [
    `From: ${config.email}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    fullBody,
  ];
  const raw = Buffer.from(emailLines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  if (taskId) {
    await db.task.update({
      where: { id: taskId },
      data: { status: "done", completedAt: new Date() },
    });
    await db.emailThread.updateMany({
      where: { taskId },
      data: { hasPendingReply: false, isRead: true },
    });
  }

  return Response.json({ ok: true });
}
