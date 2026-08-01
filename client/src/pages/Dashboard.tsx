/* Canonical production dashboard. All operational numbers come from MySQL. */
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DatabaseZap,
  FileWarning,
  FolderKanban,
  MapPinned,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

function formatActivityTime(value: Date | string) {
  return new Date(value).toLocaleString("en-SA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: generalSettings } = trpc.settings.general.get.useQuery();
  const snapshot = trpc.reports.dashboardSnapshot.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const heroTitle =
    generalSettings?.dashboardHeroTitle || "SBTS operational command center";
  const heroDescription =
    generalSettings?.dashboardHeroDescription ||
    "Canonical eight-phase workflow status, risks, and field activity from the production database.";
  const heroBadge =
    generalSettings?.dashboardHeroBadge || "Canonical runtime · live data";
  const data = snapshot.data;
  const phaseLabelByKey = new Map<string, string>(
    data?.phases.map(phase => [phase.key, phase.shortLabel]) ?? []
  );

  if (snapshot.isLoading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="text-center">
          <DatabaseZap className="mx-auto h-10 w-10 animate-pulse text-primary" />
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            Loading canonical runtime data…
          </p>
        </div>
      </div>
    );
  }

  if (snapshot.error || !data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto h-9 w-9 text-destructive" />
        <h2 className="mt-3 text-lg font-extrabold text-foreground">
          Dashboard data is unavailable
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {snapshot.error?.message ||
            "The canonical workflow snapshot could not be loaded."}
        </p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Areas",
      value: data.totalAreas,
      icon: MapPinned,
      tone: "text-sky-300",
    },
    {
      label: "Projects",
      value: data.totalProjects,
      icon: FolderKanban,
      tone: "text-violet-300",
    },
    {
      label: "Tracked blinds",
      value: data.totalBlinds,
      icon: FileWarning,
      tone: "text-cyan-200",
    },
    {
      label: "Checklist complete",
      value: data.checklistReadyBlinds,
      icon: ClipboardList,
      tone: "text-teal-200",
    },
    {
      label: "Closed",
      value: data.completedBlinds,
      icon: CheckCircle2,
      tone: "text-emerald-300",
    },
    {
      label: "Completion",
      value: `${data.completionRate}%`,
      icon: TrendingUp,
      tone: "text-amber-200",
    },
    {
      label: "Active roles",
      value: data.activeRoles,
      icon: Users,
      tone: "text-fuchsia-200",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 text-white shadow-[0_26px_90px_rgba(15,39,56,0.28)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_42%)]" />
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">
            <ShieldCheck className="h-4 w-4" /> {heroBadge}
          </div>
          <h2 className="max-w-4xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {heroTitle}
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
            {heroDescription}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/areas"
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200"
            >
              Open area command map <ArrowRight className="h-4 w-4" />
            </Link>
            {user?.role === "admin" && (
              <Link
                href="/access-control"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Review access control
              </Link>
            )}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      {item.label}
                    </span>
                    <Icon className={`h-4 w-4 ${item.tone}`} />
                  </div>
                  <div className="mt-3 text-2xl font-extrabold tracking-tight">
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {(data.uninitializedBlinds > 0 || data.safetyHoldBlinds > 0) && (
        <section className="grid gap-3 md:grid-cols-2">
          {data.uninitializedBlinds > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-center gap-2 font-extrabold">
                <AlertTriangle className="h-4 w-4" />
                Runtime backfill required
              </div>
              <p className="mt-1 text-sm">
                {data.uninitializedBlinds} blind records do not yet have
                canonical workflow runtime rows.
              </p>
            </div>
          )}
          {data.safetyHoldBlinds > 0 && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-950">
              <div className="flex items-center gap-2 font-extrabold">
                <ShieldCheck className="h-4 w-4" />
                Active safety holds
              </div>
              <p className="mt-1 text-sm">
                {data.safetyHoldBlinds} blind records are stopped by an active
                safety hold.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="sbts-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-foreground">
                Canonical workflow phases
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Eight-phase runtime; only lifecycle CLOSED counts as complete.
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              Live · MySQL
            </span>
          </div>
          <div className="space-y-3">
            {data.phases.map(phase => (
              <div
                key={phase.key}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="status-dot"
                      style={{ backgroundColor: phase.color }}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-extrabold text-foreground">
                        {phase.label}
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        Owner role: {phase.ownerRoleKey}
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-foreground">
                    {phase.count}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${data.totalBlinds ? Math.max(2, (phase.count / data.totalBlinds) * 100) : 0}%`,
                      backgroundColor: phase.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sbts-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-foreground">
                Recent successful transitions
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Newest canonical workflow events first.
              </p>
            </div>
            <Clock3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {data.recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No canonical transition events yet.
              </div>
            ) : (
              data.recentActivity.map((event, index) => (
                <div
                  key={`${event.blindTag}-${event.date}-${index}`}
                  className="flex gap-3 rounded-2xl bg-muted/50 p-3"
                >
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-foreground">
                      {event.blindTag} ·{" "}
                      {phaseLabelByKey.get(String(event.toPhaseKey)) ||
                        event.action}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {event.actor} · {event.status}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-muted-foreground">
                      {formatActivityTime(event.date)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="sbts-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-foreground">
              Current operational focus
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Critical priority first, then most recently updated records.
            </p>
          </div>
          <Link href="/blinds" className="text-sm font-bold text-primary">
            Open registry →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Tag</th>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Canonical phase</th>
                <th className="px-5 py-3">Checklist</th>
                <th className="px-5 py-3">Lifecycle</th>
                <th className="px-5 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topBlinds.map(blind => (
                <tr
                  key={blind.tag}
                  className="bg-card transition hover:bg-muted/30"
                >
                  <td className="px-5 py-4 font-extrabold text-foreground">
                    <Link
                      href={`/areas/${blind.areaId}/projects/${blind.projectId}/blinds/${encodeURIComponent(blind.tag)}`}
                      className="hover:text-primary"
                    >
                      {blind.tag}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {blind.projectName}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {blind.areaName}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-foreground">
                      {blind.phaseKey
                        ? phaseLabelByKey.get(String(blind.phaseKey)) ||
                          blind.phaseKey
                        : "Backfill required"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${blind.checklistComplete === true ? "bg-emerald-100 text-emerald-800" : blind.checklistComplete === false ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {blind.checklistComplete === true
                        ? "Complete"
                        : blind.checklistComplete === false
                          ? "Pending"
                          : "Not initialized"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {blind.lifecycleStatus || "UNINITIALIZED"}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${blind.priority === "Critical" ? "bg-red-100 text-red-800" : blind.priority === "High" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                    >
                      {blind.priority}
                    </span>
                  </td>
                </tr>
              ))}
              {data.topBlinds.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-muted-foreground"
                  >
                    No blind records are registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
