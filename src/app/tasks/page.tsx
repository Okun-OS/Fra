"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { Plus, X, SlidersHorizontal } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Task = Parameters<typeof TaskCard>[0]["task"];

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "admin",
    dueDate: "",
    revenueImpact: "none",
    effort: "medium",
    clientName: "",
    isFollowUp: false,
    followUpDate: "",
    followUpContact: "",
    isToday: false,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#222] bg-[#0f0f0f] p-6 shadow-2xl animate-slide-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-white">Neue Aufgabe</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Titel *</label>
            <Input
              placeholder="Aufgabe beschreiben…"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Beschreibung</label>
            <Textarea
              placeholder="Details, Kontext, nächste Schritte…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Kategorie</label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="delivery">Delivery</option>
                <option value="sales">Sales</option>
                <option value="system">System</option>
                <option value="admin">Admin</option>
                <option value="vision">Vision</option>
              </Select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Aufwand</label>
              <Select value={form.effort} onChange={(e) => setForm({ ...form, effort: e.target.value })}>
                <option value="quick">Quick ({"<"}30min)</option>
                <option value="medium">Medium (1-3h)</option>
                <option value="heavy">Groß (3h+)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Umsatzrelevanz</label>
              <Select value={form.revenueImpact} onChange={(e) => setForm({ ...form, revenueImpact: e.target.value })}>
                <option value="high">Hoch</option>
                <option value="medium">Mittel</option>
                <option value="low">Niedrig</option>
                <option value="none">Keine</option>
              </Select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Deadline</label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Kund:in / Unternehmen</label>
            <Input
              placeholder="z.B. Meier GmbH"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-white w-3.5 h-3.5"
                checked={form.isToday}
                onChange={(e) => setForm({ ...form, isToday: e.target.checked })}
              />
              <span className="text-xs text-white/50">Heute einplanen</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-white w-3.5 h-3.5"
                checked={form.isFollowUp}
                onChange={(e) => setForm({ ...form, isFollowUp: e.target.checked })}
              />
              <span className="text-xs text-white/50">Follow-up</span>
            </label>
          </div>

          {form.isFollowUp && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Follow-up Datum</label>
                <Input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Kontakt</label>
                <Input
                  placeholder="email@beispiel.de"
                  value={form.followUpContact}
                  onChange={(e) => setForm({ ...form, followUpContact: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save} disabled={saving || !form.title.trim()}>
            {saving ? "Speichern…" : "Aufgabe anlegen"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [filters, setFilters] = useState({ status: "open", source: "all", category: "all", q: "" });
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  ).toString();

  const { data: tasks, mutate } = useSWR<Task[]>(`/api/tasks?${query}`, fetcher);

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
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Aufgaben</h1>
          <p className="text-sm text-white/40 mt-1">{tasks?.length ?? 0} Aufgaben</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Neue Aufgabe
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 text-white/30 shrink-0" />
          <Input
            placeholder="Suchen…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="w-48"
          />
          <Select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-36"
          >
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="done">Erledigt</option>
          </Select>
          <Select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="w-36"
          >
            <option value="all">Alle Bereiche</option>
            <option value="delivery">Delivery</option>
            <option value="sales">Sales</option>
            <option value="system">System</option>
            <option value="admin">Admin</option>
            <option value="vision">Vision</option>
          </Select>
          <Select
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            className="w-36"
          >
            <option value="all">Alle Quellen</option>
            <option value="manual">Manuell</option>
            <option value="email">E-Mail</option>
            <option value="okunos">OkunOS</option>
            <option value="portal">Portal</option>
          </Select>
        </div>
      </Card>

      {/* Task list */}
      <div className="space-y-2">
        {tasks === undefined && (
          <p className="text-sm text-white/30 text-center py-12">Lädt…</p>
        )}
        {tasks?.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/8 py-16 text-center">
            <p className="text-sm text-white/25">Keine Aufgaben gefunden</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              Erste Aufgabe anlegen
            </Button>
          </div>
        )}
        {tasks?.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={handleComplete}
            onClick={(t) => setSelectedTask(t as Task)}
          />
        ))}
      </div>

      {creating && (
        <CreateTaskModal onClose={() => setCreating(false)} onCreated={() => mutate()} />
      )}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={(id) => { handleComplete(id); setSelectedTask(null); }}
        />
      )}
    </div>
  );
}
