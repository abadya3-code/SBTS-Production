export type PdfBlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
export type PdfBlindPriority = "Low" | "Normal" | "High" | "Critical";

export type PdfExportProject = {
  id: string;
  name: string;
  areaCode: string;
  areaName: string;
  status: string;
  description: string | null;
  progress: number;
};

export type PdfExportMetrics = {
  registeredBlinds: number;
  plannedBlinds: number;
  highPriorityBlinds: number;
  criticalBlinds: number;
  inspectionReadyBlinds: number;
};

export type PdfExportBlind = {
  tag: string;
  type: string;
  size: string;
  rate: string | null;
  phase: PdfBlindPhase;
  owner: string;
  priority: PdfBlindPriority;
  equipment: string | null;
  location: string | null;
  isolationPoint: string | null;
  slipMetalForemanApproved: boolean;
  slipBlindMerged: boolean;
  notes: string | null;
};

export type CertificatePdfSpec = {
  filename: string;
  title: string;
  subtitle: string;
  summaryHead: string[][];
  summaryBody: Array<Array<string | number>>;
  blindHead: string[][];
  blindRows: Array<Array<string | number>>;
  footerText: string;
};

export type TagPdfPageSpec = {
  priority: PdfBlindPriority;
  tag: string;
  rows: string[][];
  qrLabel: string;
  footerText: string;
};

export type TagsPdfSpec = {
  filename: string;
  emptyMessage: string;
  pages: TagPdfPageSpec[];
};

export function safePdfFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "sbts-package";
}

export function buildCertificatePdfTableSpec(project: PdfExportProject, blinds: PdfExportBlind[], metrics: PdfExportMetrics, generatedAt = new Date().toLocaleString()): CertificatePdfSpec {
  return {
    filename: `${safePdfFileName(project.id)}-certificates.pdf`,
    title: "SBTS Unified Certificate Package",
    subtitle: `${project.id} · ${project.name} · Generated ${generatedAt}`,
    summaryHead: [["Metric", "Planned", "Registered", "High", "Critical", "Inspection Ready", "Progress"]],
    summaryBody: [["Project summary", metrics.plannedBlinds, metrics.registeredBlinds, metrics.highPriorityBlinds, metrics.criticalBlinds, metrics.inspectionReadyBlinds, `${project.progress}%`]],
    blindHead: [["#", "Blind Tag", "Type / Size", "Phase", "Priority", "Owner", "Isolation", "Slip Gate", "Notes"]],
    blindRows: blinds.map((blind, index) => [
      index + 1,
      `${blind.tag}\n${blind.equipment || "No equipment"}`,
      `${blind.type}\n${blind.size}${blind.rate ? ` · Rate ${blind.rate}` : ""}`,
      blind.phase,
      blind.priority,
      blind.owner,
      blind.isolationPoint || "Not specified",
      blind.type === "Slip Blind" ? `${blind.slipMetalForemanApproved ? "Foreman OK" : "Foreman pending"} / ${blind.slipBlindMerged ? "Merged" : "Not merged"}` : "N/A",
      blind.notes || "",
    ]),
    footerText: `Area: ${project.areaCode} · ${project.areaName}`,
  };
}

export function buildTagsPdfSpec(project: PdfExportProject, blinds: PdfExportBlind[], generatedAt = new Date().toLocaleString()): TagsPdfSpec {
  return {
    filename: `${safePdfFileName(project.id)}-blind-tags.pdf`,
    emptyMessage: "No blind tags available.",
    pages: blinds.map((blind) => ({
      priority: blind.priority,
      tag: blind.tag,
      rows: [
        ["Project", project.id],
        ["Equipment", blind.equipment || "N/A"],
        ["Type / Size", `${blind.type} · ${blind.size}${blind.rate ? ` · Rate ${blind.rate}` : ""}`],
        ["Phase", blind.phase],
        ["Phase Owner", blind.owner],
        ["Isolation", blind.isolationPoint || "N/A"],
        ["Location", blind.location || "N/A"],
      ],
      qrLabel: blind.tag,
      footerText: `${project.areaCode} · Generated ${generatedAt}`,
    })),
  };
}
