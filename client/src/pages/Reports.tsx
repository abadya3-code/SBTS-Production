/*
Design Philosophy: Industrial Command Center Minimalism.
Reports Center — full-featured reporting hub with advanced filters, multiple report types,
and multi-format export (PDF, Excel, CSV, JSON).
*/
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useCertificateSettings, openPrintWindow } from "@/hooks/useCertificateSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, Download, FileSpreadsheet, FileText, Filter, Loader2,
  RefreshCw, TrendingUp, Activity, AlertTriangle, CheckCircle2,
  MapPinned, FolderKanban, ListChecks, X,
} from "lucide-react";
import ExportDialog, { type ExportOptions } from "@/components/reports/ExportDialog";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────

type BlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
type BlindPriority = "Low" | "Normal" | "High" | "Critical";

const PHASES: BlindPhase[] = [
  "Broken / Preparation", "Assembly", "Tight & Torque", "Final Tight", "Inspection Ready",
];
const PRIORITIES: BlindPriority[] = ["Low", "Normal", "High", "Critical"];
const PHASE_COLORS: Record<BlindPhase, string> = {
  "Broken / Preparation": "#ef4444",
  "Assembly": "#f59e0b",
  "Tight & Torque": "#eab308",
  "Final Tight": "#22c55e",
  "Inspection Ready": "#3b82f6",
};
const PRIORITY_COLORS: Record<BlindPriority, string> = {
  Low: "#64748b", Normal: "#3b82f6", High: "#f59e0b", Critical: "#ef4444",
};

// ─── Export Utilities ─────────────────────────────────────────────────────

function escapeCSV(val: unknown): string {
  const str = val == null ? "" : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-SA", { timeZone: "Asia/Riyadh" });
}

