"use client";

import useSWR from "swr";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Mail, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
type Task = Parameters<typeof TaskCard>[0]["task"] & {
  followUpContact?: string | null;
  followUpDate?: string | null;
  isFollowUp?: boolean;
};

export default function InboxPage() {
  const { data: allTasks, mutate } = useSWR<Task[]>("/api/tasks?source=email&status=open", fetcher);
  const { data: followUpTasks } = useSWR<Task[]>("/api/tasks?status=open", fetcher);

  const emailTasks = allTasks ?? [];
  const followUps = (followUpTasks ?? []).filter((t) => t.isFollowUp);

  const handleComplete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    mutate();
  };

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white">E-Mail Tasks</h1>
        <p className="text-sm text-white/40 mt-1">
          Automatisch erkannte Aufgaben aus deinen Postfächern
        </p>
      </div>

      {/* Integration status bar */}
      <div className="mb-6 rounded-xl border border-[#1e1e1e] bg-[#0c0c0c] px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-white/30" />
            <div>
              <p className="text-sm font-medium text-white/70">Postfach-Integration</p>
              <p className="text-xs text-white/30 mt-0.5">
                Verbinde deine E-Mail-Postfächer unter Systeme → E-Mail, um automatisch Aufgaben zu erkennen.
              </p>
            </div>
          </div>
          <Badge variant="warning">Nicht verbunden</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email-derived tasks */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Erkannte E-Mail Aufgaben</CardTitle>
              <Badge variant="muted">{emailTasks.length}</Badge>
            </CardHeader>
            <div className="space-y-2">
              {emailTasks.length > 0 ? (
                emailTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onComplete={handleComplete} />
                ))
              ) : (
                <div className="py-10 text-center">
                  <Mail className="h-8 w-8 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/25">Keine E-Mail-Aufgaben erkannt</p>
                  <p className="text-xs text-white/15 mt-1">
                    Verbinde deine Postfächer, um Aufgaben automatisch zu extrahieren
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Follow-ups */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Offene Follow-ups</CardTitle>
              <Badge variant={followUps.length > 0 ? "warning" : "muted"}>{followUps.length}</Badge>
            </CardHeader>
            <div className="space-y-3">
              {followUps.length > 0 ? (
                followUps.map((task) => (
                  <div key={task.id} className="rounded-lg border border-[#1e1e1e] p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-white/80 line-clamp-2">{task.title}</p>
                      <button
                        onClick={() => handleComplete(task.id)}
                        className="shrink-0 text-white/20 hover:text-green-400 transition-colors"
                      >
                        ✓
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {task.followUpContact && (
                        <span className="flex items-center gap-1 text-[10px] text-white/40">
                          <Mail className="h-3 w-3" />
                          {task.followUpContact}
                        </span>
                      )}
                      {task.followUpDate && (
                        <span className={`flex items-center gap-1 text-[10px] ${
                          new Date(task.followUpDate) < new Date() ? "text-red-400" : "text-white/30"
                        }`}>
                          <Clock className="h-3 w-3" />
                          {formatRelative(task.followUpDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/25">Keine offenen Follow-ups</p>
                </div>
              )}
            </div>
          </Card>

          {/* What Frank would detect */}
          <Card>
            <CardHeader>
              <CardTitle>Frank erkennt automatisch</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {[
                { label: "Unantwortete Mails > 48h", icon: Mail },
                { label: "Offene Angebotsanfragen", icon: AlertCircle },
                { label: "Zugesagte Rückmeldungen", icon: Clock },
                { label: "Kunden ohne Reaktion", icon: RefreshCw },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 text-xs text-white/40">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-white/20" />
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="ghost" size="sm" className="w-full">
                E-Mail verbinden
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
