import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google";
import { db } from "@/lib/db";

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

  // Encode email as RFC 2822
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
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

  // Mark task as done if taskId provided
  if (taskId) {
    await db.task.update({
      where: { id: taskId },
      data: { status: "done", completedAt: new Date() },
    });
    // Mark thread as replied
    await db.emailThread.updateMany({
      where: { taskId },
      data: { hasPendingReply: false, isRead: true },
    });
  }

  return Response.json({ ok: true });
}
