import { NextRequest } from "next/server";
import { getOAuthClient } from "@/lib/google";
import { google } from "googleapis";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const slot = request.nextUrl.searchParams.get("state") ?? "email_1";

  if (!code) {
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/systems?error=no_code`);
  }

  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user email to label the integration
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email ?? slot;

  // Save tokens to integration
  await db.integration.upsert({
    where: { type: slot },
    create: {
      type: slot,
      name: slot,
      displayName: `Gmail: ${email}`,
      isActive: true,
      config: JSON.stringify({ email, tokens }),
    },
    update: {
      displayName: `Gmail: ${email}`,
      isActive: true,
      config: JSON.stringify({ email, tokens }),
      lastSyncStatus: "ok",
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return Response.redirect(`${appUrl}/systems?connected=${slot}`);
}
