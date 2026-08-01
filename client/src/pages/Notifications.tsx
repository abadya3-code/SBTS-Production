import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Filter,
  FolderKanban,
  Inbox,
  Info,
  ShieldAlert,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

const typeConfig = {
  registration_request: "Registration request",
  registration_approved: "Registration approved",
  registration_rejected: "Registration rejected",
  blind_phase_changed: "Blind phase changed",
  blind_phase_approval: "Phase approval required",
  blind_assigned: "Blind assigned",
  project_created: "Project created",
  project_status_changed: "Project status changed",
  phase_owner_assigned: "Phase owner assigned",
  workflow_updated: "Workflow updated",
  workflow_transition: "Workflow transition",
  workflow_gate_blocked: "Workflow gate blocked",
  workflow_approval_required: "Workflow approval required",
  safety_hold_placed: "Safety hold placed",
  safety_hold_released: "Safety hold released",
  qr_token_issued: "QR token issued",
  qr_token_rotated: "QR token rotated",
  qr_token_revoked: "QR token revoked",
  certificate_issued: "Certificate issued",
  certificate_revoked: "Certificate revoked",
  tag_printed: "Blind tag printed",
  system_announcement: "System notice",
} as const;

type NotificationType = keyof typeof typeConfig;
type TypeFilter = NotificationType | "all";
type NotificationPriority = "info" | "action" | "warning" | "critical";
type PriorityFilter = NotificationPriority | "all";
type InboxTab = "active" | "unread" | "archived";

const priorityConfig: Record<
  NotificationPriority,
  { label: string; badge: string; rail: string; icon: typeof Info }
> = {
  info: {
    label: "Info",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    rail: "bg-blue-500",
    icon: Info,
  },
  action: {
    label: "Action",
    badge: "border-violet-200 bg-violet-50 text-violet-700",
    rail: "bg-violet-500",
    icon: ClipboardCheck,
  },
  warning: {
    label: "Warning",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    rail: "bg-amber-500",
    icon: TriangleAlert,
  },
  critical: {
    label: "Critical",
    badge: "border-red-200 bg-red-50 text-red-700",
    rail: "bg-red-500",
    icon: ShieldAlert,
  },
};

const tabs: Array<{ value: InboxTab; label: string; icon: typeof Inbox }> = [
  { value: "active", label: "Active", icon: Inbox },
  { value: "unread", label: "Unread", icon: Bell },
  { value: "archived", label: "Archived", icon: Archive },
];

function normalizePriority(
  value: string | null | undefined
): NotificationPriority {
  return value && value in priorityConfig
    ? (value as NotificationPriority)
    : "info";
}

function getTypeLabel(value: string | null | undefined) {
  if (!value) return "Operational update";
  return typeConfig[value as NotificationType] ?? value.replaceAll("_", " ");
}

function getSmartLink(notification: {
  linkUrl?: string | null;
  projectId?: string | null;
  blindTag?: string | null;
}) {
  if (notification.linkUrl) return notification.linkUrl;
  if (notification.projectId && notification.blindTag) {
    return `/projects/${encodeURIComponent(notification.projectId)}/blinds/${encodeURIComponent(notification.blindTag)}`;
  }
  if (notification.projectId) {
    return `/projects/${encodeURIComponent(notification.projectId)}`;
  }
  return null;
}

