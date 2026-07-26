import { BarChart3, Building2, Download, FileJson, Printer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCertificateSettings } from "@/hooks/useCertificateSettings";

export type ReportType =
  | "project-summary"
  | "workflow-phases"
  | "blinds-detailed"
  | "statistics";

interface ReportTemplateProps {
  reportType: ReportType;
  title: string;
  description: string;
  data: Record<string, unknown>;
  onPrint?: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  children?: React.ReactNode;
}

const reportIcons: Record<ReportType, React.ReactNode> = {
  "project-summary": <FileJson className="h-5 w-5" />,
  "workflow-phases": <TrendingUp className="h-5 w-5" />,
  "blinds-detailed": <BarChart3 className="h-5 w-5" />,
  statistics: <TrendingUp className="h-5 w-5" />,
};

export function ReportTemplate({
  reportType,
  title,
  description,
  data,
  onPrint,
  onExportPDF,
  onExportExcel,
  children,
}: ReportTemplateProps) {
  const { settings, isLoading: settingsLoading } = useCertificateSettings();

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent/10 p-2 text-accent">
              {reportIcons[reportType]}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-bold text-foreground">
                {title}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExportPDF} className="cursor-pointer">
                  <Download className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportExcel} className="cursor-pointer">
                  <FileJson className="mr-2 h-4 w-4" />
                  Export as Excel/CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Certificate Settings Preview Banner */}
        {settingsLoading ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-48" />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt="Company Logo"
                className="h-6 max-w-[80px] object-contain"
              />
            )}
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Building2 className="h-3 w-3" />
              {settings.headerCompanyName}
            </span>
            <span>·</span>
            <span>{settings.certificateTitle}</span>
            <span>·</span>
            <span>{settings.paperSize} {settings.orientation}</span>
            {(settings.signature1Name || settings.signature2Name || settings.signature3Name) && (
              <>
                <span>·</span>
                <span>
                  Signatures:{" "}
                  {[settings.signature1Name, settings.signature2Name, settings.signature3Name]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {/* Report Content */}
          {children}

          {/* Report Metadata */}
          <div className="border-t border-border pt-4">
            <div className="grid gap-1 text-xs text-muted-foreground">
              {settings.showGenerationDate && (
                <p>Generated on: {new Date().toLocaleString()}</p>
              )}
              <p>Report Type: {reportType}</p>
              {settings.showSystemVersion && (
                <p>System: SBTS - Smart Blind Tracking System</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
