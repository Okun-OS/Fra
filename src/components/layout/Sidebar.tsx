"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FrankAvatar } from "@/components/frank/FrankAvatar";
import {
  LayoutDashboard,
  CalendarDays,
  ListTodo,
  Inbox,
  Zap,
  MessageSquare,
  Settings,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/today", label: "Heute", icon: CalendarDays },
  { href: "/tasks", label: "Aufgaben", icon: ListTodo },
  { href: "/inbox", label: "E-Mail Tasks", icon: Inbox },
  { href: "/systems", label: "Systeme", icon: Zap },
  { href: "/frank", label: "Frank", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col border-r border-[#1a1a1a] bg-[#080808] z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[#141414]">
        <FrankAvatar size="sm" animated />
        <div>
          <p className="text-sm font-semibold text-white tracking-tight">Frank</p>
          <p className="text-[10px] text-white/30 leading-none mt-0.5">Executive Assistant</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                active
                  ? "bg-white/8 text-white font-medium"
                  : "text-white/40 hover:text-white/70 hover:bg-white/4"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-white" : "text-white/30")} />
              {label}
              {href === "/frank" && active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[#141414]">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/30 hover:text-white/60 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Einstellungen
        </Link>
        <div className="mt-3 px-3">
          <p className="text-[10px] text-white/15 leading-relaxed">
            Frank v0.1 · Management OS
          </p>
        </div>
      </div>
    </aside>
  );
}
