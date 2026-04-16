import { db } from "./db";
import { computePriority } from "./priority";
import { addDays, subDays } from "date-fns";

export async function seedDatabase() {
  const count = await db.task.count();
  if (count > 0) return;

  const now = new Date();

  const tasks = [
    // Delivery
    {
      title: "Onboarding-Unterlagen für Kunde Meier GmbH fertigstellen",
      description: "Vertragsunterlagen, Zugangs-Setup und Kickoff-Agenda",
      category: "delivery",
      source: "okunos",
      dueDate: addDays(now, 1),
      isToday: true,
      revenueImpact: "high",
      effort: "medium",
      clientName: "Meier GmbH",
      isFollowUp: false,
    },
    {
      title: "Wöchentlicher Status-Call mit Kunde Schmidt & Partner",
      description: "Offene Punkte aus letzter Woche besprechen",
      category: "delivery",
      source: "manual",
      dueDate: now,
      isToday: true,
      revenueImpact: "high",
      effort: "quick",
      clientName: "Schmidt & Partner",
    },
    {
      title: "Projektdokumentation Q1 abschließen",
      category: "delivery",
      source: "manual",
      dueDate: addDays(now, 3),
      revenueImpact: "medium",
      effort: "heavy",
    },
    // Sales
    {
      title: "Follow-up Angebot Müller Consulting",
      description: "Angebot wurde am 10. April versendet, noch keine Rückmeldung",
      category: "sales",
      source: "email",
      isFollowUp: true,
      followUpDate: subDays(now, 2),
      followUpContact: "thomas.mueller@consulting.de",
      revenueImpact: "high",
      effort: "quick",
      clientName: "Müller Consulting",
    },
    {
      title: "Demo-Termin mit Neukunde Braun AG vorbereiten",
      category: "sales",
      source: "portal",
      dueDate: addDays(now, 2),
      revenueImpact: "high",
      effort: "medium",
      clientName: "Braun AG",
    },
    {
      title: "Preisverhandlung Koch Industries abschließen",
      category: "sales",
      source: "email",
      isFollowUp: true,
      followUpDate: now,
      dueDate: addDays(now, 1),
      revenueImpact: "high",
      effort: "medium",
      clientName: "Koch Industries",
    },
    {
      title: "Pipeline-Review: 3 Leads im Stale-Status",
      category: "sales",
      source: "portal",
      revenueImpact: "medium",
      effort: "quick",
    },
    // System
    {
      title: "OkunOS: 4 Kunden ohne Status-Update seit 7 Tagen",
      category: "system",
      source: "okunos",
      dueDate: now,
      revenueImpact: "medium",
      effort: "quick",
    },
    {
      title: "Portal: 2 Leads seit 10 Tagen ohne Reaktion",
      category: "system",
      source: "portal",
      isFollowUp: true,
      followUpDate: subDays(now, 3),
      revenueImpact: "medium",
      effort: "quick",
    },
    // Admin
    {
      title: "Eingangsrechnungen März prüfen und freigeben",
      category: "admin",
      source: "manual",
      dueDate: subDays(now, 1),
      revenueImpact: "low",
      effort: "medium",
    },
    {
      title: "Steuerdokumente für Steuerberater zusammenstellen",
      category: "admin",
      source: "manual",
      dueDate: addDays(now, 7),
      revenueImpact: "none",
      effort: "heavy",
    },
    // Vision
    {
      title: "Produktstrategie Q3 definieren",
      category: "vision",
      source: "manual",
      revenueImpact: "none",
      effort: "heavy",
    },
  ];

  for (const t of tasks) {
    const priority = computePriority(t);
    await db.task.create({
      data: {
        title: t.title,
        description: t.description,
        category: t.category,
        source: t.source,
        dueDate: t.dueDate,
        isToday: t.isToday ?? false,
        isFollowUp: t.isFollowUp ?? false,
        followUpDate: t.followUpDate,
        followUpContact: t.followUpContact,
        revenueImpact: t.revenueImpact,
        effort: t.effort,
        clientName: t.clientName,
        priority,
      },
    });
  }

  // Integrations
  await db.integration.createMany({
    data: [
      { type: "email_1", name: "email_1", displayName: "Postfach 1 – Geschäftsführung", isActive: false },
      { type: "email_2", name: "email_2", displayName: "Postfach 2 – Sales", isActive: false },
      { type: "email_3", name: "email_3", displayName: "Postfach 3 – Support", isActive: false },
      { type: "okunos", name: "okunos", displayName: "OkunOS", isActive: false },
      { type: "portal", name: "portal", displayName: "Lead Portal", isActive: false },
    ],
  });
}
