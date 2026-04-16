import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { computePriority } from "@/lib/priority";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const tasks = await db.task.findMany({
    where: {
      ...(status && status !== "all" ? { status } : {}),
      ...(source && source !== "all" ? { source } : {}),
      ...(category && category !== "all" ? { category } : {}),
      ...(q ? { title: { contains: q } } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { emailThread: true },
  });

  return Response.json(tasks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const priority = computePriority(body);

  const task = await db.task.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      category: body.category ?? "admin",
      source: "manual",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      isToday: body.isToday ?? false,
      isFollowUp: body.isFollowUp ?? false,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      followUpContact: body.followUpContact ?? null,
      revenueImpact: body.revenueImpact ?? "none",
      effort: body.effort ?? "medium",
      clientName: body.clientName ?? null,
      tags: body.tags ? JSON.stringify(body.tags) : "[]",
      priority,
    },
  });

  return Response.json(task, { status: 201 });
}
