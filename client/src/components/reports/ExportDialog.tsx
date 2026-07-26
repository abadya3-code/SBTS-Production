/**
 * ExportDialog.tsx
 * ─────────────────
 * Advanced export dialog with format selection, scope options, and preview summary.
 * Supports PDF, Excel (XLSX), CSV, and JSON exports.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText, FileSpreadsheet, Download, Loader2, CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

export type ExportFormat = "pdf" | "excel" | "csv" | "json";
export type ExportScope = "executive" | "projects" | "blinds" | "areas";

export interface ExportOptions {
  format: ExportFormat;
  scopes: ExportScope[];
  includeSignatures: boolean;
  includePhaseChart: boolean;
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  recordCounts: {
    projects: number;
    blinds: number;
    areas: number;
  };
}

// ─── Format Card ──────────────────────────────────────────────────────────

function FormatCard({
  format, label, description, icon: Icon, color, selected, onClick,
}: {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200
        ${selected
          ? "border-cyan-500 bg-cyan-500/5 shadow-sm"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }
      `}
    >
      {selected && (
        <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-cyan-500" />
      )}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${color}18` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500">{description}</div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function ExportDialog({ open, onClose, onExport, recordCounts }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [scopes, setScopes] = useState<ExportScope[]>(["projects", "blinds", "areas"]);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includePhaseChart, setIncludePhaseChart] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const toggleScope = (scope: ExportScope) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleExport = async () => {
    if (scopes.length === 0) return;
    setIsExporting(true);
    try {
      await onExport({ format, scopes, includeSignatures, includePhaseChart });
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  const scopeLabels: Record<ExportScope, { label: string; count: number }> = {
    executive: { label: "Executive Summary", count: 0 },
    projects: { label: "Projects", count: recordCounts.projects },
    blinds: { label: "Blinds Registry", count: recordCounts.blinds },
    areas: { label: "Areas Overview", count: recordCounts.areas },
  };

  const isPDF = format === "pdf";
  const isCSV = format === "csv";
  const isJSON = format === "json";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="h-5 w-5 text-cyan-500" />
            Export Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Format Selection */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 block">
              Export Format
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <FormatCard
                format="excel"
                label="Excel (XLSX)"
                description="Multi-sheet workbook with full data"
                icon={FileSpreadsheet}
                color="#22c55e"
                selected={format === "excel"}
                onClick={() => setFormat("excel")}
              />
              <FormatCard
                format="pdf"
                label="PDF Report"
                description="Branded printable document"
                icon={FileText}
                color="#ef4444"
                selected={format === "pdf"}
                onClick={() => setFormat("pdf")}
              />
              <FormatCard
                format="csv"
                label="CSV"
                description="Plain data for spreadsheets"
                icon={Download}
                color="#f59e0b"
                selected={format === "csv"}
                onClick={() => setFormat("csv")}
              />
              <FormatCard
                format="json"
                label="JSON"
                description="Raw data for integrations"
                icon={Download}
                color="#8b5cf6"
                selected={format === "json"}
                onClick={() => setFormat("json")}
              />
            </div>
          </div>

          <Separator />

          {/* Scope Selection */}
          <div>
            <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 block">
              Data to Include
            </Label>
            <div className="space-y-2.5">
              {(Object.entries(scopeLabels) as [ExportScope, { label: string; count: number }][]).map(
                ([scope, { label, count }]) => (
                  <div key={scope} className="flex items-center gap-3">
                    <Checkbox
                      id={`scope-${scope}`}
                      checked={scopes.includes(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                      className="border-slate-300"
                    />
                    <Label htmlFor={`scope-${scope}`} className="flex-1 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                      {label}
                    </Label>
                    {count > 0 && (
                      <Badge variant="outline" className="text-xs text-slate-400">
                        {count} records
                      </Badge>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* PDF-specific options */}
          {isPDF && (
            <>
              <Separator />
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 block">
                  PDF Options
                </Label>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="signatures"
                      checked={includeSignatures}
                      onCheckedChange={(c) => setIncludeSignatures(!!c)}
                    />
                    <Label htmlFor="signatures" className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                      Include signature blocks
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="phase-chart"
                      checked={includePhaseChart}
                      onCheckedChange={(c) => setIncludePhaseChart(!!c)}
                    />
                    <Label htmlFor="phase-chart" className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
                      Include phase distribution chart
                    </Label>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  PDF uses Certificate Settings (logo, paper size, orientation, footer).
                </p>
              </div>
            </>
          )}

          {/* CSV/JSON note */}
          {(isCSV || isJSON) && (
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              {isCSV
                ? "CSV exports one file per selected data type. Multi-scope exports will download multiple files."
                : "JSON export includes all selected data in a single structured file with metadata."}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || scopes.length === 0}
            className="gap-2 bg-slate-950 hover:bg-slate-800 text-white"
          >
            {isExporting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Exporting...</>
            ) : (
              <><Download className="h-4 w-4" />Export</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