// ─── Stat Card ────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">{value}</p>
            {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${color}18` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Phase Bar ────────────────────────────────────────────────────────────

function PhaseBar({ phaseCounts, total }: { phaseCounts: Record<BlindPhase, number>; total: number }) {
  if (total === 0) return <div className="text-xs text-slate-400">No data</div>;
  return (
    <div className="space-y-2">
      {PHASES.map((phase) => {
        const count = phaseCounts[phase] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={phase} className="flex items-center gap-3">
            <div className="w-36 truncate text-xs font-medium text-slate-600 dark:text-slate-300">{phase}</div>
            <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: PHASE_COLORS[phase] }}
              />
            </div>
            <div className="w-10 text-right text-xs font-bold text-slate-700 dark:text-slate-200">{count}</div>
            <div className="w-9 text-right text-xs text-slate-400">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function Reports() {
  const [activeTab, setActiveTab] = useState<"executive" | "projects" | "blinds" | "areas">("executive");
  const [filterArea, setFilterArea] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const { settings: certSettings, isLoading: certLoading } = useCertificateSettings();

  // Build filter object for queries
  const queryFilters = useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filterArea !== "all") f.areaId = Number(filterArea);
    if (filterProject !== "all") f.projectId = filterProject;
    if (filterPhase !== "all") f.phase = filterPhase as BlindPhase;
    if (filterPriority !== "all") f.priority = filterPriority as BlindPriority;
    if (filterStatus !== "all") f.status = filterStatus;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filterArea, filterProject, filterPhase, filterPriority, filterStatus]);

  const { data: globalStats, isLoading: loadingStats, refetch: refetchStats } = trpc.reports.globalStats.useQuery();
  const { data: projectSummaries, isLoading: loadingProjects, refetch: refetchProjects } = trpc.reports.projectSummaries.useQuery(queryFilters as any);
  const { data: blindsData, isLoading: loadingBlinds, refetch: refetchBlinds } = trpc.reports.blinds.useQuery(queryFilters as any);
  const { data: areaSummaries, isLoading: loadingAreas, refetch: refetchAreas } = trpc.reports.areaSummaries.useQuery(queryFilters as any);
  const { data: areasForFilter } = trpc.areas.list.useQuery();
  const { data: projectsForFilter } = trpc.projects.list.useQuery();

  const isLoading = loadingStats || loadingProjects || loadingBlinds || loadingAreas || certLoading;

  const handleRefresh = () => {
    refetchStats(); refetchProjects(); refetchBlinds(); refetchAreas();
  };

  const clearFilters = () => {
    setFilterArea("all"); setFilterProject("all");
    setFilterPhase("all"); setFilterPriority("all"); setFilterStatus("all");
  };

  const hasActiveFilters = filterArea !== "all" || filterProject !== "all" ||
    filterPhase !== "all" || filterPriority !== "all" || filterStatus !== "all";

  // ─── PDF Export ──────────────────────────────────────────────────────────

  const handleExportPDF = (type: "executive" | "projects" | "blinds" | "areas") => {
    if (!certSettings) return;
    let htmlBody = "";
    const ts = new Date().toLocaleString("en-SA", { timeZone: "Asia/Riyadh" });

    if (type === "executive" && globalStats) {
      htmlBody = buildExecutivePDF(globalStats);
    } else if (type === "projects" && projectSummaries) {
      htmlBody = buildProjectsPDF(projectSummaries);
    } else if (type === "blinds" && blindsData) {
      htmlBody = buildBlindsPDF(blindsData);
    } else if (type === "areas" && areaSummaries) {
      htmlBody = buildAreasPDF(areaSummaries);
    }

    const titles: Record<string, string> = {
      executive: "Executive Summary Report",
      projects: "Projects Status Report",
      blinds: "Blinds Registry Report",
      areas: "Areas Overview Report",
    };

    openPrintWindow(htmlBody, certSettings, titles[type], `SBTS ${titles[type]} — ${ts}`);
  };

  // ─── Excel Export ────────────────────────────────────────────────────────

  // ─── Advanced Export Handler ────────────────────────────────────────────

  const handleAdvancedExport = async (options: ExportOptions) => {
    const { format, scopes, includeSignatures } = options;
    const ts = new Date().toISOString().slice(0, 10);

    if (format === "excel") {
      // Build a single multi-sheet workbook based on selected scopes
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary (always included if executive scope or if multiple scopes)
      if ((scopes.includes("executive") || scopes.length > 1) && globalStats) {
        const statsRows = [
          { Metric: "Total Areas", Value: globalStats.totalAreas },
          { Metric: "Total Projects", Value: globalStats.totalProjects },
          { Metric: "Total Blinds", Value: globalStats.totalBlinds },
          { Metric: "Completed Blinds", Value: globalStats.completedBlinds },
          { Metric: "In Progress Blinds", Value: globalStats.inProgressBlinds },
          { Metric: "Critical Blinds", Value: globalStats.criticalBlinds },
          { Metric: "Overall Completion Rate (%)", Value: globalStats.completionRate },
          ...Object.entries(globalStats.phaseCounts).map(([phase, count]) => ({ Metric: `Phase: ${phase}`, Value: count })),
          ...Object.entries(globalStats.priorityCounts).map(([priority, count]) => ({ Metric: `Priority: ${priority}`, Value: count })),
          ...Object.entries(globalStats.projectsByStatus).map(([status, count]) => ({ Metric: `Projects Status: ${status}`, Value: count })),
        ];
        const ws = XLSX.utils.json_to_sheet(statsRows);
        ws["!cols"] = [{ wch: 35 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, "Summary");
      }

      // Sheet 2: Projects
      if (scopes.includes("projects") && projectSummaries && projectSummaries.length > 0) {
        const rows = projectSummaries.map((p) => ({
          "Project ID": p.id,
          "Project Name": p.name,
          "Area": p.areaName,
          "Area Code": p.areaCode,
          "Status": p.status,
          "Planned Blinds": p.blindsCount,
          "Registered Blinds": p.registeredBlinds,
          "Completed Blinds": p.completedBlinds,
          "In Progress": p.inProgressBlinds,
          "Critical Blinds": p.criticalBlinds,
          "Completion Rate (%)": p.completionRate,
          "Description": p.description ?? "",
          "Created At": formatDate(p.createdAt),
          "Updated At": formatDate(p.updatedAt),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 14 },
          { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
          { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Projects");
      }

      // Sheet 3: Blinds
      if (scopes.includes("blinds") && blindsData && blindsData.length > 0) {
        const rows = blindsData.map((b) => ({
          "Tag": b.tag,
          "Project": b.projectName,
          "Area": b.areaName,
          "Area Code": b.areaCode,
          "Type": b.type,
          "Size": b.size,
          "Rate": b.rate ?? "",
          "Phase": b.phase,
          "Priority": b.priority,
          "Owner": b.owner,
          "Equipment": b.equipment ?? "",
          "Location": b.location ?? "",
          "Isolation Point": b.isolationPoint ?? "",
          "Slip Foreman Approved": b.slipMetalForemanApproved ? "YES" : "NO",
          "Slip Blind Merged": b.slipBlindMerged ? "YES" : "NO",
          "Notes": b.notes ?? "",
          "Created At": formatDate(b.createdAt),
          "Updated At": formatDate(b.updatedAt),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
          { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 20 },
          { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 16 },
          { wch: 30 }, { wch: 14 }, { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Blinds");
      }

      // Sheet 4: Areas
      if (scopes.includes("areas") && areaSummaries && areaSummaries.length > 0) {
        const rows = areaSummaries.map((a) => ({
          "Area ID": a.id,
          "Area Name": a.name,
          "Area Code": a.code,
          "Location": a.location ?? "",
          "Description": a.description ?? "",
          "Active": a.isActive ? "YES" : "NO",
          "Projects": a.projectCount,
          "Total Blinds": a.totalBlinds,
          "Completed Blinds": a.completedBlinds,
          "Critical Blinds": a.criticalBlinds,
          "Completion Rate (%)": a.completionRate,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 20 }, { wch: 30 },
          { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Areas");
      }

      // Ensure at least one sheet exists
      if (wb.SheetNames.length === 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["No data available"]]), "Empty");
      }

      const scopeLabel = scopes.length === 1 ? scopes[0] : "Multi-Scope";
      XLSX.writeFile(wb, `SBTS-Report-${scopeLabel}-${ts}.xlsx`);
      return;
    }

    if (format === "pdf") {
      if (!certSettings) return;
      let htmlBody = "";
      const ts2 = new Date().toLocaleString("en-SA", { timeZone: "Asia/Riyadh" });
      if (scopes.includes("executive") && globalStats) htmlBody += buildExecutivePDF(globalStats);
      if (scopes.includes("projects") && projectSummaries) htmlBody += buildProjectsPDF(projectSummaries);
      if (scopes.includes("blinds") && blindsData) htmlBody += buildBlindsPDF(blindsData);
      if (scopes.includes("areas") && areaSummaries) htmlBody += buildAreasPDF(areaSummaries);
      openPrintWindow(htmlBody, certSettings, "SBTS Operational Report", `SBTS Report — ${ts2}`);
      return;
    }

    if (format === "csv") {
      if (scopes.includes("projects")) handleExportCSV("projects");
      if (scopes.includes("blinds")) handleExportCSV("blinds");
      return;
    }

    if (format === "json") {
      const payload: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        filters: queryFilters ?? "none",
      };
      if (scopes.includes("executive") && globalStats) payload.summary = globalStats;
      if (scopes.includes("projects") && projectSummaries) payload.projects = projectSummaries;
      if (scopes.includes("blinds") && blindsData) payload.blinds = blindsData;
      if (scopes.includes("areas") && areaSummaries) payload.areas = areaSummaries;
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
        `SBTS-Report-${ts}.json`
      );
    }
  };

  const handleExportExcel = (type: "projects" | "blinds" | "areas" | "full") => {
    const wb = XLSX.utils.book_new();
    const ts = new Date().toISOString().slice(0, 10);

    if ((type === "projects" || type === "full") && projectSummaries) {
      const rows = projectSummaries.map((p) => ({
        "Project ID": p.id,
        "Project Name": p.name,
        "Area": p.areaName,
        "Area Code": p.areaCode,
        "Status": p.status,
        "Planned Blinds": p.blindsCount,
        "Registered Blinds": p.registeredBlinds,
        "Completed Blinds": p.completedBlinds,
        "In Progress": p.inProgressBlinds,
        "Critical Blinds": p.criticalBlinds,
        "Completion Rate (%)": p.completionRate,
        "Progress (%)": p.progress,
        "Description": p.description ?? "",
        "Created At": formatDate(p.createdAt),
        "Updated At": formatDate(p.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
        { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Projects");
    }

    if ((type === "blinds" || type === "full") && blindsData) {
      const rows = blindsData.map((b) => ({
        "Tag": b.tag,
        "Project": b.projectName,
        "Area": b.areaName,
        "Area Code": b.areaCode,
        "Type": b.type,
        "Size": b.size,
        "Rate": b.rate ?? "",
        "Phase": b.phase,
        "Priority": b.priority,
        "Owner": b.owner,
        "Equipment": b.equipment ?? "",
        "Location": b.location ?? "",
        "Isolation Point": b.isolationPoint ?? "",
        "Slip Foreman Approved": b.slipMetalForemanApproved ? "YES" : "NO",
        "Slip Blind Merged": b.slipBlindMerged ? "YES" : "NO",
        "Notes": b.notes ?? "",
        "Created At": formatDate(b.createdAt),
        "Updated At": formatDate(b.updatedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 20 },
        { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 20 },
        { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 16 },
        { wch: 30 }, { wch: 14 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Blinds");
    }

    if ((type === "areas" || type === "full") && areaSummaries) {
      const rows = areaSummaries.map((a) => ({
        "Area ID": a.id,
        "Area Name": a.name,
        "Area Code": a.code,
        "Location": a.location ?? "",
        "Description": a.description ?? "",
        "Active": a.isActive ? "YES" : "NO",
        "Projects": a.projectCount,
        "Total Blinds": a.totalBlinds,
        "Completed Blinds": a.completedBlinds,
        "Critical Blinds": a.criticalBlinds,
        "Completion Rate (%)": a.completionRate,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 8 }, { wch: 24 }, { wch: 12 }, { wch: 20 }, { wch: 30 },
        { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Areas");
    }

    if (type === "full" && globalStats) {
      const statsRows = [
        { "Metric": "Total Areas", "Value": globalStats.totalAreas },
        { "Metric": "Total Projects", "Value": globalStats.totalProjects },
        { "Metric": "Total Blinds", "Value": globalStats.totalBlinds },
        { "Metric": "Completed Blinds", "Value": globalStats.completedBlinds },
        { "Metric": "In Progress Blinds", "Value": globalStats.inProgressBlinds },
        { "Metric": "Critical Blinds", "Value": globalStats.criticalBlinds },
        { "Metric": "Overall Completion Rate (%)", "Value": globalStats.completionRate },
        ...Object.entries(globalStats.phaseCounts).map(([phase, count]) => ({
          "Metric": `Phase: ${phase}`, "Value": count,
        })),
        ...Object.entries(globalStats.priorityCounts).map(([priority, count]) => ({
          "Metric": `Priority: ${priority}`, "Value": count,
        })),
        ...Object.entries(globalStats.projectsByStatus).map(([status, count]) => ({
          "Metric": `Projects Status: ${status}`, "Value": count,
        })),
      ];
      const ws = XLSX.utils.json_to_sheet(statsRows);
      ws["!cols"] = [{ wch: 35 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, "Summary");
    }

    const filename = type === "full"
      ? `SBTS-Full-Report-${ts}.xlsx`
      : `SBTS-${type.charAt(0).toUpperCase() + type.slice(1)}-Report-${ts}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  // ─── CSV Export ──────────────────────────────────────────────────────────

  const handleExportCSV = (type: "projects" | "blinds") => {
    const ts = new Date().toISOString().slice(0, 10);
    let csvContent = "";
    let filename = "";

    if (type === "projects" && projectSummaries) {
      const headers = ["Project ID", "Project Name", "Area", "Status", "Planned", "Registered", "Completed", "Critical", "Completion %"];
      const rows = projectSummaries.map((p) => [
        p.id, p.name, p.areaName, p.status,
        p.blindsCount, p.registeredBlinds, p.completedBlinds, p.criticalBlinds, p.completionRate,
      ]);
      csvContent = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
      filename = `SBTS-Projects-${ts}.csv`;
    } else if (type === "blinds" && blindsData) {
      const headers = ["Tag", "Project", "Area", "Type", "Size", "Phase", "Priority", "Owner", "Updated At"];
      const rows = blindsData.map((b) => [
        b.tag, b.projectName, b.areaName, b.type, b.size, b.phase, b.priority, b.owner, formatDate(b.updatedAt),
      ]);
      csvContent = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
      filename = `SBTS-Blinds-${ts}.csv`;
    }

    if (csvContent) {
      downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), filename);
    }
  };

  // ─── PDF Builders ─────────────────────────────────────────────────────────

  function buildExecutivePDF(stats: typeof globalStats): string {
    if (!stats) return "";
    const phaseRows = PHASES.map((phase) => {
      const count = stats.phaseCounts[phase] ?? 0;
      const pct = stats.totalBlinds > 0 ? Math.round((count / stats.totalBlinds) * 100) : 0;
      return `<tr><td>${phase}</td><td style="text-align:center;font-weight:700;">${count}</td><td style="text-align:center;">${pct}%</td></tr>`;
    }).join("");

    const priorityRows = PRIORITIES.map((p) => {
      const count = stats.priorityCounts[p] ?? 0;
      const pct = stats.totalBlinds > 0 ? Math.round((count / stats.totalBlinds) * 100) : 0;
      return `<tr><td>${p}</td><td style="text-align:center;font-weight:700;">${count}</td><td style="text-align:center;">${pct}%</td></tr>`;
    }).join("");

    return `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${stats.totalAreas}</div><div class="stat-label">Total Areas</div></div>
        <div class="stat-card"><div class="stat-number">${stats.totalProjects}</div><div class="stat-label">Total Projects</div></div>
        <div class="stat-card"><div class="stat-number">${stats.totalBlinds}</div><div class="stat-label">Total Blinds</div></div>
        <div class="stat-card"><div class="stat-number">${stats.completedBlinds}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-number">${stats.criticalBlinds}</div><div class="stat-label">Critical</div></div>
        <div class="stat-card"><div class="stat-number">${stats.completionRate}%</div><div class="stat-label">Completion Rate</div></div>
      </div>
      <div class="section-title">Phase Distribution</div>
      <table><thead><tr><th>Phase</th><th style="text-align:center;">Count</th><th style="text-align:center;">%</th></tr></thead>
      <tbody>${phaseRows}</tbody></table>
      <div class="section-title">Priority Distribution</div>
      <table><thead><tr><th>Priority</th><th style="text-align:center;">Count</th><th style="text-align:center;">%</th></tr></thead>
      <tbody>${priorityRows}</tbody></table>
    `;
  }

  function buildProjectsPDF(projects: NonNullable<typeof projectSummaries>): string {
    const rows = projects.map((p) => `
      <tr>
        <td>${p.name}</td>
        <td>${p.areaName}</td>
        <td><span class="badge badge-blue">${p.status}</span></td>
        <td style="text-align:center;">${p.registeredBlinds}/${p.blindsCount}</td>
        <td style="text-align:center;">${p.completedBlinds}</td>
        <td style="text-align:center;color:#ef4444;font-weight:700;">${p.criticalBlinds}</td>
        <td style="text-align:center;font-weight:700;">${p.completionRate}%</td>
      </tr>
    `).join("");
    return `
      <div class="section-title">Projects Status (${projects.length} projects)</div>
      <table>
        <thead><tr>
          <th>Project</th><th>Area</th><th>Status</th>
          <th style="text-align:center;">Blinds (Reg/Plan)</th>
          <th style="text-align:center;">Completed</th>
          <th style="text-align:center;">Critical</th>
          <th style="text-align:center;">Completion</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function buildBlindsPDF(blinds: NonNullable<typeof blindsData>): string {
    const rows = blinds.map((b) => `
      <tr>
        <td style="font-weight:700;">${b.tag}</td>
        <td>${b.projectName}</td>
        <td>${b.areaCode}</td>
        <td>${b.type}</td>
        <td>${b.size}</td>
        <td>${b.phase}</td>
        <td style="color:${PRIORITY_COLORS[b.priority]};font-weight:700;">${b.priority}</td>
        <td>${b.owner}</td>
        <td>${formatDate(b.updatedAt)}</td>
      </tr>
    `).join("");
    return `
      <div class="section-title">Blinds Registry (${blinds.length} records)</div>
      <table>
        <thead><tr>
          <th>Tag</th><th>Project</th><th>Area</th><th>Type</th><th>Size</th>
          <th>Phase</th><th>Priority</th><th>Owner</th><th>Updated</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function buildAreasPDF(areas: NonNullable<typeof areaSummaries>): string {
    const rows = areas.map((a) => `
      <tr>
        <td style="font-weight:700;">${a.code}</td>
        <td>${a.name}</td>
        <td style="text-align:center;">${a.projectCount}</td>
        <td style="text-align:center;">${a.totalBlinds}</td>
        <td style="text-align:center;">${a.completedBlinds}</td>
        <td style="text-align:center;color:#ef4444;font-weight:700;">${a.criticalBlinds}</td>
        <td style="text-align:center;font-weight:700;">${a.completionRate}%</td>
      </tr>
    `).join("");
    return `
      <div class="section-title">Areas Overview (${areas.length} areas)</div>
      <table>
        <thead><tr>
          <th>Code</th><th>Area Name</th>
          <th style="text-align:center;">Projects</th>
          <th style="text-align:center;">Total Blinds</th>
          <th style="text-align:center;">Completed</th>
          <th style="text-align:center;">Critical</th>
          <th style="text-align:center;">Completion</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15">
              <BarChart3 className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Reports Center</h1>
              <p className="text-sm text-slate-500">Operational intelligence across all areas, projects, and blinds</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge className="ml-1 h-5 min-w-5 rounded-full bg-cyan-500 px-1 text-[10px] text-white">
                {[filterArea, filterProject, filterPhase, filterPriority, filterStatus].filter((f) => f !== "all").length}
              </Badge>
            )}
          </Button>
          <Button size="sm" onClick={() => setShowExportDialog(true)} className="gap-2 bg-slate-950 hover:bg-slate-800 text-white">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-6 border-0 shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <Filter className="h-4 w-4" />
                Filters:
              </div>
              <Select value={filterArea} onValueChange={setFilterArea}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {(areasForFilter ?? []).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {(projectsForFilter ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPhase} onValueChange={setFilterPhase}>
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue placeholder="All Phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {PHASES.map((ph) => (
                    <SelectItem key={ph} value={ph}>{ph}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-slate-500 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <span className="ml-3 text-slate-500">Loading report data...</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Global KPI Cards */}
          {globalStats && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Areas" value={globalStats.totalAreas} icon={MapPinned} color="#06b6d4" />
              <StatCard label="Projects" value={globalStats.totalProjects} icon={FolderKanban} color="#8b5cf6" />
              <StatCard label="Total Blinds" value={globalStats.totalBlinds} icon={ListChecks} color="#0ea5e9" />
              <StatCard label="Completed" value={globalStats.completedBlinds} icon={CheckCircle2} color="#22c55e" sub={`${globalStats.completionRate}% rate`} />
              <StatCard label="Critical" value={globalStats.criticalBlinds} icon={AlertTriangle} color="#ef4444" />
              <StatCard label="In Progress" value={globalStats.inProgressBlinds} icon={TrendingUp} color="#f59e0b" />
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl">
              <TabsTrigger value="executive" className="rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white">
                <Activity className="mr-2 h-4 w-4" />Executive
              </TabsTrigger>
              <TabsTrigger value="projects" className="rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white">
                <FolderKanban className="mr-2 h-4 w-4" />Projects
              </TabsTrigger>
              <TabsTrigger value="blinds" className="rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white">
                <ListChecks className="mr-2 h-4 w-4" />Blinds
              </TabsTrigger>
              <TabsTrigger value="areas" className="rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white">
                <MapPinned className="mr-2 h-4 w-4" />Areas
              </TabsTrigger>
            </TabsList>

            {/* ── Executive Tab ── */}
            <TabsContent value="executive">
              <div className="grid gap-4 lg:grid-cols-2">
                {globalStats && (
                  <>
                    <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-bold">Phase Distribution</CardTitle>
                          <Button size="sm" variant="outline" onClick={() => handleExportPDF("executive")} className="gap-1.5 h-8 text-xs">
                            <FileText className="h-3.5 w-3.5" />PDF
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <PhaseBar phaseCounts={globalStats.phaseCounts as Record<BlindPhase, number>} total={globalStats.totalBlinds} />
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-bold">Priority Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          {PRIORITIES.map((p) => {
                            const count = globalStats.priorityCounts[p] ?? 0;
                            const pct = globalStats.totalBlinds > 0 ? Math.round((count / globalStats.totalBlinds) * 100) : 0;
                            return (
                              <div key={p} className="rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                <div className="text-2xl font-extrabold" style={{ color: PRIORITY_COLORS[p] }}>{count}</div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">{p}</div>
                                <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PRIORITY_COLORS[p] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-white dark:bg-slate-900 lg:col-span-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-bold">Projects by Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(globalStats.projectsByStatus).map(([status, count]) => (
                            <div key={status} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-3">
                              <div className="text-xl font-extrabold text-slate-900 dark:text-white">{count}</div>
                              <div className="text-sm text-slate-500">{status}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ── Projects Tab ── */}
            <TabsContent value="projects">
              <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">
                      Projects Status ({projectSummaries?.length ?? 0})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleExportCSV("projects")} className="gap-1.5 h-8 text-xs">
                        <Download className="h-3.5 w-3.5" />CSV
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExportExcel("projects")} className="gap-1.5 h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                        <FileSpreadsheet className="h-3.5 w-3.5" />Excel
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExportPDF("projects")} className="gap-1.5 h-8 text-xs text-red-700 border-red-200 hover:bg-red-50">
                        <FileText className="h-3.5 w-3.5" />PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Project</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Area</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Blinds</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Completed</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Critical</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Completion</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Phase Distribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(projectSummaries ?? []).map((p) => (
                          <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-white">{p.name}</div>
                              <div className="text-xs text-slate-400">{p.id}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.areaName}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="outline" className="text-xs">{p.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">{p.registeredBlinds}/{p.blindsCount}</td>
                            <td className="px-4 py-3 text-center font-semibold text-emerald-600">{p.completedBlinds}</td>
                            <td className="px-4 py-3 text-center font-bold text-red-500">{p.criticalBlinds}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.completionRate}%` }} />
                                </div>
                                <span className="text-xs font-bold">{p.completionRate}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-0.5">
                                {PHASES.map((phase) => {
                                  const count = p.phaseCounts[phase] ?? 0;
                                  const total = p.registeredBlinds;
                                  const pct = total > 0 ? (count / total) * 100 : 0;
                                  return (
                                    <div
                                      key={phase}
                                      title={`${phase}: ${count}`}
                                      className="h-5 rounded-sm transition-all"
                                      style={{
                                        width: `${Math.max(pct, 2)}%`,
                                        background: PHASE_COLORS[phase],
                                        opacity: count > 0 ? 1 : 0.15,
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(projectSummaries ?? []).length === 0 && (
                      <div className="py-12 text-center text-slate-400">No projects found matching the current filters.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Blinds Tab ── */}
            <TabsContent value="blinds">
              <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">
                      Blinds Registry ({blindsData?.length ?? 0} records)
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleExportCSV("blinds")} className="gap-1.5 h-8 text-xs">
                        <Download className="h-3.5 w-3.5" />CSV
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExportExcel("blinds")} className="gap-1.5 h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                        <FileSpreadsheet className="h-3.5 w-3.5" />Excel
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExportPDF("blinds")} className="gap-1.5 h-8 text-xs text-red-700 border-red-200 hover:bg-red-50">
                        <FileText className="h-3.5 w-3.5" />PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tag</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Project</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Area</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Phase</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Priority</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Owner</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(blindsData ?? []).map((b) => (
                          <tr key={b.tag} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-cyan-700 dark:text-cyan-400">{b.tag}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[160px] truncate">{b.projectName}</td>
                            <td className="px-4 py-3 text-slate-500">{b.areaCode}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{b.type}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{b.size}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ background: PHASE_COLORS[b.phase] }} />
                                <span className="text-xs">{b.phase}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs font-bold" style={{ color: PRIORITY_COLORS[b.priority] }}>{b.priority}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[120px] truncate">{b.owner}</td>
                            <td className="px-4 py-3 text-center text-xs text-slate-400">{formatDate(b.updatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(blindsData ?? []).length === 0 && (
                      <div className="py-12 text-center text-slate-400">No blinds found matching the current filters.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Areas Tab ── */}
            <TabsContent value="areas">
              <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">
                      Areas Overview ({areaSummaries?.length ?? 0} areas)
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleExportExcel("areas")} className="gap-1.5 h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                        <FileSpreadsheet className="h-3.5 w-3.5" />Excel
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleExportPDF("areas")} className="gap-1.5 h-8 text-xs text-red-700 border-red-200 hover:bg-red-50">
                        <FileText className="h-3.5 w-3.5" />PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Code</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Area Name</th>
                          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Location</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Projects</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Total Blinds</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Completed</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Critical</th>
                          <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Completion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(areaSummaries ?? []).map((a) => (
                          <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{a.code}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{a.name}</td>
                            <td className="px-4 py-3 text-slate-500">{a.location ?? "—"}</td>
                            <td className="px-4 py-3 text-center font-semibold">{a.projectCount}</td>
                            <td className="px-4 py-3 text-center font-semibold">{a.totalBlinds}</td>
                            <td className="px-4 py-3 text-center font-semibold text-emerald-600">{a.completedBlinds}</td>
                            <td className="px-4 py-3 text-center font-bold text-red-500">{a.criticalBlinds}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${a.completionRate}%` }} />
                                </div>
                                <span className="text-xs font-bold">{a.completionRate}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(areaSummaries ?? []).length === 0 && (
                      <div className="py-12 text-center text-slate-400">No areas found.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Advanced Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleAdvancedExport}
        recordCounts={{
          projects: projectSummaries?.length ?? 0,
          blinds: blindsData?.length ?? 0,
          areas: areaSummaries?.length ?? 0,
        }}
      />
    </div>
  );
}
