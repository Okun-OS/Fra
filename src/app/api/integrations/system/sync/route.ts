import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { computePriority } from "@/lib/priority";

// POST /api/integrations/system/sync  body: { type: "okunos" | "portal" }
// Fetches data from the connected system's API and creates tasks
export async function POST(request: NextRequest) {
  const { type } = await request.json();

  const integration = await db.integration.findUnique({ where: { type } });
  if (!integration || !integration.isActive) {
    return Response.json({ error: "Integration not connected" }, { status: 400 });
  }

  const config = JSON.parse(integration.config) as {
    apiUrl?: string;
    apiKey?: string;
  };

  if (!config.apiUrl || !config.apiKey) {
    return Response.json({ error: "Missing API configuration" }, { status: 400 });
  }

  // Generic REST fetch – both OkunOS and Portal expose a /tasks or /leads endpoint
  const endpoint =
    type === "okunos"
      ? `${config.apiUrl}/api/frank/tasks`
      : `${config.apiUrl}/api/frank/leads`;

  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    await db.integration.update({
      where: { type },
      data: { lastSyncStatus: "error", lastSyncMessage: `HTTP ${res.status}` },
    });
    return Response.json({ error: `API returned ${res.status}` }, { status: 502 });
  }

  const items = (await res.json()) as Array<{
    id: string;
    title: string;
    description?: string;
    status?: string;
    dueDate?: string;
    clientName?: string;
    clientId?: string;
    revenueImpact?: string;
    effort?: string;
    isFollowUp?: boolean;
    followUpContact?: string;
  }>;

  let created = 0;

  for (const item of items) {
    // Skip if already imported
    const exists = await db.task.findFirst({
      where: { source: type, sourceId: item.id },
    });
    if (exists) continue;

    const priority = computePriority({
      category: type === "okunos" ? "delivery" : "sales",
      source: type,
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      revenueImpact: item.revenueImpact ?? "medium",
      isFollowUp: item.isFollowUp,
    });

    await db.task.create({
      data: {
        title: item.title,
        description: item.description,
        status: "open",
        category: type === "okunos" ? "delivery" : "sales",
        source: type,
        sourceId: item.id,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        clientName: item.clientName,
        clientId: item.clientId,
        revenueImpact: item.revenueImpact ?? "medium",
        effort: item.effort ?? "medium",
        isFollowUp: item.isFollowUp ?? false,
        followUpContact: item.followUpContact,
        priority,
      },
    });

    created++;
  }

  await db.integration.update({
    where: { type },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus: "ok",
      itemCount: { increment: created },
    },
  });

  return Response.json({ total: items.length, newTasks: created });
}

// PUT /api/integrations/system/sync – save config (apiUrl + apiKey)
export async function PUT(request: NextRequest) {
  const { type, apiUrl, apiKey, displayName } = await request.json();

  await db.integration.upsert({
    where: { type },
    create: {
      type,
      name: type,
      displayName: displayName ?? type,
      isActive: true,
      config: JSON.stringify({ apiUrl, apiKey }),
    },
    update: {
      isActive: true,
      displayName: displayName ?? type,
      config: JSON.stringify({ apiUrl, apiKey }),
      lastSyncStatus: "ok",
    },
  });

  return Response.json({ ok: true });
}
