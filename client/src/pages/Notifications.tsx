/**
 * Notifications.tsx
 * ─────────────────
 * Full notifications page with filtering, mark-as-read, and pagination.
 */

import { useState } from "react";
import { Bell, CheckCheck, Trash2, Filter, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

const typeConfig: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  registration_request:   { label: "طلب تسجيل",        color: "text-amber-700",   dot: "bg-amber-400",   bg: "bg-amber-50" },
  registration_approved:  { label: "قبول تسجيل",        color: "text-emerald-700", dot: "bg-emerald-400", bg: "bg-emerald-50" },
  registration_rejected:  { label: "رفض تسجيل",         color: "text-red-700",     dot: "bg-red-400",     bg: "bg-red-50" },
  blind_phase_changed:    { label: "تغيير مرحلة",       color: "text-cyan-700",    dot: "bg-cyan-400",    bg: "bg-cyan-50" },
  blind_phase_approval:   { label: "موافقة إلكترونية",  color: "text-blue-700",    dot: "bg-blue-400",    bg: "bg-blue-50" },
  blind_assigned:         { label: "تعيين Blind",       color: "text-indigo-700",  dot: "bg-indigo-400",  bg: "bg-indigo-50" },
  project_created:        { label: "مشروع جديد",        color: "text-violet-700",  dot: "bg-violet-400",  bg: "bg-violet-50" },
  project_status_changed: { label: "حالة مشروع",        color: "text-orange-700",  dot: "bg-orange-400",  bg: "bg-orange-50" },
  phase_owner_assigned:   { label: "تعيين مالك مرحلة", color: "text-teal-700",    dot: "bg-teal-400",    bg: "bg-teal-50" },
  workflow_updated:       { label: "تحديث سير عمل",     color: "text-slate-700",   dot: "bg-slate-400",   bg: "bg-slate-50" },
  system_announcement:    { label: "إعلان النظام",      color: "text-rose-700",    dot: "bg-rose-400",    bg: "bg-rose-50" },
};

const FILTER_OPTIONS = [
  { value: "all",    label: "الكل" },
  { value: "unread", label: "غير مقروء" },
];

export default function Notifications() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: notifications, isLoading } = trpc.notifications.list.useQuery(
    { limit: 50, unreadOnly: filter === "unread" },
    { refetchInterval: 15_000 },
  );

  const { data: countData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const unreadCount = countData?.count ?? 0;

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
      toast.success("تم تعليم جميع الإشعارات كمقروءة");
    },
  });

  const deleteNotification = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
    onError: () => toast.error("فشل حذف الإشعار"),
  });

  const handleClick = (id: number, linkUrl?: string | null, isRead?: boolean) => {
    if (!isRead) markRead.mutate({ id });
    if (linkUrl) setLocation(linkUrl);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">الإشعارات</h1>
            <p className="text-sm text-slate-500">
              {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "جميع الإشعارات مقروءة"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            قراءة الكل
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        <Filter className="ml-2 h-4 w-4 text-slate-400" />
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value as "all" | "unread")}
            className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
              filter === opt.value
                ? "bg-slate-900 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        ) : !notifications?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
            <Bell className="h-12 w-12 opacity-20" />
            <p className="text-base font-medium">
              {filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const cfg = typeConfig[n.type ?? ""] ?? {
                label: n.type ?? "",
                color: "text-slate-700",
                dot: "bg-slate-400",
                bg: "bg-slate-50",
              };
              return (
                <li
                  key={n.id}
                  className={`group relative flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50 ${!n.isRead ? "bg-cyan-50/40" : ""}`}
                >
                  {/* Unread indicator */}
                  <div className="mt-2 flex-shrink-0">
                    <div className={`h-2.5 w-2.5 rounded-full ${!n.isRead ? cfg.dot : "bg-slate-200"}`} />
                  </div>

                  {/* Content */}
                  <button
                    className="min-w-0 flex-1 text-right"
                    onClick={() => handleClick(n.id, n.linkUrl, n.isRead)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 text-right">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {n.actorName && (
                            <span className="text-xs text-slate-400">{n.actorName}</span>
                          )}
                        </div>
                        <p className={`mt-1 text-sm font-semibold ${!n.isRead ? "text-slate-900" : "text-slate-700"}`}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 whitespace-pre-line line-clamp-3">
                          {n.body}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 justify-end">
                          <span className="text-[11px] text-slate-400">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ar })}
                          </span>
                          {n.linkUrl && (
                            <span className="flex items-center gap-1 text-[11px] text-cyan-500">
                              <ExternalLink className="h-3 w-3" />
                              عرض
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex flex-shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                    {!n.isRead && (
                      <button
                        onClick={() => markRead.mutate({ id: n.id })}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-100 hover:text-cyan-600 transition"
                        title="تعليم كمقروء"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification.mutate({ id: n.id })}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-100 hover:text-red-500 transition"
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
