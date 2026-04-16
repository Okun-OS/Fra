import { seedDatabase } from "@/lib/seed";

export async function POST() {
  await seedDatabase();
  return Response.json({ ok: true });
}
