import { describe, expect, it } from "vitest";
import { bulkPasteExampleRow, parseBulkPaste } from "../shared/blindBulkPaste";

describe("Bulk paste parser", () => {
  it("parses the visible example row into one valid Slip Blind draft", () => {
    const preview = parseBulkPaste(bulkPasteExampleRow);

    expect(preview.errors).toEqual([]);
    expect(preview.parsed).toHaveLength(1);
    expect(preview.parsed[0]).toMatchObject({
      tag: "BLD-1401",
      type: "Slip Blind",
      size: "12 in",
      rate: "300#",
      phase: "Broken / Preparation",
      owner: "Project phase owner",
      priority: "Normal",
      equipment: "P-101A",
      location: "Train header",
      isolationPoint: "Upstream flange",
      slipMetalForemanApproved: true,
      slipBlindMerged: true,
      notes: "Ready for certificate gate",
    });
  });

  it("skips an Excel header row and keeps Drop Spool slip flags disabled", () => {
    const pasted = [
      "Tag\tType\tSize\tRate\tPriority\tEquipment\tLocation\tIsolation Point\tForeman Metal Approved\tSlip Blind Merged\tNotes",
      "BLD-2001\tDrop Spool\t8 in\t150#\tHigh\tP-202B\tSouth rack\tDownstream valve\tYes\tYes\tDrop spool does not require slip gates",
    ].join("\n");

    const preview = parseBulkPaste(pasted);

    expect(preview.errors).toEqual([]);
    expect(preview.parsed).toHaveLength(1);
    expect(preview.parsed[0]).toMatchObject({
      tag: "BLD-2001",
      type: "Drop Spool",
      priority: "High",
      equipment: "P-202B",
      slipMetalForemanApproved: false,
      slipBlindMerged: false,
    });
  });

  it("reports required-column errors for incomplete rows", () => {
    const preview = parseBulkPaste("BLD-3001\tSlip Blind");

    expect(preview.parsed).toHaveLength(0);
    expect(preview.errors).toEqual(["Row 1: tag, type, and size are required."]);
  });
});
