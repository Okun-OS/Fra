"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { FrankAvatar } from "@/components/frank/FrankAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Send, Sparkles, AlertTriangle, Clock, Mail, TrendingUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Message = {
  role: "frank" | "user";
  content: string;
  timestamp: Date;
};

type Task = Parameters<typeof TaskCard>[0]["task"];

const QUICK_PROMPTS = [
  "Was soll ich jetzt tun?",
  "Zeig mir alle überfälligen Aufgaben",
  "Welche Follow-ups sind offen?",
  "Gib mir einen Status-Überblick",
  "Was hat heute höchste Priorität?",
];

export default function FrankPage() {
  const { data: brief } = useSWR("/api/frank", fetcher);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (brief?.briefing && messages.length === 0) {
      setMessages([
        {
          role: "frank",
          content: brief.briefing,
          timestamp: new Date(),
        },
      ]);
    }
  }, [brief]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim() || sending) return;

    const userMsg: Message = { role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const res = await fetch("/api/frank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    setSending(false);
    setMessages((prev) => [
      ...prev,
      { role: "frank", content: data.reply, timestamp: new Date() },
    ]);
  };

  const today = format(new Date(), "EEEE, dd. MMMM", { locale: de });

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] px-8 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <FrankAvatar size="lg" animated />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-white tracking-tight">Frank</h1>
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Online
              </span>
            </div>
            <p className="text-xs text-white/35 mt-0.5">Dein Executive Assistant · {today}</p>
          </div>
        </div>

        {/* Live stats */}
        {brief?.stats && (
          <div className="flex items-center gap-6">
            {[
              { label: "Offen", value: brief.stats.open, icon: Clock },
              { label: "Kritisch", value: brief.stats.critical, icon: AlertTriangle, red: true },
              { label: "Überfällig", value: brief.stats.overdue, icon: AlertTriangle, amber: true },
              { label: "Follow-ups", value: brief.stats.followUps, icon: Mail },
            ].map(({ label, value, icon: Icon, red, amber }) => (
              <div key={label} className="text-center">
                <p className={cn("text-lg font-semibold", red ? "text-red-400" : amber ? "text-amber-400" : "text-white")}>
                  {value}
                </p>
                <p className="text-[10px] text-white/30">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3 animate-slide-in",
                  msg.role === "user" && "flex-row-reverse"
                )}
              >
                {msg.role === "frank" && <FrankAvatar size="sm" />}

                <div
                  className={cn(
                    "max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "frank"
                      ? "bg-[#111] border border-[#1f1f1f] text-white/80 rounded-tl-sm"
                      : "bg-white/8 text-white rounded-tr-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="mt-1.5 text-[10px] text-white/25">
                    {format(msg.timestamp, "HH:mm")}
                  </p>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-3 animate-fade-in">
                <FrankAvatar size="sm" animated />
                <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-white/30"
                        style={{ animation: `pulse 1.2s ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-8 py-2 flex gap-2 flex-wrap border-t border-[#141414]">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => send(prompt)}
                disabled={sending}
                className="text-xs text-white/35 hover:text-white/70 border border-white/8 hover:border-white/15 rounded-full px-3 py-1.5 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-8 py-4 border-t border-[#141414]">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Frag Frank…"
                disabled={sending}
                className="flex-1"
              />
              <Button variant="primary" onClick={() => send()} disabled={sending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-80 shrink-0 border-l border-[#1a1a1a] overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Recommendations */}
            {brief?.recommendations?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Empfehlungen</CardTitle>
                  <Sparkles className="h-3.5 w-3.5 text-white/30" />
                </CardHeader>
                <div className="space-y-3">
                  {brief.recommendations.map((rec: string, i: number) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="text-white/20 text-xs font-mono shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-xs text-white/55 leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Top task */}
            {brief?.topTask && (
              <Card>
                <CardHeader>
                  <CardTitle>Fokus jetzt</CardTitle>
                </CardHeader>
                <TaskCard task={brief.topTask} compact />
              </Card>
            )}

            {/* Capabilities */}
            <Card>
              <CardHeader>
                <CardTitle>Frank kann</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {[
                  "Prioritäten setzen",
                  "Follow-ups erkennen",
                  "Tagesplan vorschlagen",
                  "Zusammenfassungen erstellen",
                  "Nächste Schritte formulieren",
                  "Überfällige Tasks markieren",
                  "Umsatzrelevanz einschätzen",
                ].map((cap) => (
                  <div key={cap} className="flex items-center gap-2 text-xs text-white/40">
                    <ChevronRight className="h-3 w-3 text-white/15" />
                    {cap}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
