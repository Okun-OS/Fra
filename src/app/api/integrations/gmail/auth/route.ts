import { NextRequest } from "next/server";
import { getOAuthClient, GMAIL_SCOPES } from "@/lib/google";

// GET /api/integrations/gmail/auth?slot=email_1
export async function GET(request: NextRequest) {
  const slot = request.nextUrl.searchParams.get("slot") ?? "email_1";

  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
    state: slot,
  });

  return Response.redirect(url);
}
