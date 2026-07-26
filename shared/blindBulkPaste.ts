export type BulkBlindPhase = "Broken / Preparation" | "Assembly" | "Tight & Torque" | "Final Tight" | "Inspection Ready";
export type BulkBlindPriority = "Low" | "Normal" | "High" | "Critical";
export type BulkBlindType = "Slip Blind" | "Drop Spool" | "Isolation";

export const bulkBlindTypeOptions: BulkBlindType[] = ["Slip Blind", "Drop Spool", "Isolation"];
export const bulkPriorityOrder: BulkBlindPriority[] = ["Low", "Normal", "High", "Critical"];

export const bulkPasteColumns = [
  "Tag",
  "Type",
  "Size",
  "Rate",
  "Priority",
  "Equipment",
  "Location",
  "Isolation Point",
  "Foreman Metal Approved",
  "Slip Blind Merged",
  "Notes",
] as const;

export const bulkPasteExampleRow = "BLD-1401\tSlip Blind\t12 in\t300#\tNormal\tP-101A\tTrain header\tUpstream flange\tYes\tYes\tReady for certificate gate";

export type BulkBlindDraft = {
  tag: string;
  type: BulkBlindType;
  size: string;
  rate: string;
  phase: "Broken / Preparation";
  owner: string;
  priority: BulkBlindPriority;
  equipment: string;
  location: string;
  isolationPoint: string;
  slipMetalForemanApproved: boolean;
  slipBlindMerged: boolean;
  notes: string;
};

export function normalizeBulkPriority(value: string): BulkBlindPriority {
  const normalized = value.trim().toLowerCase();
  const match = bulkPriorityOrder.find((priority) => priority.toLowerCase() === normalized);
  return match ?? "Normal";
}

export function normalizeBulkBlindType(value: string): BulkBlindType {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = bulkBlindTypeOptions.find((type) => type.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized);
  return match ?? "Slip Blind";
}

export function parseBooleanBulkCell(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "yes", "y", "true", "approved", "done", "merged", "ok", "موافق", "نعم", "تم"].includes(normalized);
}

export function splitBulkLine(line: string) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(",")) return line.split(",");
  return line.split(/\s{2,}/);
}

function isBulkHeaderRow(row: string) {
  const cells = splitBulkLine(row).map((cell) => cell.trim().toLowerCase());
  return cells[0] === "tag" && ["type", "blind type"].includes(cells[1] ?? "") && cells.includes("size");
}

export function parseBulkPaste(text: string) {
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const errors: string[] = [];
  const parsed = rows
    .filter((row, index) => !(index === 0 && isBulkHeaderRow(row)))
    .map((row, index): BulkBlindDraft => {
      const cells = splitBulkLine(row).map((cell) => cell.trim());
      const [tag, type, size, rate, priority, equipment, location, isolationPoint, slipMetalForemanApproved, slipBlindMerged, notes] = cells;
      if (!tag || !type || !size) {
        errors.push(`Row ${index + 1}: tag, type, and size are required.`);
      }
      const blindType = normalizeBulkBlindType(type ?? "");
      return {
        tag: tag ?? "",
        type: blindType,
        size: size ?? "",
        rate: rate ?? "",
        phase: "Broken / Preparation",
        owner: "Project phase owner",
        priority: normalizeBulkPriority(priority ?? ""),
        equipment: equipment ?? "",
        location: location ?? "",
        isolationPoint: isolationPoint ?? "",
        slipMetalForemanApproved: blindType === "Slip Blind" ? parseBooleanBulkCell(slipMetalForemanApproved) : false,
        slipBlindMerged: blindType === "Slip Blind" ? parseBooleanBulkCell(slipBlindMerged) : false,
        notes: notes ?? "",
      };
    })
    .filter((blind) => blind.tag && blind.type && blind.size);

  return { parsed, errors };
}
