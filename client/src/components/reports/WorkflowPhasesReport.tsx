import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  useCertificateSettings,
  openPrintWindow,
} from "@/hooks/useCertificateSettings";
import { ReportTemplate } from "./ReportTemplate";

interface PhaseData {
  name: string;
  owner: string;
  blindCount: number;
  completedCount: number;
  progress: number;
  color: string;
}

interface WorkflowPhasesReportProps {
  projectName: string;
  phases: PhaseData[];
  onExportExcel?: () => void;
}

export function WorkflowPhasesReport({
  projectName,
  phases,
  onExportExcel,
}: WorkflowPhasesReportProps) {
  const { settings } = useCertificateSettings();

  const handlePrint = () => {
    const phasesRows = phases
      .map(
        (phase, i) => `
        <tr>
          <td>${i + 1}</td>
          <td style="font-weight:600;">${phase.name}</td>
          <td>${phase.owner}</td>
          <td style="text-align:center;">${phase.blindCount}</td>
          <td style="text-align:center;">${phase.completedCount}</td>
          <td style="text-align:center;">${phase.blindCount - phase.completedCount}</td>
          <td style="text-align:center;">
            <span style="font-weight:700;color:${phase.color};">${phase.progress}%</span>
          </td>
        </tr>
      `
      )
      .join("");

    const totalBlinds = phases.reduce((s, p) => s + p.blindCount, 0);
    const totalCompleted = phases.reduce((s, p) => s + p.completedCount, 0);
    const overallProgress = totalBlinds > 0 ? Math.round((totalCompleted / totalBlinds) * 100) : 0;

    const body = `
      <div class="section-title">Project: ${projectName}</div>

      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-number">${phases.length}</div>
          <div class="stat-label">Total Phases</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${totalBlinds}</div>
          <div class="stat-label">Total Blinds</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#15803d;">${totalCompleted}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${overallProgress}%</div>
          <div class="stat-label">Overall Progress</div>
        </div>
      </div>

      <div class="section-title">Phase Details</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Phase Name</th>
            <th>Phase Owner</th>
            <th style="text-align:center;">Total</th>
            <th style="text-align:center;">Done</th>
            <th style="text-align:center;">Remaining</th>
            <th style="text-align:center;">Progress</th>
          </tr>
        </thead>
        <tbody>
          ${phasesRows}
        </tbody>
        <tfoot>
          <tr style="background:#f1f5f9;font-weight:700;">
            <td colspan="3">Total</td>
            <td style="text-align:center;">${totalBlinds}</td>
            <td style="text-align:center;">${totalCompleted}</td>
            <td style="text-align:center;">${totalBlinds - totalCompleted}</td>
            <td style="text-align:center;">${overallProgress}%</td>
          </tr>
        </tfoot>
      </table>
    `;

    openPrintWindow(body, settings, "Workflow Phases Report", `${projectName} - Workflow Phases`);
  };

  const totalBlinds = phases.reduce((s, p) => s + p.blindCount, 0);
  const totalCompleted = phases.reduce((s, p) => s + p.completedCount, 0);

  return (
    <ReportTemplate
      reportType="workflow-phases"
      title="Workflow Phases Report"
      description="Detailed breakdown of workflow phases and phase ownership"
      data={{ projectName, phases }}
      onPrint={handlePrint}
      onExportPDF={handlePrint}
      onExportExcel={onExportExcel}
    >
      <div className="space-y-4">
        {/* Summary Row */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Total Phases", value: phases.length, color: "text-foreground" },
            { label: "Total Blinds", value: totalBlinds, color: "text-foreground" },
            { label: "Completed", value: totalCompleted, color: "text-emerald-600" },
            {
              label: "Overall Progress",
              value: `${totalBlinds > 0 ? Math.round((totalCompleted / totalBlinds) * 100) : 0}%`,
              color: "text-accent",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/30 p-3 text-center">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Phase Cards */}
        {phases.map((phase, index) => (
          <Card key={index} className="border-border bg-muted/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: phase.color }}
                    />
                    <p className="font-semibold text-foreground truncate">{phase.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Owner: {phase.owner}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
                  <span>{phase.completedCount}/{phase.blindCount} blinds</span>
                  <span className="font-bold text-foreground">{phase.progress}%</span>
                </div>
              </div>
              <Progress value={phase.progress} className="mt-3 h-2" />
            </CardContent>
          </Card>
        ))}

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
