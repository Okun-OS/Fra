"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/tasks/TaskCard";
import {
  Building2,
  Globe,
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronRight,
  Key,
  Link2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
type Task = Parameters<typeof TaskCard>[0]["task"];

type Integration = {
  id: string;
  type: string;
  displayName: string;
  isActive: boolean;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  itemCount: number;
};

// ── Gmail Card ────────────────────────────────────────────────────────────────
function GmailCard({ integration, slot, onSync }: {
  integration?: Integration;
  slot: string;
  onSync: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const connected = integration?.isActive;

  const sync = async () => {
    setSyncing(true);
    await fetch("/api/integrations/gmail/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot }),
    });
    setSyncing(false);
    onSync();
  };

  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-white/5">
            <Mail className="h-5 w-5 text-white/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/85">
              {connected ? integration!.displayName : `Gmail Postfach (${slot})`}
            </p>
            <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{slot}</p>
          </div>
        </div>
        <Badge variant={connected ? "success" : "muted"}>
          {connected ? "Verbunden" : "Nicht verbunden"}
        </Badge>
      </div>

      {connected ? (
        <div className="space-y-2 mb-4 text-xs">
          <div className="flex justify-between">
            <span className="text-white/40">Erkannte Tasks</span>
            <span className="text-white/70">{integration!.itemCount}</span>
          </div>
          {integration!.lastSyncedAt && (
            <div className="flex justify-between">
              <span className="text-white/40">Letzter Sync</span>
              <span className="text-white/40">
                {new Date(integration!.lastSyncedAt).toLocaleString("de-DE")}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/30 mb-4 leading-relaxed">
          Frank liest deine E-Mails aus, erkennt Aufgaben und Follow-ups automatisch per KI.
        </p>
      )}

      {connected ? (
        <Button variant="secondary" size="sm" className="w-full" onClick={sync} disabled={syncing}>
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisiere…" : "Jetzt synchronisieren"}
        </Button>
      ) : (
        <a href={`/api/integrations/gmail/auth?slot=${slot}`} className="block">
          <Button variant="primary" size="sm" className="w-full">
            <Mail className="h-3.5 w-3.5" />
            Mit Gmail verbinden
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </Button>
        </a>
      )}
    </div>
  );
}

// ── System Card (OkunOS / Portal) ─────────────────────────────────────────────
function SystemCard({ integration, type, label, onSync }: {
  integration?: Integration;
  type: string;
  label: string;
  onSync: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const connected = integration?.isActive;
  const Icon = type === "okunos" ? Building2 : Globe;

  const save = async () => {
    setSaving(true);
    await fetch("/api/integrations/system/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, apiUrl, apiKey, displayName: label }),
    });
    setSaving(false);
    setShowForm(false);
    onSync();
  };

  const sync = async () => {
    setSyncing(true);
    await fetch("/api/integrations/system/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    setSyncing(false);
    onSync();
  };

  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-white/5">
            <Icon className="h-5 w-5 text-white/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/85">{label}</p>
            <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{type}</p>
          </div>
        </div>
        <Badge variant={connected ? "success" : "muted"}>
          {connected ? "Verbunden" : "Nicht verbunden"}
        </Badge>
      </div>

      {connected && !showForm && (
        <div className="space-y-2 mb-4 text-xs">
          <div className="flex justify-between">
            <span className="text-white/40">Importierte Tasks</span>
            <span className="text-white/70">{integration!.itemCount}</span>
          </div>
          {integration!.lastSyncedAt && (
            <div className="flex justify-between">
              <span className="text-white/40">Letzter Sync</span>
              <span className="text-white/40">
                {new Date(integration!.lastSyncedAt).toLocaleString("de-DE")}
              </span>
            </div>
          )}
        </div>
      )}

      {!connected && !showForm && (
        <p className="text-xs text-white/30 mb-4 leading-relaxed">
          {type === "okunos"
            ? "Verbinde OkunOS, um Kundenstatus, offene Prozesse und Delivery-Tasks automatisch zu importieren."
            : "Verbinde das Lead Portal, um Leads, Follow-up-Bedarf und Sales-Chancen zu erkennen."}
        </p>
      )}

      {showForm && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">API URL</label>
            <Input
              placeholder="https://dein-system.de"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 mb-1 block">API Key</label>
            <Input
              placeholder="sk-..."
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-white/25 leading-relaxed">
            Frank erwartet den Endpunkt{" "}
            <code className="text-white/40">
              {type === "okunos" ? "/api/frank/tasks" : "/api/frank/leads"}
            </code>{" "}
            in deinem System.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {showForm ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Abbrechen</Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={save} disabled={saving || !apiUrl || !apiKey}>
              {saving ? "Speichern…" : "Verbinden"}
            </Button>
          </>
        ) : connected ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
              <Key className="h-3.5 w-3.5" />
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={sync} disabled={syncing}>
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync…" : "Synchronisieren"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" className="w-full" onClick={() => setShowForm(true)}>
            <Link2 className="h-3.5 w-3.5" />
            API verbinden
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Data section ──────────────────────────────────────────────────────────────
function DataSection({ title, tasks, onComplete }: {
  title: string;
  tasks: Task[];
  onComplete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge variant="muted">{tasks.length}</Badge>
      </CardHeader>
      <div className="space-y-2">
        {tasks.length > 0 ? (
          tasks.map((t) => <TaskCard key={t.id} task={t} onComplete={onComplete} compact />)
        ) : (
          <p className="text-xs text-white/25 py-6 text-center">Noch keine Daten importiert</p>
        )}
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function SystemsContent() {
  const { data: integrations, mutate } = useSWR<Integration[]>("/api/integrations", fetcher);
  const { data: okunTasks, mutate: mutateOkun } = useSWR<Task[]>("/api/tasks?source=okunos", fetcher);
  const { data: portalTasks, mutate: mutatePortal } = useSWR<Task[]>("/api/tasks?source=portal", fetcher);
  const { data: emailTasks, mutate: mutateEmail } = useSWR<Task[]>("/api/tasks?source=email", fetcher);

  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");

  const getIntegration = (type: string) => integrations?.find((i) => i.type === type);

  const handleComplete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    mutateOkun();
    mutatePortal();
    mutateEmail();
  };

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Systeme</h1>
        <p className="text-sm text-white/40 mt-1">Verbinde deine Quellen — Frank erkennt Tasks automatisch</p>
        {connected && (
          <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/8 px-4 py-2 text-sm text-green-400">
            ✓ Postfach erfolgreich verbunden
          </div>
        )}
      </div>

      {/* Gmail */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-white/30 mb-4">Gmail Postfächer</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["email_1", "email_2", "email_3"].map((slot) => (
            <GmailCard
              key={slot}
              slot={slot}
              integration={getIntegration(slot)}
              onSync={() => { mutate(); mutateEmail(); }}
            />
          ))}
        </div>
        {!process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED && (
          <p className="mt-3 text-xs text-white/25">
            Benötigt: <code className="text-white/40">GOOGLE_CLIENT_ID</code> und{" "}
            <code className="text-white/40">GOOGLE_CLIENT_SECRET</code> in Railway Variables.
          </p>
        )}
      </div>

      {/* Operative systems */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-white/30 mb-4">Operative Systeme</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SystemCard
            type="okunos"
            label="OkunOS"
            integration={getIntegration("okunos")}
            onSync={() => { mutate(); mutateOkun(); }}
          />
          <SystemCard
            type="portal"
            label="Lead Portal"
            integration={getIntegration("portal")}
            onSync={() => { mutate(); mutatePortal(); }}
          />
        </div>
      </div>

      {/* Imported data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DataSection title="OkunOS Tasks" tasks={okunTasks ?? []} onComplete={handleComplete} />
        <DataSection title="Portal Leads" tasks={portalTasks ?? []} onComplete={handleComplete} />
        <DataSection title="E-Mail Tasks" tasks={emailTasks ?? []} onComplete={handleComplete} />
      </div>
    </div>
  );
}

export default function SystemsPage() {
  return (
    <Suspense>
      <SystemsContent />
    </Suspense>
  );
}
