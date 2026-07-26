import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useCertificateSettings,
  openPrintWindow,
} from "@/hooks/useCertificateSettings";
import { ReportTemplate } from "./ReportTemplate";

interface ProjectSummaryReportProps {
  projectId: string;
  projectName: string;
  areaName: string;
  status: string;
  progress: number;
  description?: string;
  startDate?: string;
  endDate?: string;
  totalBlinds: number;
  completedBlinds: number;
  onExportExcel?: () => void;
}

export function ProjectSummaryReport({
  projectId,
  projectName,
  areaName,
  status,
  progress,
  description,
  startDate,
  endDate,
  totalBlinds,
  completedBlinds,
  onExportExcel,
}: ProjectSummaryReportProps) {
  const { settings } = useCertificateSettings();
  const completionPercentage = totalBlinds > 0 ? (completedBlinds / totalBlinds) * 100 : 0;

  const handlePrint = () => {
    const body = `
      <div class="section-title">Project Information</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Project Name</div>
          <div class="info-value">${projectName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Project ID</div>
          <div class="info-value">${projectId}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Area</div>
          <div class="info-value">${areaName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value"><span class="badge badge-blue">${status}</span></div>
        </div>
      </div>
      ${description ? `<p style="color:#475569;font-size:13px;line-height:1.6;margin-bottom:20px;">${description}</p>` : ""}

      <div class="section-title">Progress & Statistics</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${totalBlinds}</div>
          <div class="stat-label">Total Blinds</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#15803d;">${completedBlinds}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:#a16207;">${totalBlinds - completedBlinds}</div>
          <div class="stat-label">In Progress</div>
        </div>
      </div>
      <div style="margin-top:15px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-weight:700;color:#0f172a;">Overall Completion</span>
          <span style="font-weight:700;color:#0f172a;">${Math.round(completionPercentage)}%</span>
        </div>
        <div style="background:#e2e8f0;height:10px;border-radius:5px;overflow:hidden;">
          <div style="width:${Math.min(100, Math.max(0, progress))}%;height:100%;background:linear-gradient(90deg,#0f172a,#1e293b);"></div>
        </div>
      </div>

      ${
        startDate || endDate
          ? `
        <div class="section-title" style="margin-top:20px;">Timeline</div>
        <div class="info-grid">
          ${startDate ? `<div class="info-item"><div class="info-label">Start Date</div><div class="info-value">${startDate}</div></div>` : ""}
          ${endDate ? `<div class="info-item"><div class="info-label">Expected End Date</div><div class="info-value">${endDate}</div></div>` : ""}
        </div>
      `
          : ""
      }
    `;

    openPrintWindow(body, settings, "Project Summary Report", `${projectName} - Summary`);
  };

  return (
    <ReportTemplate
      reportType="project-summary"
      title="Project Summary Report"
      description="Comprehensive overview of the project status and progress"
      data={{ projectId, projectName, areaName, status, progress, totalBlinds, completedBlinds }}
      onPrint={handlePrint}
      onExportPDF={handlePrint}
      onExportExcel={onExportExcel}
    >
      <div className="space-y-6">
        {/* Project Information */}
        <Card className="border-border bg-muted/30">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project Name</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{projectName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Project ID</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{projectId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Area</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{areaName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="mt-1 inline-flex rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                  {status}
                </p>
              </div>
            </div>
            {description && (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
            )}
          </CardContent>
        </Card>

        {/* Progress Section */}
        <Card className="border-border bg-muted/30">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Overall Progress</p>
                  <p className="text-sm font-semibold text-foreground">{progress}%</p>
                </div>
                <Progress value={progress} className="mt-2 h-2.5" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-background p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{totalBlinds}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Total Blinds</p>
                </div>
                <div className="rounded-lg bg-background p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{completedBlinds}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="rounded-lg bg-background p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{totalBlinds - completedBlinds}</p>
                  <p className="mt-1 text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Information */}
        {(startDate || endDate) && (
          <Card className="border-border bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {startDate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{startDate}</p>
                  </div>
                )}
                {endDate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Expected End Date</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{endDate}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
