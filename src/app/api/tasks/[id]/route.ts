import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { computePriority } from "@/lib/priority";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await ctx.params;
  const task = await db.task.findUnique({ where: { id }, include: { emailThread: true } });
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(task);
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await ctx.params;
  const body = await request.json();

  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const merged = { ...existing, ...body };
  const priority = body.priority !== undefined ? body.priority : computePriority(merged);

  const task = await db.task.update({
    where: { id },
    data: {
      ...body,
      priority,
      dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      followUpDate: body.followUpDate !== undefined ? (body.followUpDate ? new Date(body.followUpDate) : null) : undefined,
      completedAt: body.status === "done" ? new Date() : (body.status !== undefined ? null : undefined),
      updatedAt: new Date(),
    },
  });

  return Response.json(task);
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await ctx.params;
  await db.task.delete({ where: { id } });
  return Response.json({ ok: true });
}
