/**
 * NotificationBell.tsx
 * ─────────────────────
 * Bell icon with unread count badge + active inbox preview.
 * Polls the server every 10 seconds for new notifications.
 */

import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";

const typeConfig: Record<string, { label: string; dot: string }> = {
  registration_request: { label: "Registration request", dot: "bg-amber-500" },
  registration_approved: {
    label: "Registration approved",
    dot: "bg-emerald-500",
  },
  registration_rejected: { label: "Registration rejected", dot: "bg-red-500" },
  blind_phase_changed: { label: "Blind phase changed", dot: "bg-cyan-500" },
  blind_phase_approval: { label: "Phase approval", dot: "bg-violet-500" },
  blind_assigned: { label: "Blind assigned", dot: "bg-indigo-500" },
  project_created: { label: "Project created", dot: "bg-blue-500" },
  project_status_changed: { label: "Project status", dot: "bg-orange-500" },
  phase_owner_assigned: { label: "Phase owner assigned", dot: "bg-teal-500" },
  workflow_updated: { label: "Workflow updated", dot: "bg-slate-500" },
  workflow_transition: { label: "Workflow transition", dot: "bg-cyan-500" },
  workflow_gate_blocked: {
    label: "Workflow gate blocked",
    dot: "bg-amber-500",
  },
  workflow_approval_required: {
    label: "Workflow approval",
    dot: "bg-violet-500",
  },
  safety_hold_placed: { label: "Safety hold placed", dot: "bg-red-600" },
  safety_hold_released: {
    label: "Safety hold released",
    dot: "bg-emerald-500",
  },
  qr_token_issued: { label: "QR token issued", dot: "bg-blue-500" },
  qr_token_rotated: { label: "QR token rotated", dot: "bg-cyan-500" },
  qr_token_revoked: { label: "QR token revoked", dot: "bg-amber-500" },
  certificate_issued: { label: "Certificate issued", dot: "bg-emerald-500" },
  certificate_revoked: { label: "Certificate revoked", dot: "bg-red-600" },
  tag_printed: { label: "Blind tag printed", dot: "bg-blue-500" },
  system_announcement: { label: "System notice", dot: "bg-slate-500" },
};

const priorityConfig: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  action: "border-violet-200 bg-violet-50 text-violet-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-red-200 bg-red-50 text-red-700",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Poll unread count every 10 seconds
  const { data: countData } = trpc.notifications.unreadCount.useQuery(
    undefined,
    {
      refetchInterval: 10_000,
    }
  );
  const unreadCount = countData?.count ?? 0;

  // Fetch only the latest active work items when the dropdown opens.
  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { scope: "active", limit: 6, unreadOnly: false },
    { enabled: open, refetchInterval: open ? 10_000 : false }
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleNotificationClick = (
    id: number,
    linkUrl?: string | null,
    isRead?: boolean
  ) => {
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
        onClick={() => setOpen(v => !v)}
        className="relative rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700"
        aria-label="Notifications"
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
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-bold text-slate-900">
                Action Center
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-600 hover:bg-cyan-50 transition"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
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
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = typeConfig[n.type ?? ""] ?? {
                  label: n.type?.replaceAll("_", " ") ?? "Operational update",
                  dot: "bg-slate-400",
                };
                const priority = n.priority ?? "info";
                const priorityClass =
                  priorityConfig[priority] ?? priorityConfig.info;
                return (
                  <button
                    key={n.id}
                    onClick={() =>
                      handleNotificationClick(n.id, n.linkUrl, n.isRead)
                    }
                    className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 ${!n.isRead ? "bg-cyan-50/50" : ""}`}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 flex-shrink-0">
                      <div
                        className={`h-2 w-2 rounded-full ${!n.isRead ? cfg.dot : "bg-transparent"}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p
                        className={`text-sm font-semibold truncate ${!n.isRead ? "text-slate-900" : "text-slate-600"}`}
                      >
                        {n.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {cfg.label}
                        </span>
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${priorityClass}`}
                        >
                          {priority}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-left text-xs text-slate-500">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
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
              Open Action Center
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
