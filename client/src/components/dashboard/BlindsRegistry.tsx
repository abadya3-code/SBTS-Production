import { ChevronDown, ChevronLeft, ChevronRight, Download, Edit2, Eye, FileJson, MoreVertical, Search, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { escapePrintHtml, openSanitizedPrintWindow } from "@/lib/printSecurity";

type BlindPriority = "Low" | "Normal" | "High" | "Critical";
type BlindType = "Slip Blind" | "Drop Spool" | "Isolation";

interface BlindRecord {
  id: string;
  tag: string;
  type: BlindType;
  size: string;
  rate: string | null;
  phase: string;
  legacyPhase?: string | null;
  lifecycleStatus?: string | null;
  workflowLocked?: boolean;
  owner: string;
  priority: BlindPriority;
  equipment: string | null;
  location: string | null;
}

interface BlindsRegistryProps {
  blinds: BlindRecord[];
  isLoading?: boolean;
  onView?: (blindId: string) => void;
  onEdit?: (blindId: string) => void;
  onDelete?: (blindId: string) => void;
}

const phaseColors: Record<string, string> = {
  "Broken / Preparation": "bg-amber-50 text-amber-700 ring-amber-200",
  Assembly: "bg-blue-50 text-blue-700 ring-blue-200",
  "Tight & Torque": "bg-purple-50 text-purple-700 ring-purple-200",
  "Final Tight": "bg-green-50 text-green-700 ring-green-200",
  "Inspection Ready": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Operations Initial Isolation": "bg-teal-50 text-teal-800 ring-teal-200",
  "Blind Installation & Controlled Tightening": "bg-amber-50 text-amber-800 ring-amber-200",
  "Independent Mechanical Verification": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "Internal Inspection & Work Execution": "bg-blue-50 text-blue-800 ring-blue-200",
  "Reinstatement Preparation & Authorization": "bg-violet-50 text-violet-800 ring-violet-200",
  "Blind Removal & Reinstatement": "bg-orange-50 text-orange-800 ring-orange-200",
  "Independent Reinstatement Verification & Leak Test": "bg-sky-50 text-sky-800 ring-sky-200",
  "Final Approval & Return to Service": "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

function phaseColor(phase: string) {
  return phaseColors[phase] ?? "bg-slate-50 text-slate-700 ring-slate-200";
}

const priorityColors: Record<BlindPriority, string> = {
  Low: "bg-slate-50 text-slate-700 ring-slate-200",
  Normal: "bg-blue-50 text-blue-700 ring-blue-200",
  High: "bg-orange-50 text-orange-700 ring-orange-200",
  Critical: "bg-red-50 text-red-700 ring-red-200",
};

function escapeCSV(value: string | null | undefined): string {
  if (!value) return "";
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

function generateCSV(blinds: BlindRecord[]): string {
  const headers = ["Tag", "Type", "Size", "Rate", "Phase", "Priority", "Owner", "Equipment", "Location"];
  const rows = blinds.map((blind) => [
    blind.tag,
    blind.type,
    blind.size,
    blind.rate || "",
    blind.phase,
    blind.priority,
    blind.owner,
    blind.equipment || "",
    blind.location || "",
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  return csvContent;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BlindsRegistry({
  blinds,
  isLoading = false,
  onView,
  onEdit,
  onDelete,
}: BlindsRegistryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"tag" | "phase" | "priority">("tag");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 when search term changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Reset to page 1 when sort changes
  const handleSortChange = (value: "tag" | "phase" | "priority") => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const filteredBlinds = useMemo(
    () =>
      blinds.filter(
        (blind) =>
          blind.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
          blind.equipment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          blind.owner.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [blinds, searchTerm]
  );

  const sortedBlinds = useMemo(
    () => {
      const sorted = [...filteredBlinds].sort((a, b) => {
        if (sortBy === "tag") return a.tag.localeCompare(b.tag);
        if (sortBy === "phase") return a.phase.localeCompare(b.phase);
        if (sortBy === "priority") return a.priority.localeCompare(b.priority);
        return 0;
      });
      return sorted;
    },
    [filteredBlinds, sortBy]
  );

  const totalPages = Math.max(1, Math.ceil(sortedBlinds.length / pageSize));
  // Ensure currentPage doesn't exceed totalPages
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedBlinds = sortedBlinds.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    const validPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(validPage);
  };

  const handlePageSizeChange = (size: string) => {
    const newSize = parseInt(size, 10);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const csv = generateCSV(sortedBlinds);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadFile(`blinds-registry-${timestamp}.csv`, csv, "text/csv;charset=utf-8;");
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(sortedBlinds, null, 2);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadFile(`blinds-registry-${timestamp}.json`, json, "application/json;charset=utf-8;");
  };

  const handleExportPDF = () => {
    // Generate simple PDF-like HTML for printing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Blinds Registry Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: white; }
            h1 { text-align: center; color: #0f172a; margin-bottom: 20px; }
            .meta { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #0f172a; color: white; padding: 12px; text-align: left; font-weight: bold; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .tag { font-weight: bold; }
            .phase, .priority { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Blinds Registry Report</h1>
          <div class="meta">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Total Records: ${sortedBlinds.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Type</th>
                <th>Size</th>
                <th>Phase</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Equipment</th>
              </tr>
            </thead>
            <tbody>
              ${sortedBlinds
                .map(
                  (blind) => `
                <tr>
                  <td class="tag">${escapePrintHtml(blind.tag)}</td>
                  <td>${escapePrintHtml(blind.type)}</td>
                  <td>${escapePrintHtml(blind.size)}</td>
                  <td class="phase">${escapePrintHtml(blind.phase)}</td>
                  <td class="priority">${escapePrintHtml(blind.priority)}</td>
                  <td>${escapePrintHtml(blind.owner)}</td>
                  <td>${escapePrintHtml(blind.equipment || "-")}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    openSanitizedPrintWindow(htmlContent, {
      onBlocked: () => console.error("Failed to open print window"),
    });
  };

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg font-bold text-foreground">
            Blinds Registry ({sortedBlinds.length})
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by tag, equipment, owner..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Sort by {sortBy}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSortChange("tag")}>
                  Tag
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange("phase")}>
                  Phase
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange("priority")}>
                  Priority
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                  <Download className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportJSON} className="cursor-pointer">
                  <FileJson className="mr-2 h-4 w-4" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                  <Download className="mr-2 h-4 w-4" />
                  Print as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {sortedBlinds.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              {blinds.length === 0 ? "No blinds registered yet" : "No blinds match your search"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {paginatedBlinds.map((blind, index) => (
                <div key={blind.id} className="border border-border rounded-xl p-4 bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{startIndex + index + 1}</span>
                      <span className="font-bold text-foreground text-sm">{blind.tag}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView?.(blind.id)} className="cursor-pointer">
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit?.(blind.id)} className="cursor-pointer">
                          <Edit2 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {onDelete && (
                          <DropdownMenuItem onClick={() => onDelete(blind.id)} className="cursor-pointer text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${phaseColor(blind.phase)}`}>{blind.phase}</span>
                    {blind.lifecycleStatus && <span className="inline-flex rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-bold text-white">{blind.lifecycleStatus.replaceAll("_", " ")}</span>}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${priorityColors[blind.priority]}`}>{blind.priority}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{blind.type}</span></div>
                    <div><span className="text-muted-foreground">Size:</span> <span className="font-medium">{blind.size}</span></div>
                    <div><span className="text-muted-foreground">Owner:</span> <span className="font-medium">{blind.owner}</span></div>
                    <div><span className="text-muted-foreground">Equipment:</span> <span className="font-medium">{blind.equipment || "-"}</span></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBlinds.map((blind, index) => (
                    <TableRow key={blind.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {startIndex + index + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {blind.tag}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {blind.type}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {blind.size}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
                            phaseColor(blind.phase)
                          }`}
                        >
                          {blind.phase}
                        </span>
                        {blind.lifecycleStatus && (
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {blind.lifecycleStatus.replaceAll("_", " ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
                            priorityColors[blind.priority]
                          }`}
                        >
                          {blind.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {blind.owner}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {blind.equipment || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onView?.(blind.id)}
                              className="cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onEdit?.(blind.id)}
                              className="cursor-pointer"
                            >
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {onDelete && (
                              <DropdownMenuItem
                                onClick={() => onDelete(blind.id)}
                                className="cursor-pointer text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-muted-foreground">
                Showing {sortedBlinds.length === 0 ? 0 : startIndex + 1} to{" "}
                {Math.min(endIndex, sortedBlinds.length)} of {sortedBlinds.length} records
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(validCurrentPage - 1)}
                  disabled={validCurrentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5) {
                      if (validCurrentPage > 3) {
                        pageNum = validCurrentPage - 2 + i;
                      }
                      if (pageNum > totalPages) {
                        pageNum = totalPages - 4 + i;
                      }
                    }
                    return pageNum > 0 && pageNum <= totalPages ? (
                      <Button
                        key={pageNum}
                        variant={validCurrentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    ) : null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(validCurrentPage + 1)}
                  disabled={validCurrentPage === totalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
