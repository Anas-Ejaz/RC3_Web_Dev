"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { useNotifications } from "@/hooks/use-interviews";
import { timeAgo } from "@/lib/utils";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifications = useNotifications();
  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative rounded-full p-2 text-forest-950 hover:bg-cream-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-forest-950 px-1 text-[10px] font-semibold text-cream-50">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-forest-900/10 bg-white p-2 shadow-card">
          <p className="px-3 py-2 text-sm font-semibold text-forest-950">Notifications</p>
          {notifications.isError ? (
            <p className="px-3 py-4 text-sm text-forest-900/70">Couldn&apos;t load notifications.</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-forest-900/70">Nothing new.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="rounded-xl px-3 py-2 hover:bg-cream-100">
                  <p className="text-sm text-forest-950">{n.message}</p>
                  <p className="text-xs text-forest-900/60">{timeAgo(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}