import { Badge } from "@/components/ui/badge";
import {
  useCertificateSettings,
  openPrintWindow,
} from "@/hooks/useCertificateSettings";
import { ReportTemplate } from "./ReportTemplate";

interface BlindData {
  tag: string;
  equipment: string;
  location: string;
  phase: string;
  priority: string;
  owner: string;
  status: string;
}

interface BlindsDetailedReportProps {
  projectName: string;
  blinds: BlindData[];
  onExportExcel?: () => void;
}

const priorityColors: Record<string, string> = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Normal: "bg-blue-100 text-blue-800",
  Low: "bg-gray-100 text-gray-800",
};

const statusColors: Record<string, string> = {
  "Not Started": "bg-slate-100 text-slate-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Completed: "bg-emerald-100 text-emerald-800",
  "On Hold": "bg-purple-100 text-purple-800",
};

const priorityPrintColors: Record<string, string> = {
  Critical: "#b91c1c",
  High: "#a16207",
  Normal: "#0369a1",
  Low: "#374151",
};

const statusPrintColors: Record<string, string> = {
  "Not Started": "#475569",
  "In Progress": "#a16207",
  Completed: "#15803d",
  "On Hold": "#7c3aed",
};

export function BlindsDetailedReport({
  projectName,
  blinds,
  onExportExcel,
}: BlindsDetailedReportProps) {
  const { settings } = useCertificateSettings();

  const handlePrint = () => {
    const blindsRows = blinds
      .map(
        (blind, index) => `
        <tr>
          <td style="text-align:center;">${index + 1}</td>
          <td style="font-weight:700;">${blind.tag}</td>
          <td>${blind.equipment}</td>
          <td>${blind.location}</td>
          <td>${blind.phase}</td>
          <td><span style="font-weight:700;color:${priorityPrintColors[blind.priority] ?? "#374151"};">${blind.priority}</span></td>
          <td>${blind.owner}</td>
          <td><span style="font-weight:700;color:${statusPrintColors[blind.status] ?? "#374151"};">${blind.status}</span></td>
        </tr>
      `
      )
      .join("");

    const completedCount = blinds.filter((b) => b.status === "Completed").length;
    const inProgressCount = blinds.filter((b) => b.status === "In Progress").length;
    const criticalCount = blinds.filter((b) => b.priority === "Critical").length;

    const body = `
      <div class="section-title">Project: ${projectName}</div>

      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-number">${blinds.length}</div>
          <div class="stat-label">Total Blinds</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#15803d;">${completedCount}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#a16207;">${inProgressCount}</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#b91c1c;">${criticalCount}</div>
          <div class="stat-label">Critical</div>
        </div>
      </div>

      <div class="section-title">Blinds Registry</div>
      <table>
        <thead>
          <tr>
            <th style="text-align:center;">#</th>
            <th>Tag</th>
            <th>Equipment</th>
            <th>Location</th>
            <th>Phase</th>
            <th>Priority</th>
            <th>Owner</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${blindsRows}
        </tbody>
      </table>
    `;

    openPrintWindow(body, settings, "Blinds Detailed Report", `${projectName} - Blinds Registry`);
  };

  return (
    <ReportTemplate
      reportType="blinds-detailed"
      title="Blinds Detailed Report"
      description="Complete registry of all blinds with full details"
      data={{ projectName, blinds }}
      onPrint={handlePrint}
      onExportPDF={handlePrint}
      onExportExcel={onExportExcel}
    >
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Total Blinds", value: blinds.length, color: "text-foreground" },
            { label: "Completed", value: blinds.filter((b) => b.status === "Completed").length, color: "text-emerald-600" },
            { label: "In Progress", value: blinds.filter((b) => b.status === "In Progress").length, color: "text-amber-600" },
            { label: "Critical", value: blinds.filter((b) => b.priority === "Critical").length, color: "text-red-600" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/30 p-3 text-center">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tag</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equipment</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phase</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {blinds.map((blind, index) => (
                <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-foreground">{blind.tag}</td>
                  <td className="px-3 py-2 text-foreground">{blind.equipment}</td>
                  <td className="px-3 py-2 text-muted-foreground">{blind.location}</td>
                  <td className="px-3 py-2 text-muted-foreground">{blind.phase}</td>
                  <td className="px-3 py-2">
                    <Badge className={`text-xs ${priorityColors[blind.priority] ?? "bg-gray-100 text-gray-800"}`}>
                      {blind.priority}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={`text-xs ${statusColors[blind.status] ?? "bg-gray-100 text-gray-800"}`}>
                      {blind.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Certificate Settings Applied Notice */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <span className="font-semibold">Certificate Settings Applied: </span>
          Print output will use <strong>{settings.headerCompanyName}</strong> header,{" "}
          <strong>{settings.paperSize} {settings.orientation}</strong> paper,
          {settings.logoUrl ? " with company logo," : " without logo,"}
          {" "}and <strong>{[settings.signature1Label, settings.signature2Label, settings.signature3Label].join(" / ")}</strong> signature blocks.
        </div>
      </div>
    </ReportTemplate>
  );
}
