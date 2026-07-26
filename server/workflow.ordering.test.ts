import { describe, expect, it } from "vitest";
import { reorderItems } from "../client/src/lib/workflowOrdering";

describe("workflow phase ordering", () => {
  it("moves a dragged phase from the beginning to the end of the route", () => {
    expect(reorderItems(["broken", "assembly", "inspection"], 0, 2)).toEqual(["assembly", "inspection", "broken"]);
  });

  it("moves a dragged phase from the end to the beginning of the route", () => {
    expect(reorderItems(["broken", "assembly", "inspection"], 2, 0)).toEqual(["inspection", "broken", "assembly"]);
  });

  it("does not mutate the original phase list", () => {
    const phases = ["broken", "assembly", "inspection"];
    const reordered = reorderItems(phases, 1, 0);

    expect(reordered).toEqual(["assembly", "broken", "inspection"]);
    expect(phases).toEqual(["broken", "assembly", "inspection"]);
  });

  it("keeps the existing reference for invalid drag targets", () => {
    const phases = ["broken", "assembly", "inspection"];

    expect(reorderItems(phases, -1, 1)).toBe(phases);
    expect(reorderItems(phases, 1, 5)).toBe(phases);
    expect(reorderItems(phases, 1, 1)).toBe(phases);
  });
});
