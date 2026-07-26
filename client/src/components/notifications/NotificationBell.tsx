/**
 * NotificationBell.tsx
 * ─────────────────────
 * Bell icon with unread count badge + dropdown preview (latest 5).
 * Polls the server every 10 seconds for new notifications.
 */

import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

// Notification type → icon/color mapping
const typeConfig: Record<string, { color: string; dot: string }> = {
  registration_request:  { color: "text-amber-600",  dot: "bg-amber-400" },
  registration_approved: { color: "text-emerald-600", dot: "bg-emerald-400" },
  registration_rejected: { color: "text-red-600",     dot: "bg-red-400" },
  blind_phase_changed:   { color: "text-cyan-600",    dot: "bg-cyan-400" },
  blind_phase_approval:  { color: "text-blue-600",    dot: "bg-blue-400" },
  blind_assigned:        { color: "text-indigo-600",  dot: "bg-indigo-400" },
  project_created:       { color: "text-violet-600",  dot: "bg-violet-400" },
  project_status_changed:{ color: "text-orange-600",  dot: "bg-orange-400" },
  phase_owner_assigned:  { color: "text-teal-600",    dot: "bg-teal-400" },
  workflow_updated:      { color: "text-slate-600",   dot: "bg-slate-400" },
  system_announcement:   { color: "text-rose-600",    dot: "bg-rose-400" },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Poll unread count every 10 seconds
  const { data: countData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const unreadCount = countData?.count ?? 0;

  // Fetch latest 5 notifications when dropdown opens
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { limit: 5, unreadOnly: false },
    { enabled: open, refetchInterval: open ? 10_000 : false },
  );

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleNotificationClick = (id: number, linkUrl?: string | null, isRead?: boolean) => {
    if (!isRead) {
      markRead.mutate({ id });
    }
    setOpen(false);
    if (linkUrl) {
      setLocation(linkUrl);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700"
        aria-label="الإشعارات"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-bold text-slate-900">الإشعارات</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-600 hover:bg-cyan-50 transition"
                title="تعليم الكل كمقروء"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                قراءة الكل
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              </div>
            ) : !notifications?.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-400">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = typeConfig[n.type ?? ""] ?? { color: "text-slate-600", dot: "bg-slate-400" };
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id, n.linkUrl, n.isRead)}
                    className={`w-full text-right flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 border-b border-slate-50 last:border-0 ${!n.isRead ? "bg-cyan-50/50" : ""}`}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 flex-shrink-0">
                      <div className={`h-2 w-2 rounded-full ${!n.isRead ? cfg.dot : "bg-transparent"}`} />
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <p className={`text-sm font-semibold truncate ${!n.isRead ? "text-slate-900" : "text-slate-600"}`}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 text-right">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                    {n.linkUrl && (
                      <ExternalLink className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700 transition"
            >
              <Check className="h-4 w-4" />
              عرض جميع الإشعارات
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
