"use client";

import useSWR from "swr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/tasks/TaskCard";
import {
  Building2,
  Globe,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
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

function IntegrationCard({ integration }: { integration: Integration }) {
  const icons: Record<string, React.ElementType> = {
    email_1: Mail,
    email_2: Mail,
    email_3: Mail,
    okunos: Building2,
    portal: Globe,
  };
  const Icon = icons[integration.type] ?? AlertCircle;

  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] p-5 transition-all hover:border-white/8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-white/5">
            <Icon className="h-5 w-5 text-white/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/85">{integration.displayName}</p>
            <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{integration.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {integration.isActive ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <XCircle className="h-4 w-4 text-white/20" />
          )}
          <Badge variant={integration.isActive ? "success" : "muted"}>
            {integration.isActive ? "Verbunden" : "Nicht verbunden"}
          </Badge>
        </div>
      </div>

      {integration.isActive ? (
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Erkannte Aufgaben</span>
            <span className="text-white/70 font-medium">{integration.itemCount}</span>
          </div>
          {integration.lastSyncedAt && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Letzter Sync</span>
              <span className="text-white/40">
                {new Date(integration.lastSyncedAt).toLocaleString("de-DE")}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/30 mb-4 leading-relaxed">
          {integration.type.startsWith("email")
            ? "Verbinde dieses Postfach, damit Frank E-Mails auslesen und Aufgaben erkennen kann."
            : integration.type === "okunos"
            ? "Verbinde OkunOS, um Kundenaktivitäten, offene Prozesse und Status-Updates zu überwachen."
            : "Verbinde das Lead Portal, um neue Leads, Follow-up-Bedarf und Conversion-Chancen zu erkennen."}
        </p>
      )}

      <Button variant="secondary" size="sm" className="w-full">
        {integration.isActive ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Synchronisieren
          </>
        ) : (
          <>
            Verbinden
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </>
        )}
      </Button>
    </div>
  );
}

function DataSection({
  title,
  source,
  tasks,
  onComplete,
}: {
  title: string;
  source: string;
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
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onComplete={onComplete} compact />
          ))
        ) : (
          <div className="py-8 text-center">
            <p className="text-xs text-white/25">
              {source === "okunos"
                ? "OkunOS nicht verbunden"
                : "Lead Portal nicht verbunden"}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SystemsPage() {
  const { data: integrations } = useSWR<Integration[]>("/api/integrations", fetcher);
  const { data: okunTasks, mutate: mutateOkun } = useSWR<Task[]>("/api/tasks?source=okunos", fetcher);
  const { data: portalTasks, mutate: mutatePortal } = useSWR<Task[]>("/api/tasks?source=portal", fetcher);

  const handleComplete = async (id: string, mutate: () => void) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    mutate();
  };

  const emailIntegrations = integrations?.filter((i) => i.type.startsWith("email")) ?? [];
  const systemIntegrations = integrations?.filter((i) => !i.type.startsWith("email")) ?? [];

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Systeme</h1>
        <p className="text-sm text-white/40 mt-1">
          Verbindungen zu deinen operativen Quellen
        </p>
      </div>

      {/* System integrations */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-white/30 mb-4">Operative Systeme</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systemIntegrations.map((i) => (
            <IntegrationCard key={i.id} integration={i} />
          ))}
        </div>
      </div>

      {/* Live system data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DataSection
          title="OkunOS — Offene Aufgaben"
          source="okunos"
          tasks={okunTasks ?? []}
          onComplete={(id) => handleComplete(id, mutateOkun)}
        />
        <DataSection
          title="Lead Portal — Offene Leads"
          source="portal"
          tasks={portalTasks ?? []}
          onComplete={(id) => handleComplete(id, mutatePortal)}
        />
      </div>

      {/* Email integrations */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-white/30 mb-4">E-Mail Postfächer</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {emailIntegrations.map((i) => (
            <IntegrationCard key={i.id} integration={i} />
          ))}
        </div>
      </div>

      {/* Integration notes */}
      <div className="mt-10 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-white/25 mb-3">
          Integrations-Architektur
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "OkunOS",
              desc: "REST API oder Webhook-Integration. Frank liest Kunden, Status-Updates und offene Prozesse aus OkunOS aus und erkennt automatisch handlungsrelevante Datenpunkte.",
            },
            {
              title: "Lead Portal",
              desc: "Direkte API-Anbindung an das Portal-Backend. Frank erkennt stale Leads, Follow-up-Bedarf und Conversion-relevante Events.",
            },
            {
              title: "E-Mail",
              desc: "OAuth2 + IMAP/SMTP. Frank liest Threads, erkennt unantwortete Mails, offene Zusagen und generiert daraus Aufgaben mit Priorität.",
            },
          ].map(({ title, desc }) => (
            <div key={title}>
              <p className="text-xs font-medium text-white/50 mb-1">{title}</p>
              <p className="text-xs text-white/25 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
