import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { categorizeDaySlot, sortByPriority } from "@/lib/priority";
import { format } from "date-fns";

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

export async function GET() {
  const dateStr = todayStr();
  const plan = await db.dayPlan.findUnique({ where: { date: dateStr } });

  const tasks = await db.task.findMany({
    where: { status: { in: ["open", "in_progress"] } },
    orderBy: { priority: "desc" },
  });

  if (!plan) {
    const { now, later, skip } = categorizeDaySlot(tasks);
    return Response.json({
      date: dateStr,
      nowTaskIds: now.map((t) => t.id),
      laterTaskIds: later.map((t) => t.id),
      skipTaskIds: skip.map((t) => t.id),
      now,
      later,
      skip,
    });
  }

  const nowIds: string[] = JSON.parse(plan.nowTaskIds);
  const laterIds: string[] = JSON.parse(plan.laterTaskIds);
  const skipIds: string[] = JSON.parse(plan.skipTaskIds);

  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));

  return Response.json({
    date: dateStr,
    nowTaskIds: nowIds,
    laterTaskIds: laterIds,
    skipTaskIds: skipIds,
    now: sortByPriority(nowIds.map((id) => taskMap[id]).filter(Boolean)),
    later: sortByPriority(laterIds.map((id) => taskMap[id]).filter(Boolean)),
    skip: skipIds.map((id) => taskMap[id]).filter(Boolean),
    aiSummary: plan.aiSummary,
    aiRecommendations: plan.aiRecommendations,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const dateStr = todayStr();

  const plan = await db.dayPlan.upsert({
    where: { date: dateStr },
    create: {
      date: dateStr,
      nowTaskIds: JSON.stringify(body.nowTaskIds ?? []),
      laterTaskIds: JSON.stringify(body.laterTaskIds ?? []),
      skipTaskIds: JSON.stringify(body.skipTaskIds ?? []),
    },
    update: {
      nowTaskIds: body.nowTaskIds !== undefined ? JSON.stringify(body.nowTaskIds) : undefined,
      laterTaskIds: body.laterTaskIds !== undefined ? JSON.stringify(body.laterTaskIds) : undefined,
      skipTaskIds: body.skipTaskIds !== undefined ? JSON.stringify(body.skipTaskIds) : undefined,
    },
  });

  return Response.json(plan);
}
