/**
 * AuditLogs.tsx
 * ─────────────
 * Comprehensive audit trail page — aggregates workflow logs, phase approvals,
 * and system notifications into a unified, filterable, searchable timeline.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Download, Filter,
  History, RefreshCw, Search, Shield, FileText, Bell, ChevronLeft, ChevronRight,
} from "lucide-react";

// ─── Source & Severity Styles ─────────────────────────────────────────────
const sourceBadge: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  workflow: { label: "Workflow", className: "bg-blue-50 text-blue-700 border-blue-200", icon: <Activity className="w-3 h-3" /> },
  approval: { label: "Approval", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  notification: { label: "System", className: "bg-purple-50 text-purple-700 border-purple-200", icon: <Bell className="w-3 h-3" /> },
};

const severityStyles: Record<string, string> = {
  info: "border-l-blue-400",
  warning: "border-l-amber-400",
  critical: "border-l-red-400",
};

const PAGE_SIZE = 30;

export default function AuditLogs() {
  const [source, setSource] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setTimeout(() => { setDebouncedSearch(val); setPage(0); }, 300);
  };

  // Queries
  const { data: stats, isLoading: statsLoading, error: statsError } = trpc.auditLogs.stats.useQuery();
  const { data, isLoading, refetch, error: listError } = trpc.auditLogs.list.useQuery({
    source: source === "all" ? "all" : source as any,
    search: debouncedSearch || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Export CSV
  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = ["Timestamp", "Source", "Action", "Message", "Actor", "Blind Tag", "Project", "Phase", "Severity"];
    const rows = logs.map((l) => [
      new Date(l.timestamp).toISOString(),
      l.source,
      l.action,
      `"${(l.message || "").replace(/"/g, '""')}"`,
      l.actorName || "",
      l.blindTag || "",
      l.projectId || "",
      l.phase || "",
      l.severity,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SBTS-AuditLogs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete system activity log — workflow changes, approvals, and system events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2" disabled={!logs.length}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard title="Total Events" value={stats?.totalAll ?? 0} icon={<Activity className="w-5 h-5" />} loading={statsLoading} />
        <StatCard title="Workflow Logs" value={stats?.totalWorkflowLogs ?? 0} icon={<History className="w-5 h-5" />} loading={statsLoading} />
        <StatCard title="Approvals" value={stats?.totalApprovals ?? 0} icon={<CheckCircle2 className="w-5 h-5" />} loading={statsLoading} />
        <StatCard title="Notifications" value={stats?.totalNotifications ?? 0} icon={<Bell className="w-5 h-5" />} loading={statsLoading} />
        <StatCard title="Last 24h" value={stats?.recentActivity ?? 0} icon={<Clock className="w-5 h-5" />} loading={statsLoading} accent />
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters:</span>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search actions, messages..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="approval">Approvals</SelectItem>
                <SelectItem value="notification">System</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {total} {total === 1 ? "event" : "events"} found
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {(statsError || listError) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Failed to load audit data</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(listError || statsError)?.message || "Unknown error"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Timeline */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-primary" /> Event Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No audit events found</p>
              <p className="text-xs mt-1">Events will appear here as users interact with the system.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => {
                const src = sourceBadge[log.source] || sourceBadge.workflow;
                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-4 py-3 px-4 rounded-lg border-l-4 ${severityStyles[log.severity]} hover:bg-muted/30 transition-colors`}
                  >
                    {/* Timestamp */}
                    <div className="flex-shrink-0 w-36 text-xs text-muted-foreground pt-0.5">
                      <div>{new Date(log.timestamp).toLocaleDateString("en-SA")}</div>
                      <div>{new Date(log.timestamp).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                    </div>

                    {/* Source Badge */}
                    <div className="flex-shrink-0 pt-0.5">
                      <Badge variant="outline" className={`${src.className} text-[10px] px-2 py-0.5 gap-1`}>
                        {src.icon} {src.label}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{log.action}</span>
                        {log.blindTag && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0 font-mono">
                            {log.blindTag}
                          </Badge>
                        )}
                        {log.phase && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0 bg-slate-50">
                            {log.phase}
                          </Badge>
                        )}
                        {log.severity === "critical" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.message}</p>
                    </div>

                    {/* Actor */}
                    <div className="flex-shrink-0 text-right">
                      {log.actorName && (
                        <span className="text-xs text-muted-foreground">{log.actorName}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages} ({total} events)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stat Card Component ─────────────────────────────────────────────────
function StatCard({ title, value, icon, loading, accent }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={`border-border ${accent ? "ring-1 ring-primary/20" : ""}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : "text-foreground"}`}>
                {value.toLocaleString()}
              </p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
