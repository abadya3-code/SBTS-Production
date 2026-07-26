/*
  Slip Blinds Tracker — SBTS Professional
  ─────────────────────────────────────────
  Dedicated page for monitoring all Slip Blinds in the plant.
  Provides real-time statistics, advanced filtering, periodic survey management,
  and export capabilities for Safety audits.
*/

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Shield,
  TrendingDown,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { SurveyDialog } from "@/components/blinds/SurveyDialog";
import { BlindDetailSheet } from "@/components/blinds/BlindDetailSheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlipStatus = "all" | "in_service" | "removed" | "merged" | "unknown";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  in_service: {
    label: "In Service",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  removed: {
    label: "Removed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
  merged: {
    label: "Merged",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Layers className="h-3 w-3" />,
  },
  unknown: {
    label: "Unknown",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    Critical: "bg-red-100 text-red-800 border-red-200",
    High: "bg-orange-100 text-orange-800 border-orange-200",
    Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Low: "bg-green-100 text-green-800 border-green-200",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${map[priority] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {priority}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  pct,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  pct?: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{value.toLocaleString()}</p>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className={`rounded-xl p-2.5 ${color}`}>{icon}</div>
        </div>
        {pct !== undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Share</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Blinds() {
  const [, navigate] = useLocation();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SlipStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("registry");
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);

  // Blind detail sheet
  const [selectedBlind, setSelectedBlind] = useState<{ tag: string; projectId: string; slipStatus: string } | null>(null);

  // Data
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } =
    trpc.slipBlinds.stats.useQuery(undefined, { refetchInterval: 60_000 });

  const { data: listData, isLoading: listLoading, refetch: refetchList } =
    trpc.slipBlinds.list.useQuery(
      {
        slipStatus: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        projectId: projectFilter === "all" ? undefined : projectFilter,
        areaId: areaFilter === "all" ? undefined : parseInt(areaFilter),
        search: search || undefined,
        limit: 300,
      },
      { refetchInterval: 60_000 }
    );

  const { data: surveys, isLoading: surveysLoading, refetch: refetchSurveys } =
    trpc.slipBlinds.surveys.useQuery(undefined);

  const rows = listData?.rows ?? [];
  const total = listData?.total ?? 0;

  // Unique projects for filter
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.projectId, r.projectName));
    return Array.from(map.entries());
  }, [rows]);

  // Unique areas for filter
  const areaOptions = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((r) => {
      if (r.areaId && r.areaName) map.set(r.areaId, r.areaName);
    });
    return Array.from(map.entries());
  }, [rows]);

  function handleRefresh() {
    refetchStats();
    refetchList();
    refetchSurveys();
    toast.success("Data refreshed");
  }

  // ─── Excel Export ──────────────────────────────────────────────────────────

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    if (stats) {
      const summaryData = [
        ["SBTS — Slip Blind Safety Report"],
        ["Generated", new Date().toLocaleString()],
        [],
        ["Metric", "Count", "Percentage"],
        ["Total Slip Blinds", stats.total, "100%"],
        ["In Service", stats.inService, `${stats.inServicePct}%`],
        ["Removed", stats.removed, `${stats.removedPct}%`],
        ["Merged", stats.merged, `${stats.mergedPct}%`],
        ["Foreman Approved", stats.foremanApproved, `${stats.foremanApprovedPct}%`],
        ["Critical Priority", stats.critical, ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, "Summary");

      // By Project
      if (stats.byProject.length > 0) {
        const projData = [
          ["Project", "Total", "In Service", "Merged"],
          ...stats.byProject.map((p) => [p.projectName, p.count, p.inService, p.merged]),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(projData);
        ws2["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws2, "By Project");
      }
    }

    // Blind details sheet
    if (rows.length > 0) {
      const detailData = [
        ["Tag", "Project", "Area", "Type", "Size", "Phase", "Priority", "Status", "Foreman Approved", "Location", "Owner"],
        ...rows.map((r) => [
          r.tag,
          r.projectName,
          r.areaName ?? "",
          r.type,
          r.size,
          r.phase,
          r.priority,
          STATUS_CONFIG[r.slipStatus]?.label ?? r.slipStatus,
          r.slipMetalForemanApproved ? "Yes" : "No",
          r.location ?? "",
          r.owner,
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(detailData);
      ws3["!cols"] = [
        { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 10 },
        { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, "Blind Details");
    }

    // Survey history sheet
    if (surveys && surveys.length > 0) {
      const surveyData = [
        ["Survey Date", "Conducted By", "Total", "In Service", "Removed", "Merged", "Foreman Approved", "Status"],
        ...surveys.map((s) => [
          String(s.surveyDate),
          s.conductedByName ?? "",
          s.totalCount,
          s.inServiceCount,
          s.removedCount,
          s.mergedCount,
          s.foremanApprovedCount,
          s.status,
        ]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(surveyData);
      ws4["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws4, "Survey History");
    }

    XLSX.writeFile(wb, `SBTS_SlipBlinds_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel report exported");
  }

  // ─── PDF Print ─────────────────────────────────────────────────────────────

  function handlePrintReport() {
    const printContent = document.getElementById("slip-blind-print-area");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SBTS — Slip Blind Safety Report</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 20px; }
          h1 { font-size: 18px; font-weight: 800; color: #0f172a; }
          h2 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 16px 0 8px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .header-right { text-align: right; font-size: 10px; color: #64748b; }
          .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
          .stat-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
          .stat-box .val { font-size: 22px; font-weight: 800; color: #0f172a; }
          .stat-box .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; text-align: left; border: 1px solid #e2e8f0; }
          td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 10px; }
          tr:nth-child(even) td { background: #f8fafc; }
          .badge-in { background: #dcfce7; color: #166534; border-radius: 9999px; padding: 1px 6px; font-size: 9px; font-weight: 700; }
          .badge-removed { background: #fee2e2; color: #991b1b; border-radius: 9999px; padding: 1px 6px; font-size: 9px; font-weight: 700; }
          .badge-merged { background: #dbeafe; color: #1e40af; border-radius: 9999px; padding: 1px 6px; font-size: 9px; font-weight: 700; }
          .badge-critical { background: #fee2e2; color: #991b1b; border-radius: 9999px; padding: 1px 6px; font-size: 9px; font-weight: 700; }
          .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
          @media print { body { padding: 10px; } @page { margin: 15mm; size: A4 landscape; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Slip Blind Safety Report</h1>
            <div style="font-size:10px;color:#64748b;margin-top:4px;">Smart Blind Tracking System (SBTS)</div>
          </div>
          <div class="header-right">
            <div>Generated: ${new Date().toLocaleString()}</div>
            <div>Total Records: ${total}</div>
          </div>
        </div>
        ${stats ? `
        <h2>Summary Statistics</h2>
        <div class="stats-grid">
          <div class="stat-box"><div class="val">${stats.total}</div><div class="lbl">Total</div></div>
          <div class="stat-box"><div class="val">${stats.inService}</div><div class="lbl">In Service (${stats.inServicePct}%)</div></div>
          <div class="stat-box"><div class="val">${stats.removed}</div><div class="lbl">Removed (${stats.removedPct}%)</div></div>
          <div class="stat-box"><div class="val">${stats.merged}</div><div class="lbl">Merged (${stats.mergedPct}%)</div></div>
          <div class="stat-box"><div class="val">${stats.critical}</div><div class="lbl">Critical</div></div>
        </div>
        ` : ""}
        <h2>Blind Registry (${rows.length} records)</h2>
        <table>
          <thead>
            <tr>
              <th>Tag</th><th>Project</th><th>Area</th><th>Type</th>
              <th>Size</th><th>Phase</th><th>Priority</th><th>Status</th>
              <th>Foreman Approved</th><th>Location</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td><strong>${r.tag}</strong></td>
                <td>${r.projectName}</td>
                <td>${r.areaName ?? "-"}</td>
                <td>${r.type}</td>
                <td>${r.size}</td>
                <td>${r.phase}</td>
                <td>${r.priority === "Critical" ? `<span class="badge-critical">${r.priority}</span>` : r.priority}</td>
                <td><span class="badge-${r.slipStatus}">${STATUS_CONFIG[r.slipStatus]?.label ?? r.slipStatus}</span></td>
                <td>${r.slipMetalForemanApproved ? "✓ Yes" : "No"}</td>
                <td>${r.location ?? "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:6px;padding:16px;">
          <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:12px;">AUTHORIZATION &amp; SIGNATURES</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
            <div style="text-align:center;">
              <div style="border-bottom:1px solid #0f172a;margin-bottom:6px;height:40px;"></div>
              <div style="font-size:10px;font-weight:700;">Safety Officer</div>
              <div style="font-size:9px;color:#64748b;">Name &amp; Signature</div>
            </div>
            <div style="text-align:center;">
              <div style="border-bottom:1px solid #0f172a;margin-bottom:6px;height:40px;"></div>
              <div style="font-size:10px;font-weight:700;">Foreman / Supervisor</div>
              <div style="font-size:9px;color:#64748b;">Name &amp; Signature</div>
            </div>
            <div style="text-align:center;">
              <div style="border-bottom:1px solid #0f172a;margin-bottom:6px;height:40px;"></div>
              <div style="font-size:10px;font-weight:700;">Department Manager</div>
              <div style="font-size:9px;color:#64748b;">Name &amp; Signature</div>
            </div>
          </div>
        </div>
        <div class="footer">
          <div>SBTS — Smart Blind Tracking System</div>
          <div>This is a system-generated safety report. For official use only.</div>
          <div>Page 1</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" id="slip-blind-print-area">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-600" />
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-600">
              Safety Registry
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            Slip Blind Tracker
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor all slip blinds in the plant — track status, conduct periodic surveys, and export safety reports.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintReport} className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Print Report
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
            onClick={() => setShowSurveyDialog(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Survey
          </Button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            title="Total Blinds"
            value={stats.total}
            icon={<Package className="h-5 w-5 text-slate-600" />}
            color="bg-slate-100"
          />
          <StatCard
            title="In Service"
            value={stats.inService}
            pct={stats.inServicePct}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            color="bg-emerald-50"
            subtitle="Active in plant"
          />
          <StatCard
            title="Removed"
            value={stats.removed}
            pct={stats.removedPct}
            icon={<XCircle className="h-5 w-5 text-red-500" />}
            color="bg-red-50"
            subtitle="Foreman approved"
          />
          <StatCard
            title="Merged"
            value={stats.merged}
            pct={stats.mergedPct}
            icon={<Layers className="h-5 w-5 text-blue-500" />}
            color="bg-blue-50"
            subtitle="Consolidated"
          />
          <StatCard
            title="Critical"
            value={stats.critical}
            icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
            color="bg-orange-50"
            subtitle="High priority"
          />
        </div>
      ) : null}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="registry" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Registry
            {total > 0 && (
              <span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="surveys" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Survey History
            {surveys && surveys.length > 0 && (
              <span className="ml-1 rounded-full bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {surveys.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Breakdown
          </TabsTrigger>
        </TabsList>

        {/* ── Registry Tab ── */}
        <TabsContent value="registry" className="mt-4 space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search by tag, project, area, location…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-1.5 shrink-0"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>

              {showFilters && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4 border-t pt-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SlipStatus)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="in_service">In Service</SelectItem>
                        <SelectItem value="removed">Removed</SelectItem>
                        <SelectItem value="merged">Merged</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Priority</label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Project</label>
                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projectOptions.map(([id, name]) => (
                          <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Area</label>
                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Areas</SelectItem>
                        {areaOptions.map(([id, name]) => (
                          <SelectItem key={String(id)} value={String(id)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {listLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Package className="h-10 w-10 mb-3 opacity-40" />
                  <p className="font-semibold">No slip blinds found</p>
                  <p className="text-sm mt-1">Adjust filters or add blinds to a project</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-bold text-slate-700">Tag</TableHead>
                      <TableHead className="font-bold text-slate-700">Project</TableHead>
                      <TableHead className="font-bold text-slate-700">Area</TableHead>
                      <TableHead className="font-bold text-slate-700">Type / Size</TableHead>
                      <TableHead className="font-bold text-slate-700">Phase</TableHead>
                      <TableHead className="font-bold text-slate-700">Priority</TableHead>
                      <TableHead className="font-bold text-slate-700">Status</TableHead>
                      <TableHead className="font-bold text-slate-700">Foreman</TableHead>
                      <TableHead className="font-bold text-slate-700">Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow
                        key={row.tag}
                        className="cursor-pointer hover:bg-cyan-50/40 transition-colors"
                        onClick={() =>
                          setSelectedBlind({
                            tag: row.tag,
                            projectId: row.projectId,
                            slipStatus: row.slipStatus,
                          })
                        }
                      >
                        <TableCell className="font-extrabold text-slate-900 font-mono">
                          {row.tag}
                        </TableCell>
                        <TableCell className="text-slate-700 max-w-[180px] truncate">
                          {row.projectName}
                        </TableCell>
                        <TableCell>
                          {row.areaName ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                              <MapPin className="h-3 w-3" />
                              {row.areaName}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          <span className="font-medium">{row.type}</span>
                          <span className="text-slate-400"> / {row.size}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-semibold">
                            {row.phase}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={row.priority} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.slipStatus} />
                        </TableCell>
                        <TableCell>
                          {row.slipMetalForemanApproved ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[140px] truncate">
                          {row.location ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {rows.length > 0 && (
              <div className="border-t bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Showing {rows.length} of {total} slip blinds
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Survey History Tab ── */}
        <TabsContent value="surveys" className="mt-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-cyan-600" />
                Periodic Survey History
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              {surveysLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                </div>
              ) : !surveys || surveys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <ClipboardList className="h-10 w-10 mb-3 opacity-40" />
                  <p className="font-semibold">No surveys conducted yet</p>
                  <p className="text-sm mt-1">Click "New Survey" to conduct the first periodic survey</p>
                  <Button
                    size="sm"
                    className="mt-4 gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
                    onClick={() => setShowSurveyDialog(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Survey
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-bold text-slate-700">Survey Date</TableHead>
                      <TableHead className="font-bold text-slate-700">Conducted By</TableHead>
                      <TableHead className="font-bold text-slate-700">Total</TableHead>
                      <TableHead className="font-bold text-slate-700">In Service</TableHead>
                      <TableHead className="font-bold text-slate-700">Removed</TableHead>
                      <TableHead className="font-bold text-slate-700">Merged</TableHead>
                      <TableHead className="font-bold text-slate-700">Foreman Approved</TableHead>
                      <TableHead className="font-bold text-slate-700">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveys.map((s) => (
                      <TableRow key={s.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-semibold text-slate-900">
                          {String(s.surveyDate)}
                        </TableCell>
                        <TableCell className="text-slate-700">{s.conductedByName ?? "—"}</TableCell>
                        <TableCell className="font-bold">{s.totalCount}</TableCell>
                        <TableCell>
                          <span className="text-emerald-700 font-semibold">{s.inServiceCount}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-red-600 font-semibold">{s.removedCount}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-blue-600 font-semibold">{s.mergedCount}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-slate-700">{s.foremanApprovedCount}</span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              s.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : s.status === "submitted"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Breakdown Tab ── */}
        <TabsContent value="breakdown" className="mt-4 space-y-4">
          {stats && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* By Project */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-cyan-600" />
                    By Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.byProject.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No data</p>
                  ) : (
                    stats.byProject.map((p) => (
                      <div key={p.projectId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                            {p.projectName}
                          </span>
                          <span className="text-xs font-bold text-slate-900 ml-2">{p.count}</span>
                        </div>
                        <div className="flex gap-1 h-2">
                          <div
                            className="bg-emerald-400 rounded-l"
                            style={{ width: `${(p.inService / p.count) * 100}%` }}
                            title={`In Service: ${p.inService}`}
                          />
                          <div
                            className="bg-blue-400 rounded-r"
                            style={{ width: `${(p.merged / p.count) * 100}%` }}
                            title={`Merged: ${p.merged}`}
                          />
                        </div>
                        <div className="flex gap-3 mt-0.5 text-[10px] text-slate-500">
                          <span className="text-emerald-600">■ In Service: {p.inService}</span>
                          <span className="text-blue-600">■ Merged: {p.merged}</span>
                        </div>
                        <Separator className="mt-2" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* By Area */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-600" />
                    By Area
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.byArea.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No area data</p>
                  ) : (
                    stats.byArea.map((a) => (
                      <div key={a.areaId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-700">{a.areaName}</span>
                          <span className="text-xs font-bold text-slate-900">{a.count}</span>
                        </div>
                        <Progress
                          value={stats.total > 0 ? (a.count / stats.total) * 100 : 0}
                          className="h-2"
                        />
                        <Separator className="mt-2" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Survey Dialog ── */}
      {showSurveyDialog && (
        <SurveyDialog
          open={showSurveyDialog}
          onClose={() => setShowSurveyDialog(false)}
          onSuccess={() => {
            setShowSurveyDialog(false);
            refetchSurveys();
            refetchStats();
            toast.success("Survey submitted successfully");
          }}
        />
      )}

      {/* ── Blind Detail Sheet ── */}
      <BlindDetailSheet
        open={!!selectedBlind}
        onClose={() => setSelectedBlind(null)}
        tag={selectedBlind?.tag ?? null}
        projectId={selectedBlind?.projectId ?? null}
        slipStatus={selectedBlind?.slipStatus}
      />
    </div>
  );
}
