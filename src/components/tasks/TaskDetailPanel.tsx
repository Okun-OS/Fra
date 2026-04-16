"use client";

import { useState, useEffect, useRef } from "react";
import { cn, formatDate, categoryLabel, priorityLabel, isOverdue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FrankAvatar } from "@/components/frank/FrankAvatar";
import {
  X, Send, Mail, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, User, Edit3, ArrowRight,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: number;
  category: string;
  source: string;
  dueDate?: string | Date | null;
  isFollowUp: boolean;
  followUpContact?: string | null;
  revenueImpact?: string | null;
  effort?: string | null;
  clientName?: string | null;
  emailThread?: {
    subject: string;
    fromEmail: string;
    fromName?: string | null;
    snippet?: string | null;
    messageCount: number;
    hasPendingReply: boolean;
  } | null;
};

type Message = {
  role: "frank" | "user";
  content: string;
};

type EmailDraft = {
  to: string;
  subject: string;
  body: string;
};

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onComplete: (id: string) => void;
}

export function TaskDetailPanel({ task, onClose, onComplete }: TaskDetailPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEmailTask = task.source === "email" && task.emailThread;

  // Auto-load Frank analysis on open
  useEffect(() => {
    askFrank();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askFrank = async (userMessage?: string) => {
    setSending(true);
    if (userMessage) {
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    }

    const newHistory = userMessage
      ? [...history, { role: "user", content: userMessage }]
      : history.length === 0
      ? [{ role: "user", content: "Analysiere diese Aufgabe und hilf mir sie zu lösen." }]
      : history;

    const res = await fetch(`/api/tasks/${task.id}/frank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage ?? "Analysiere diese Aufgabe und hilf mir sie zu lösen.",
        history: newHistory,
      }),
    });

    const data = await res.json();
    setSending(false);

    const frankMsg = { role: "frank" as const, content: data.reply };
    setMessages((prev) => [...prev, frankMsg]);

    const updatedHistory = [
      ...newHistory,
      { role: "assistant", content: data.reply },
    ];
    setHistory(updatedHistory);

    if (data.emailDraft) {
      setEmailDraft(data.emailDraft);
      setDraftBody(data.emailDraft.body);
    }

    setInput("");
  };

  const sendEmail = async () => {
    if (!emailDraft) return;
    setSendingEmail(true);
    await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot: "email_1",
        to: emailDraft.to,
        subject: emailDraft.subject,
        body: editingDraft ? draftBody : emailDraft.body,
        taskId: task.id,
      }),
    });
    setSendingEmail(false);
    setEmailSent(true);
    setTimeout(() => {
      onComplete(task.id);
      onClose();
    }, 1500);
  };

  const overdue = isOverdue(task.dueDate);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-2xl h-[90vh] flex flex-col",
          "rounded-2xl border border-[#222] bg-[#0a0a0a] shadow-2xl",
          "animate-slide-in"
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-[#1a1a1a] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={task.priority >= 80 ? "critical" : task.priority >= 65 ? "warning" : "muted"}>
                {priorityLabel(task.priority)}
              </Badge>
              <Badge variant="muted">{categoryLabel(task.category)}</Badge>
              {overdue && <Badge variant="critical">Überfällig</Badge>}
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">{task.title}</h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {task.dueDate && (
                <span className={cn("flex items-center gap-1 text-xs", overdue ? "text-red-400" : "text-white/40")}>
                  <Clock className="h-3 w-3" />
                  {formatDate(task.dueDate)}
                </span>
              )}
              {task.clientName && (
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <User className="h-3 w-3" />
                  {task.clientName}
                </span>
              )}
              {task.followUpContact && (
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <Mail className="h-3 w-3" />
                  {task.followUpContact}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { onComplete(task.id); onClose(); }}
              className="bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Erledigt
            </Button>
            <button onClick={onClose} className="text-white/30 hover:text-white/70">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Email thread preview */}
        {isEmailTask && (
          <div className="px-5 py-3 border-b border-[#1a1a1a] bg-[#0d0d0d] shrink-0">
            <div className="flex items-start gap-2">
              <Mail className="h-3.5 w-3.5 text-white/30 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/70 truncate">
                  {task.emailThread!.subject}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Von: {task.emailThread!.fromName ?? task.emailThread!.fromEmail} ·{" "}
                  {task.emailThread!.messageCount} Nachricht{task.emailThread!.messageCount > 1 ? "en" : ""}
                  {task.emailThread!.hasPendingReply && " · ⏳ Antwort ausstehend"}
                </p>
                {task.emailThread!.snippet && (
                  <p className="text-[10px] text-white/30 mt-1 line-clamp-2 italic">
                    „{task.emailThread!.snippet}"
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Frank Chat */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
              {msg.role === "frank" && <FrankAvatar size="sm" />}
              <div
                className={cn(
                  "max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "frank"
                    ? "bg-[#111] border border-[#1f1f1f] text-white/80 rounded-tl-sm"
                    : "bg-white/8 text-white rounded-tr-sm"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <FrankAvatar size="sm" animated />
              <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-white/30 animate-pulse"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Email Draft */}
          {emailDraft && !emailSent && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-blue-400 flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  E-Mail Entwurf
                </p>
                <button
                  onClick={() => setEditingDraft(!editingDraft)}
                  className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
                >
                  <Edit3 className="h-3 w-3" />
                  {editingDraft ? "Vorschau" : "Bearbeiten"}
                </button>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/30 w-12">An:</span>
                  <span className="text-white/70">{emailDraft.to}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-white/30 w-12">Betreff:</span>
                  <span className="text-white/70">{emailDraft.subject}</span>
                </div>
              </div>

              {editingDraft ? (
                <Textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="text-xs min-h-[120px] bg-[#0a0a0a]"
                  rows={6}
                />
              ) : (
                <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap bg-[#0d0d0d] rounded-lg p-3 max-h-32 overflow-y-auto">
                  {emailDraft.body}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => askFrank("Bitte überarbeite den E-Mail-Entwurf.")}
                  disabled={sending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Neu generieren
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={sendEmail}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {sendingEmail ? "Wird gesendet…" : "E-Mail absenden"}
                </Button>
              </div>
            </div>
          )}

          {emailSent && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/8 p-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-400 font-medium">E-Mail gesendet</p>
              <p className="text-xs text-white/40 mt-1">Aufgabe wird als erledigt markiert…</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions */}
        <div className="px-5 py-2 flex gap-2 flex-wrap border-t border-[#141414] shrink-0">
          {[
            "Kürzer formulieren",
            "Formeller",
            "Freundlicher",
            "Auf Englisch",
            "Nächste Schritte?",
          ].map((s) => (
            <button
              key={s}
              onClick={() => askFrank(s)}
              disabled={sending}
              className="text-[10px] text-white/30 hover:text-white/60 border border-white/8 hover:border-white/15 rounded-full px-2.5 py-1 transition-all"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-[#141414] shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && input.trim() && askFrank(input)}
              placeholder="Sag Frank was du brauchst…"
              disabled={sending}
              className="flex-1"
            />
            <Button
              variant="primary"
              onClick={() => input.trim() && askFrank(input)}
              disabled={sending || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
