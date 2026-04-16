"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/tasks/TaskCard";
import { FrankAvatar } from "@/components/frank/FrankAvatar";
import {
  AlertTriangle,
  Clock,
  Mail,
  TrendingUp,
  Zap,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "critical" | "warning" | "info" | "default";
}) {
  const colors = {
    critical: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
    default: "text-white/60",
  };

  return (
    <Card className="flex items-center gap-4">
      <div className={`rounded-lg p-2.5 bg-white/5 ${colors[variant]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
        <p className="text-xs text-white/40 mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

function SeedButton() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const seed = async () => {
    setLoading(true);
    await fetch("/api/seed", { method: "POST" });
    setDone(true);
    setLoading(false);
    window.location.reload();
  };

  if (done) return null;

  return (
    <Button onClick={seed} disabled={loading} size="sm" variant="ghost">
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      Demo-Daten laden
    </Button>
  );
}

export default function Dashboard() {
  const { data, mutate } = useSWR("/api/dashboard", fetcher, { refreshInterval: 30000 });
  const { data: frank } = useSWR("/api/frank", fetcher);

  const handleComplete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    mutate();
  };

  const today = format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de });

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-2">{today}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
          {frank?.briefing && (
            <p className="mt-2 text-sm text-white/50 max-w-xl leading-relaxed">{frank.briefing}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SeedButton />
          <Link href="/frank">
            <Button variant="primary" size="sm">
              <FrankAvatar size="sm" />
              Frank fragen
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard label="Offene Aufgaben" value={data.stats.open} icon={Clock} />
          <StatCard label="Kritisch" value={data.stats.critical} icon={AlertTriangle} variant="critical" />
          <StatCard label="Überfällig" value={data.stats.overdue} icon={AlertTriangle} variant="warning" />
          <StatCard label="Follow-ups" value={data.stats.followUps} icon={Mail} variant="info" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's tasks */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Heute</CardTitle>
              <Link href="/today" className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1">
                Alle <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <div className="space-y-2">
              {data?.todayTasks?.length > 0 ? (
                data.todayTasks.slice(0, 6).map((task: Parameters<typeof TaskCard>[0]["task"]) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    compact
                  />
                ))
              ) : (
                <p className="text-sm text-white/25 py-4 text-center">
                  {data ? "Keine Aufgaben für heute" : "Lädt…"}
                </p>
              )}
            </div>
          </Card>

          {/* Critical */}
          {data?.criticalTasks?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-400/60">Kritisch</CardTitle>
                <Badge variant="critical">{data.criticalTasks.length}</Badge>
              </CardHeader>
              <div className="space-y-2">
                {data.criticalTasks.slice(0, 4).map((task: Parameters<typeof TaskCard>[0]["task"]) => (
                  <TaskCard key={task.id} task={task} onComplete={handleComplete} compact />
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Frank recommendations */}
          {frank?.recommendations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Frank empfiehlt</CardTitle>
                <FrankAvatar size="sm" animated />
              </CardHeader>
              <div className="space-y-3">
                {frank.recommendations.map((rec: string, i: number) => (
                  <div key={i} className="flex gap-3">
                    <span className="mt-0.5 text-white/20 text-xs font-mono shrink-0">{i + 1}</span>
                    <p className="text-xs text-white/60 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Follow-ups */}
          {data?.followUpTasks?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Follow-ups</CardTitle>
                <Link href="/inbox" className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1">
                  Alle <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <div className="space-y-2">
                {data.followUpTasks.slice(0, 4).map((task: Parameters<typeof TaskCard>[0]["task"]) => (
                  <TaskCard key={task.id} task={task} compact />
                ))}
              </div>
            </Card>
          )}

          {/* Category breakdown */}
          {data?.byCategory && (
            <Card>
              <CardHeader>
                <CardTitle>Nach Bereich</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {Object.entries(data.byCategory as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-xs text-white/50 capitalize">{cat}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1 bg-white/5 rounded-full w-24 overflow-hidden">
                          <div
                            className="h-full bg-white/20 rounded-full"
                            style={{ width: `${(count / (data.stats.open || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/30 w-4 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Integrations status */}
          <Card>
            <CardHeader>
              <CardTitle>Verbindungen</CardTitle>
              <Link href="/systems" className="text-xs text-white/30 hover:text-white/60">
                Verwalten
              </Link>
            </CardHeader>
            <div className="space-y-2">
              {data?.integrations?.map((int: { id: string; displayName: string; isActive: boolean; lastSyncStatus?: string }) => (
                <div key={int.id} className="flex items-center justify-between py-1">
                  <span className="text-xs text-white/50">{int.displayName}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${int.isActive ? "bg-green-400" : "bg-white/15"}`} />
                </div>
              ))}
              {!data?.integrations?.length && (
                <p className="text-xs text-white/25">Keine Verbindungen konfiguriert</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
