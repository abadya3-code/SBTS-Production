import { Card, CardContent } from "@/components/ui/card";
import {
  useCertificateSettings,
  openPrintWindow,
} from "@/hooks/useCertificateSettings";
import { ReportTemplate } from "./ReportTemplate";

interface StatisticsData {
  totalBlinds: number;
  completedBlinds: number;
  inProgressBlinds: number;
  criticalBlinds: number;
  highPriorityBlinds: number;
  normalPriorityBlinds: number;
  lowPriorityBlinds: number;
  completionRate: number;
  averageTimePerBlind?: number;
}

interface StatisticsReportProps {
  projectName: string;
  statistics: StatisticsData;
  onExportExcel?: () => void;
}

export function StatisticsReport({
  projectName,
  statistics,
  onExportExcel,
}: StatisticsReportProps) {
  const { settings } = useCertificateSettings();

  const handlePrint = () => {
    const priorityRows = [
      { label: "Critical", count: statistics.criticalBlinds, pct: statistics.totalBlinds > 0 ? Math.round((statistics.criticalBlinds / statistics.totalBlinds) * 100) : 0, color: "#b91c1c" },
      { label: "High", count: statistics.highPriorityBlinds, pct: statistics.totalBlinds > 0 ? Math.round((statistics.highPriorityBlinds / statistics.totalBlinds) * 100) : 0, color: "#a16207" },
      { label: "Normal", count: statistics.normalPriorityBlinds, pct: statistics.totalBlinds > 0 ? Math.round((statistics.normalPriorityBlinds / statistics.totalBlinds) * 100) : 0, color: "#0369a1" },
      { label: "Low", count: statistics.lowPriorityBlinds, pct: statistics.totalBlinds > 0 ? Math.round((statistics.lowPriorityBlinds / statistics.totalBlinds) * 100) : 0, color: "#15803d" },
    ];

    const body = `
      <div class="section-title">Project: ${projectName}</div>

      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-number">${statistics.totalBlinds}</div>
          <div class="stat-label">Total Blinds</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#15803d;">${statistics.completedBlinds}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#a16207;">${statistics.inProgressBlinds}</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#0369a1;">${Math.round(statistics.completionRate)}%</div>
          <div class="stat-label">Completion Rate</div>
        </div>
      </div>

      <div class="section-title">Priority Distribution</div>
      <table>
        <thead>
          <tr>
            <th>Priority Level</th>
            <th style="text-align:center;">Count</th>
            <th style="text-align:center;">Percentage</th>
            <th>Distribution</th>
          </tr>
        </thead>
        <tbody>
          ${priorityRows
            .map(
              (row) => `
            <tr>
              <td><span style="font-weight:700;color:${row.color};">${row.label}</span></td>
              <td style="text-align:center;font-weight:700;">${row.count}</td>
              <td style="text-align:center;">${row.pct}%</td>
              <td>
                <div style="background:#e2e8f0;height:8px;border-radius:4px;overflow:hidden;">
                  <div style="width:${row.pct}%;height:100%;background:${row.color};"></div>
                </div>
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <div class="section-title" style="margin-top:20px;">Status Distribution</div>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th style="text-align:center;">Count</th>
            <th style="text-align:center;">Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span style="color:#15803d;font-weight:700;">Completed</span></td>
            <td style="text-align:center;">${statistics.completedBlinds}</td>
            <td style="text-align:center;">${statistics.totalBlinds > 0 ? Math.round((statistics.completedBlinds / statistics.totalBlinds) * 100) : 0}%</td>
          </tr>
          <tr>
            <td><span style="color:#a16207;font-weight:700;">In Progress</span></td>
            <td style="text-align:center;">${statistics.inProgressBlinds}</td>
            <td style="text-align:center;">${statistics.totalBlinds > 0 ? Math.round((statistics.inProgressBlinds / statistics.totalBlinds) * 100) : 0}%</td>
          </tr>
        </tbody>
      </table>

      ${statistics.averageTimePerBlind !== undefined ? `
        <div class="section-title" style="margin-top:20px;">Performance Metrics</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Average Time Per Blind</div>
            <div class="info-value">${statistics.averageTimePerBlind} days</div>
          </div>
        </div>
      ` : ""}
    `;

    openPrintWindow(body, settings, "Statistics Report", `${projectName} - Statistics`);
  };

  const priorityItems = [
    { label: "Critical", count: statistics.criticalBlinds, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
    { label: "High", count: statistics.highPriorityBlinds, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Normal", count: statistics.normalPriorityBlinds, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "Low", count: statistics.lowPriorityBlinds, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  ];

  return (
    <ReportTemplate
      reportType="statistics"
      title="Statistics Report"
      description="Comprehensive statistics and KPIs for the project"
      data={{ projectName, statistics }}
      onPrint={handlePrint}
      onExportPDF={handlePrint}
      onExportExcel={onExportExcel}
    >
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Total Blinds", value: statistics.totalBlinds, color: "text-foreground" },
            { label: "Completed", value: statistics.completedBlinds, color: "text-emerald-600" },
            { label: "In Progress", value: statistics.inProgressBlinds, color: "text-amber-600" },
            { label: "Completion Rate", value: `${Math.round(statistics.completionRate)}%`, color: "text-accent" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/30 p-3 text-center">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Priority Distribution */}
        <Card className="border-border bg-muted/20">
          <CardContent className="pt-4 pb-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Priority Distribution</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {priorityItems.map((item) => (
                <div key={item.label} className={`rounded-lg ${item.bg} p-3`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${item.color}`}>{item.label}</span>
                    <span className={`text-lg font-bold ${item.color}`}>{item.count}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-current opacity-60"
                      style={{
                        width: `${statistics.totalBlinds > 0 ? (item.count / statistics.totalBlinds) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
