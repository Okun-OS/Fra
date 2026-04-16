"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Database, Zap, Info } from "lucide-react";

export default function SettingsPage() {
  const resetData = async () => {
    if (!confirm("Demo-Daten löschen und neu laden?")) return;
    // Delete all tasks via API (for demo purposes)
    await fetch("/api/seed", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Einstellungen</h1>
        <p className="text-sm text-white/40 mt-1">Konfiguration und System-Informationen</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
            <Badge variant="muted">v0.1</Badge>
          </CardHeader>
          <div className="space-y-3">
            {[
              { label: "Version", value: "0.1.0 MVP" },
              { label: "Stack", value: "Next.js 16 · Prisma · SQLite" },
              { label: "KI-Engine", value: "Regelbasiert + Claude API (geplant)" },
              { label: "Datenbank", value: "frank.db (lokal)" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-[#1a1a1a] last:border-0">
                <span className="text-xs text-white/40">{label}</span>
                <span className="text-xs text-white/70 font-mono">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daten</CardTitle>
            <Database className="h-3.5 w-3.5 text-white/30" />
          </CardHeader>
          <p className="text-xs text-white/40 mb-4 leading-relaxed">
            Im MVP-Modus werden Demo-Daten verwendet. In der Produktionsversion werden alle Daten über die
            Integrationen (OkunOS, Lead Portal, E-Mail) live abgerufen.
          </p>
          <Button variant="danger" size="sm" onClick={resetData}>
            Demo-Daten neu laden
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roadmap</CardTitle>
            <Zap className="h-3.5 w-3.5 text-white/30" />
          </CardHeader>
          <div className="space-y-2">
            {[
              { label: "E-Mail OAuth2 Integration", status: "Geplant" },
              { label: "OkunOS API Connector", status: "Geplant" },
              { label: "Lead Portal API Connector", status: "Geplant" },
              { label: "Claude API (KI-Analyse)", status: "Geplant" },
              { label: "Push Notifications", status: "Geplant" },
              { label: "Drag & Drop Tagesplan", status: "Geplant" },
              { label: "Mobile App", status: "Vision" },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between py-1">
                <span className="text-xs text-white/50">{label}</span>
                <Badge variant="muted">{status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
