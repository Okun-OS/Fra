"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Task = Parameters<typeof TaskCard>[0]["task"];

function DayColumn({
  title,
  tasks,
  subtitle,
  onComplete,
  accent,
}: {
  title: string;
  tasks: Task[];
  subtitle?: string;
  onComplete: (id: string) => void;
  accent?: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          {accent && <div className={`h-1.5 w-1.5 rounded-full ${accent}`} />}
          <h2 className="text-xs font-medium uppercase tracking-widest text-white/40">{title}</h2>
        </div>
        {subtitle && <p className="text-[10px] text-white/20 pl-3.5">{subtitle}</p>}
      </div>

      <div className="space-y-2 min-h-[120px]">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 py-8 text-center">
            <p className="text-xs text-white/20">Leer</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onComplete={onComplete} />
          ))
        )}
      </div>
    </div>
  );
}

export default function TodayPage() {
  const { data, mutate } = useSWR("/api/dayplan", fetcher);
  const [regenerating, setRegenerating] = useState(false);

  const handleComplete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    mutate();
  };

  const regeneratePlan = async () => {
    setRegenerating(true);
    await fetch("/api/dayplan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nowTaskIds: [], laterTaskIds: [], skipTaskIds: [] }),
    });
    await mutate();
    setRegenerating(false);
  };

  const today = format(new Date(), "EEEE, dd. MMMM", { locale: de });

  const now: Task[] = data?.now ?? [];
  const later: Task[] = data?.later ?? [];
  const skip: Task[] = data?.skip ?? [];

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-2">{today}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Tagesplan</h1>
          <p className="text-sm text-white/40 mt-1">
            {now.length} jetzt · {later.length} danach · {skip.length} nicht heute
          </p>
        </div>
        <Button onClick={regeneratePlan} disabled={regenerating} variant="ghost" size="sm">
          <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          Plan neu generieren
        </Button>
      </div>

      {/* Frank summary */}
      {data?.aiSummary && (
        <div className="mb-8 rounded-xl border border-white/8 bg-white/3 px-5 py-4 flex gap-3">
          <Zap className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
          <p className="text-sm text-white/60 leading-relaxed">{data.aiSummary}</p>
        </div>
      )}

      {/* Three columns */}
      <div className="flex gap-6">
        <DayColumn
          title="Jetzt"
          subtitle="Sofort angehen"
          tasks={now}
          onComplete={handleComplete}
          accent="bg-white"
        />
        <div className="w-px bg-[#1a1a1a] shrink-0" />
        <DayColumn
          title="Danach"
          subtitle="Heute noch"
          tasks={later}
          onComplete={handleComplete}
          accent="bg-white/40"
        />
        <div className="w-px bg-[#1a1a1a] shrink-0" />
        <DayColumn
          title="Nicht heute"
          subtitle="Bewusst zurückgestellt"
          tasks={skip}
          onComplete={handleComplete}
          accent="bg-white/15"
        />
      </div>

      {/* Progress bar */}
      {(now.length + later.length + skip.length) > 0 && (
        <div className="mt-10 flex items-center gap-4">
          <p className="text-xs text-white/30 shrink-0">Tagesfortschritt</p>
          <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/30 rounded-full transition-all duration-500"
              style={{ width: `${(now.length / (now.length + later.length + skip.length)) * 100}%` }}
            />
          </div>
          <p className="text-xs text-white/30 shrink-0">{now.length} fokussiert</p>
        </div>
      )}
    </div>
  );
}
