import { Download, FileText, Plus, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickActionsProps {
  onAddBlind?: () => void;
  onBulkPaste?: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "outline";
  disabled?: boolean;
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "outline",
  disabled = false,
}: ActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant={variant}
      disabled={disabled}
      className="h-auto flex-col gap-2 rounded-xl p-4 text-center"
    >
      <div className="flex justify-center">{icon}</div>
      <span className="text-xs font-semibold">{label}</span>
    </Button>
  );
}

export function QuickActions({
  onAddBlind,
  onBulkPaste,
  onPrint,
  onExport,
  onRefresh,
  isLoading = false,
}: QuickActionsProps) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-900">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <ActionButton
            icon={<Plus className="h-5 w-5" />}
            label="Add Blind"
            onClick={onAddBlind}
            variant="default"
            disabled={isLoading}
          />
          <ActionButton
            icon={<Upload className="h-5 w-5" />}
            label="Bulk Paste"
            onClick={onBulkPaste}
            disabled={isLoading}
          />
          <ActionButton
            icon={<FileText className="h-5 w-5" />}
            label="Print Report"
            onClick={onPrint}
            disabled={isLoading}
          />
          <ActionButton
            icon={<Download className="h-5 w-5" />}
            label="Export Data"
            onClick={onExport}
            disabled={isLoading}
          />
          <ActionButton
            icon={<RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />}
            label="Refresh"
            onClick={onRefresh}
            disabled={isLoading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