export default function Notifications() {
  const [tab, setTab] = useState<InboxTab>("active");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const listInput = {
    scope: tab === "archived" ? ("archived" as const) : ("active" as const),
    unreadOnly: tab === "unread",
    type: typeFilter === "all" ? undefined : typeFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    limit: 100,
  };

  const {
    data: notifications,
    isLoading,
    isError,
  } = trpc.notifications.list.useQuery(listInput, {
    refetchInterval: 15_000,
  });
  const { data: countData } = trpc.notifications.unreadCount.useQuery(
    undefined,
    { refetchInterval: 10_000 }
  );
  const unreadCount = countData?.count ?? 0;

  const selectedNotification = useMemo(
    () =>
      notifications?.find(notification => notification.id === selectedId) ??
      notifications?.[0] ??
      null,
    [notifications, selectedId]
  );

  const invalidateInbox = () => {
    utils.notifications.list.invalidate();
    utils.notifications.unreadCount.invalidate();
  };

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: invalidateInbox,
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: invalidateInbox,
  });
  const archiveNotification = trpc.notifications.archive.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      invalidateInbox();
    },
  });
  const restoreNotification = trpc.notifications.restore.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      invalidateInbox();
    },
  });
  const deleteNotification = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      setSelectedId(null);
      invalidateInbox();
    },
  });

  const selectNotification = (id: number, isRead: boolean) => {
    setSelectedId(id);
    if (!isRead) markRead.mutate({ id });
  };

  const handleDelete = (id: number) => {
    if (
      window.confirm(
        "Delete this inbox record permanently? This action cannot be undone."
      )
    ) {
      deleteNotification.mutate({ id });
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5" dir="ltr">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
              <Inbox className="h-4 w-4" />
              Operations inbox
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Action Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Review workflow decisions, safety controls, certificates, QR
              governance, and assigned operational work from one controlled
              inbox.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Unread work
              </p>
              <p className="mt-1 text-2xl font-black">{unreadCount}</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                Mark active as read
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 xl:w-auto">
            {tabs.map(item => {
              const Icon = item.icon;
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setTab(item.value);
                    setSelectedId(null);
                  }}
                  className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.value === "unread" && unreadCount > 0 && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="hidden items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 sm:flex">
              <Filter className="h-4 w-4" /> Filters
            </span>
            <Select
              value={typeFilter}
              onValueChange={value => setTypeFilter(value as TypeFilter)}
            >
              <SelectTrigger className="h-10 w-full rounded-xl sm:w-56">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(typeConfig).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={value =>
                setPriorityFilter(value as PriorityFilter)
              }
            >
              <SelectTrigger className="h-10 w-full rounded-xl sm:w-44">
                <SelectValue placeholder="All priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {Object.entries(priorityConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.25fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-extrabold text-slate-950">
                {tab === "archived" ? "Archived records" : "Current work"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {notifications?.length ?? 0} records in this view
              </p>
            </div>
          </div>

          <div className="max-h-[680px] overflow-y-auto">
            {isLoading ? (
              <div className="flex min-h-72 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              </div>
            ) : isError ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-8 text-center">
                <TriangleAlert className="h-9 w-9 text-red-500" />
                <p className="font-bold text-slate-900">
                  Inbox data unavailable
                </p>
                <p className="text-sm text-slate-500">
                  Review the server request ID, then retry this operational
                  view.
                </p>
              </div>
            ) : !notifications?.length ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-8 text-center text-slate-400">
                {tab === "archived" ? (
                  <Archive className="h-10 w-10 opacity-40" />
                ) : (
                  <Inbox className="h-10 w-10 opacity-40" />
                )}
                <div>
                  <p className="font-bold text-slate-700">
                    No records match this view
                  </p>
                  <p className="mt-1 text-sm">
                    Adjust the type or priority filter to expand the result.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map(notification => {
                  const priority = normalizePriority(notification.priority);
                  const config = priorityConfig[priority];
                  const PriorityIcon = config.icon;
                  const selected = selectedNotification?.id === notification.id;
                  return (
                    <li key={notification.id} className="relative">
                      <div
                        className={`absolute inset-y-0 left-0 w-1 ${config.rail}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          selectNotification(
                            notification.id,
                            notification.isRead
                          )
                        }
                        className={`w-full px-5 py-4 text-left transition ${
                          selected
                            ? "bg-cyan-50/80"
                            : !notification.isRead
                              ? "bg-slate-50 hover:bg-cyan-50/40"
                              : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 rounded-xl border p-2 ${config.badge}`}
                          >
                            <PriorityIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${config.badge}`}
                              >
                                {config.label}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {getTypeLabel(notification.type)}
                              </span>
                              {!notification.isRead && (
                                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                              )}
                            </div>
                            <p
                              className={`mt-2 truncate text-sm ${
                                notification.isRead
                                  ? "font-semibold text-slate-700"
                                  : "font-extrabold text-slate-950"
                              }`}
                            >
                              {notification.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {notification.body}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {formatDistanceToNow(
                                  new Date(notification.createdAt),
                                  { addSuffix: true }
                                )}
                              </span>
                              {notification.projectId && (
                                <span>{notification.projectId}</span>
                              )}
                              {notification.blindTag && (
                                <span>{notification.blindTag}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="min-h-[520px] rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-5 lg:self-start">
          {!selectedNotification ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                <Inbox className="h-8 w-8" />
              </div>
              <div>
                <p className="font-extrabold text-slate-900">
                  Select an inbox record
                </p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  Open a record to review its operational context and available
                  actions.
                </p>
              </div>
            </div>
          ) : (
            <NotificationDetail
              notification={selectedNotification}
              onNavigate={setLocation}
              onMarkRead={id => markRead.mutate({ id })}
              onArchive={id => archiveNotification.mutate({ id })}
              onRestore={id => restoreNotification.mutate({ id })}
              onDelete={handleDelete}
              pending={
                markRead.isPending ||
                archiveNotification.isPending ||
                restoreNotification.isPending ||
                deleteNotification.isPending
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function NotificationDetail({
  notification,
  onNavigate,
  onMarkRead,
  onArchive,
  onRestore,
  onDelete,
  pending,
}: {
  notification: {
    id: number;
    type: string;
    priority: string;
    title: string;
    body: string;
    linkUrl: string | null;
    projectId: string | null;
    blindTag: string | null;
    actorName: string | null;
    isRead: boolean;
    readAt: Date | null;
    isArchived: boolean;
    archivedAt: Date | null;
    createdAt: Date;
  };
  onNavigate: (href: string) => void;
  onMarkRead: (id: number) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  pending: boolean;
}) {
  const priority = normalizePriority(notification.priority);
  const config = priorityConfig[priority];
  const PriorityIcon = config.icon;
  const smartLink = getSmartLink(notification);

  return (
    <div>
      <div className="border-b border-slate-100 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${config.badge}`}
          >
            <PriorityIcon className="h-3.5 w-3.5" />
            {config.label}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {getTypeLabel(notification.type)}
          </span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            {notification.isRead ? "Read" : "Unread"}
          </span>
        </div>
        <h2 className="mt-4 text-xl font-black leading-tight text-slate-950 sm:text-2xl">
          {notification.title}
        </h2>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
          {notification.body}
        </p>
      </div>

      <div className="grid gap-3 border-b border-slate-100 p-6 sm:grid-cols-2">
        <ContextCard
          icon={FolderKanban}
          label="Project"
          value={notification.projectId ?? "Not linked"}
        />
        <ContextCard
          icon={Tag}
          label="Blind"
          value={notification.blindTag ?? "Not linked"}
        />
      </div>

      <dl className="grid gap-4 border-b border-slate-100 p-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Created
          </dt>
          <dd className="mt-1 font-semibold text-slate-700">
            {format(new Date(notification.createdAt), "dd MMM yyyy, HH:mm")}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Initiated by
          </dt>
          <dd className="mt-1 font-semibold text-slate-700">
            {notification.actorName ?? "Controlled system event"}
          </dd>
        </div>
        {notification.archivedAt && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Archived
            </dt>
            <dd className="mt-1 font-semibold text-slate-700">
              {format(new Date(notification.archivedAt), "dd MMM yyyy, HH:mm")}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-2 p-6">
        {smartLink && (
          <button
            type="button"
            onClick={() => onNavigate(smartLink)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            Open linked record
          </button>
        )}
        {!notification.isRead && (
          <button
            type="button"
            onClick={() => onMarkRead(notification.id)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" /> Mark read
          </button>
        )}
        {notification.isArchived ? (
          <button
            type="button"
            onClick={() => onRestore(notification.id)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-50"
          >
            <ArchiveRestore className="h-4 w-4" /> Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onArchive(notification.id)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Archive className="h-4 w-4" /> Archive
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(notification.id)}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </div>
  );
}

function ContextCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-2 truncate text-sm font-extrabold text-slate-900">
        {value}
      </p>
    </div>
  );
}
