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

export type ProjectRegisterPdfSpec = {
  filename: string;
  title: string;
  subtitle: string;
  summaryHead: string[][];
  summaryBody: Array<Array<string | number>>;
  blindHead: string[][];
  blindRows: Array<Array<string | number>>;
  footerText: string;
};

export function safePdfFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "sbts-package";
}

export function buildProjectRegisterPdfSpec(project: PdfExportProject, blinds: PdfExportBlind[], metrics: PdfExportMetrics, generatedAt = new Date().toLocaleString()): ProjectRegisterPdfSpec {
  return {
    filename: `${safePdfFileName(project.id)}-blind-register.pdf`,
    title: "SBTS Project Blind Register",
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
