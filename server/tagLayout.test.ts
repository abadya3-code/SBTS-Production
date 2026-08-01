import { describe, expect, it } from "vitest";
import {
  createDefaultTagLayout,
  createEmptyTagTemplateSlots,
  parseTagLayoutJson,
  sanitizeTagLayout,
  sanitizeTagTemplateSlots,
  serializeTagLayout,
  validateTagLayout,
} from "@shared/tagLayout";

describe("physical blind tag layout contract", () => {
  it("uses the approved 70 × 110 mm canvas and fixed top-center hole", () => {
    const layout = createDefaultTagLayout();

    expect(layout.canvas).toMatchObject({ widthMm: 70, heightMm: 110 });
    expect(layout.hole).toMatchObject({ enabled: true, position: "top-center" });
    expect(layout.elements).toHaveLength(9);
    expect(layout.elements.map(element => element.kind)).toEqual([
      "area",
      "line",
      "id",
      "size",
      "rating",
      "project",
      "qr",
      "logo",
      "date",
    ]);
    expect(validateTagLayout(layout)).toEqual({ valid: true, issues: [] });
  });

  it("clamps untrusted drag, resize, typography, color, and hole values", () => {
    const source = createDefaultTagLayout();
    const unsafe = {
      ...source,
      canvas: { ...source.canvas, widthMm: 999, heightMm: -20 },
      hole: {
        ...source.hole,
        position: "bottom-left",
        diameterMm: 100,
        topMm: -5,
      },
      elements: source.elements.map((element, index) => ({
        ...element,
        xMm: index === 0 ? -100 : 500,
        yMm: 500,
        widthMm: 999,
        heightMm: 999,
        fontSizePt: 200,
        color: "javascript:alert(1)",
      })),
    };

    const layout = sanitizeTagLayout(unsafe);
    expect(layout.canvas).toMatchObject({ widthMm: 200, heightMm: 50 });
    expect(layout.hole.position).toBe("top-center");
    expect(layout.hole.diameterMm).toBeLessThanOrEqual(12);
    for (const element of layout.elements) {
      expect(element.xMm).toBeGreaterThanOrEqual(0);
      expect(element.yMm).toBeGreaterThanOrEqual(0);
      expect(element.xMm + element.widthMm).toBeLessThanOrEqual(
        layout.canvas.widthMm
      );
      expect(element.yMm + element.heightMm).toBeLessThanOrEqual(
        layout.canvas.heightMm
      );
      expect(element.fontSizePt).toBeLessThanOrEqual(28);
      expect(element.color).toBe("#0f172a");
    }
    expect(validateTagLayout(layout).valid).toBe(true);
  });

  it("round-trips a sanitized layout and keeps exactly three template slots", () => {
    const layout = createDefaultTagLayout();
    const parsed = parseTagLayoutJson(serializeTagLayout(layout));
    expect(parsed).toEqual(layout);

    const slots = sanitizeTagTemplateSlots({
      ...createEmptyTagTemplateSlots(),
      slots: [
        {
          id: "slot-1",
          name: "Shutdown standard",
          savedAt: "2026-08-01T10:00:00.000Z",
          layout,
        },
        { id: "unknown", name: "Injected", layout },
      ],
    });
    expect(slots.slots).toHaveLength(3);
    expect(slots.slots.map(slot => slot.id)).toEqual([
      "slot-1",
      "slot-2",
      "slot-3",
    ]);
    expect(slots.slots[0].layout).toEqual(layout);
  });
});
