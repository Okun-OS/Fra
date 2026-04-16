"use client";

import { useState } from "react";
import { cn, formatDate, isOverdue, categoryLabel, sourceLabel, priorityLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Mail, AlertTriangle, RefreshCw, Building2 } from "lucide-react";

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
};

interface TaskCardProps {
  task: Task;
  onComplete?: (id: string) => void;
  onClick?: (task: Task) => void;
  compact?: boolean;
}

function categoryVariant(cat: string): "delivery" | "sales" | "info" | "muted" | "warning" {
  const map: Record<string, "delivery" | "sales" | "info" | "muted" | "warning"> = {
    delivery: "delivery",
    sales: "sales",
    system: "info",
    admin: "muted",
    vision: "muted",
  };
  return map[cat] ?? "muted";
}

function priorityBadge(score: number): "critical" | "warning" | "info" | "muted" {
  if (score >= 80) return "critical";
  if (score >= 65) return "warning";
  if (score >= 45) return "info";
  return "muted";
}

function SourceIcon({ source }: { source: string }) {
  if (source === "email") return <Mail className="h-3 w-3 text-white/30" />;
  if (source === "okunos") return <Building2 className="h-3 w-3 text-white/30" />;
  if (source === "portal") return <RefreshCw className="h-3 w-3 text-white/30" />;
  return null;
}

export function TaskCard({ task, onComplete, onClick, compact = false }: TaskCardProps) {
  const [completing, setCompleting] = useState(false);
  const overdue = isOverdue(task.dueDate);

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onComplete) return;
    setCompleting(true);
    setTimeout(() => onComplete(task.id), 300);
  };

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        "group relative rounded-xl border border-[#1e1e1e] bg-[#0f0f0f] transition-all duration-200",
        "hover:border-white/10 hover:bg-[#131313]",
        onClick && "cursor-pointer",
        completing && "opacity-0 scale-98 transition-all duration-300",
        overdue && "border-red-500/20",
        compact ? "px-4 py-3" : "p-4"
      )}
    >
      {/* Priority bar */}
      <div
        className={cn(
          "absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full",
          task.priority >= 80 ? "bg-red-500" :
          task.priority >= 65 ? "bg-amber-500" :
          task.priority >= 45 ? "bg-blue-500" : "bg-white/10"
        )}
      />

      <div className="pl-3">
        <div className="flex items-start gap-3">
          {/* Complete button */}
          {onComplete && (
            <button
              onClick={handleComplete}
              className="mt-0.5 shrink-0 text-white/20 hover:text-green-400 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium leading-snug text-white/90",
              compact ? "truncate" : "line-clamp-2"
            )}>
              {task.title}
            </p>

            {!compact && task.description && (
              <p className="mt-1 text-xs text-white/40 line-clamp-2">{task.description}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={categoryVariant(task.category)}>{categoryLabel(task.category)}</Badge>

              {task.priority >= 65 && (
                <Badge variant={priorityBadge(task.priority)}>{priorityLabel(task.priority)}</Badge>
              )}

              {task.isFollowUp && (
                <Badge variant="warning">Follow-up</Badge>
              )}

              {task.revenueImpact === "high" && (
                <Badge variant="success">High Revenue</Badge>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <SourceIcon source={task.source} />
                {task.dueDate && (
                  <span className={cn(
                    "flex items-center gap-1 text-[10px]",
                    overdue ? "text-red-400" : "text-white/30"
                  )}>
                    {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
                    {!overdue && <Clock className="h-2.5 w-2.5" />}
                    {formatDate(task.dueDate)}
                  </span>
                )}
                {task.clientName && (
                  <span className="text-[10px] text-white/25 truncate max-w-[100px]">{task.clientName}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
