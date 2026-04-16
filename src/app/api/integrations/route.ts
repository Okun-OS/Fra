import { db } from "@/lib/db";

export async function GET() {
  const integrations = await db.integration.findMany({ orderBy: { type: "asc" } });
  return Response.json(integrations);
}
