export const TAG_LAYOUT_VERSION = 1 as const;
export const TAG_TEMPLATE_SLOTS_VERSION = 1 as const;

export const TAG_ELEMENT_KINDS = [
  "area",
  "line",
  "id",
  "size",
  "rating",
  "project",
  "qr",
  "logo",
  "date",
] as const;

export type TagElementKind = (typeof TAG_ELEMENT_KINDS)[number];
export type TagTextAlignment = "left" | "center" | "right";
export type TagFontFamily = "sans" | "mono";
export type TagFontWeight = 400 | 600 | 700 | 800;

export type TagLayoutElement = {
  id: string;
  kind: TagElementKind;
  label: string;
  visible: boolean;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontSizePt: number;
  fontFamily: TagFontFamily;
  fontWeight: TagFontWeight;
  color: string;
  alignment: TagTextAlignment;
  zIndex: number;
};

export type TagLayoutV1 = {
  version: typeof TAG_LAYOUT_VERSION;
  canvas: {
    widthMm: number;
    heightMm: number;
    backgroundColor: string;
    borderColor: string;
    borderWidthMm: number;
  };
  hole: {
    enabled: boolean;
    position: "top-center";
    diameterMm: number;
    topMm: number;
  };
  elements: TagLayoutElement[];
};

export type TagTemplateSlotId = "slot-1" | "slot-2" | "slot-3";

export type TagTemplateSlot = {
  id: TagTemplateSlotId;
  name: string;
  savedAt: string | null;
  layout: TagLayoutV1 | null;
};

export type TagTemplateSlotsV1 = {
  version: typeof TAG_TEMPLATE_SLOTS_VERSION;
  slots: [TagTemplateSlot, TagTemplateSlot, TagTemplateSlot];
};

export type TagLayoutValidationIssue = {
  path: string;
  message: string;
};

export type TagLayoutValidationResult = {
  valid: boolean;
  issues: TagLayoutValidationIssue[];
};

const MIN_CANVAS_WIDTH_MM = 40;
const MAX_CANVAS_WIDTH_MM = 200;
const MIN_CANVAS_HEIGHT_MM = 50;
const MAX_CANVAS_HEIGHT_MM = 240;
const MIN_ELEMENT_WIDTH_MM = 8;
const MIN_ELEMENT_HEIGHT_MM = 5;

const ELEMENT_LABELS: Record<TagElementKind, string> = {
  area: "Area",
  line: "Line / Equipment",
  id: "Blind ID",
  size: "Size",
  rating: "Rating",
  project: "Project",
  qr: "QR Code",
  logo: "Company Logo",
  date: "Issue Date",
};

const TEMPLATE_SLOT_IDS: TagTemplateSlotId[] = ["slot-1", "slot-2", "slot-3"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}

function createElement(
  kind: TagElementKind,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  fontSizePt: number,
  options: Partial<
    Pick<
      TagLayoutElement,
      "alignment" | "fontFamily" | "fontWeight" | "visible" | "zIndex"
    >
  > = {}
): TagLayoutElement {
  return {
    id: `tag-${kind}`,
    kind,
    label: ELEMENT_LABELS[kind],
    visible: options.visible ?? true,
    xMm,
    yMm,
    widthMm,
    heightMm,
    fontSizePt,
    fontFamily: options.fontFamily ?? (kind === "id" ? "mono" : "sans"),
    fontWeight: options.fontWeight ?? (kind === "id" ? 800 : 700),
    color: "#0f172a",
    alignment: options.alignment ?? "left",
    zIndex: options.zIndex ?? 1,
  };
}

export function createDefaultTagLayout(
  widthMm = 70,
  heightMm = 110
): TagLayoutV1 {
  const width = clamp(widthMm, MIN_CANVAS_WIDTH_MM, MAX_CANVAS_WIDTH_MM);
  const height = clamp(heightMm, MIN_CANVAS_HEIGHT_MM, MAX_CANVAS_HEIGHT_MM);
  const usableWidth = Math.max(20, width - 10);
  const halfWidth = Math.max(10, (usableWidth - 4) / 2);

  return sanitizeTagLayout(
    {
      version: TAG_LAYOUT_VERSION,
      canvas: {
        widthMm: width,
        heightMm: height,
        backgroundColor: "#ffffff",
        borderColor: "#0f172a",
        borderWidthMm: 0.8,
      },
      hole: {
        enabled: true,
        position: "top-center",
        diameterMm: 5.5,
        topMm: 4,
      },
      elements: [
        createElement("area", 5, 15, usableWidth, 8, 8),
        createElement("line", 5, 24, usableWidth, 8, 8),
        createElement("id", 5, 34, usableWidth, 13, 15, {
          alignment: "center",
        }),
        createElement("size", 5, 50, halfWidth, 8, 9),
        createElement("rating", 9 + halfWidth, 50, halfWidth, 8, 9),
        createElement("project", 5, 60, usableWidth, 8, 8),
        createElement("qr", 5, 72, 25, 25, 7, { alignment: "center" }),
        createElement("logo", 34, 72, Math.max(12, width - 39), 13, 8, {
          alignment: "center",
        }),
        createElement("date", 34, 88, Math.max(12, width - 39), 8, 7, {
          alignment: "center",
          fontWeight: 600,
        }),
      ],
    },
    { widthMm: width, heightMm: height }
  );
}

export const DEFAULT_TAG_LAYOUT = createDefaultTagLayout();

export function validateTagLayout(value: unknown): TagLayoutValidationResult {
  const issues: TagLayoutValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [{ path: "$", message: "Layout must be an object." }],
    };
  }

  if (value.version !== TAG_LAYOUT_VERSION) {
    issues.push({
      path: "version",
      message: `Unsupported layout version. Expected ${TAG_LAYOUT_VERSION}.`,
    });
  }

  const canvas = value.canvas;
  if (!isRecord(canvas)) {
    issues.push({
      path: "canvas",
      message: "Canvas configuration is required.",
    });
  }
  const width = isRecord(canvas) ? finiteNumber(canvas.widthMm, 0) : 0;
  const height = isRecord(canvas) ? finiteNumber(canvas.heightMm, 0) : 0;
  if (width < MIN_CANVAS_WIDTH_MM || width > MAX_CANVAS_WIDTH_MM) {
    issues.push({
      path: "canvas.widthMm",
      message: "Canvas width is outside the supported range.",
    });
  }
  if (height < MIN_CANVAS_HEIGHT_MM || height > MAX_CANVAS_HEIGHT_MM) {
    issues.push({
      path: "canvas.heightMm",
      message: "Canvas height is outside the supported range.",
    });
  }

  const hole = value.hole;
  if (!isRecord(hole)) {
    issues.push({ path: "hole", message: "Hole configuration is required." });
  } else {
    const diameter = finiteNumber(hole.diameterMm, 0);
    const top = finiteNumber(hole.topMm, -1);
    if (hole.position !== "top-center") {
      issues.push({
        path: "hole.position",
        message: "The hanging hole must remain top-center.",
      });
    }
    if (diameter < 3 || diameter > Math.min(12, width / 3)) {
      issues.push({
        path: "hole.diameterMm",
        message: "Hole diameter is outside the supported range.",
      });
    }
    if (top < 1 || top + diameter > height) {
      issues.push({
        path: "hole.topMm",
        message: "Hole geometry must remain inside the tag canvas.",
      });
    }
  }

  if (!Array.isArray(value.elements)) {
    issues.push({ path: "elements", message: "Elements must be an array." });
  } else {
    const kinds = new Set<TagElementKind>();
    value.elements.forEach((candidate, index) => {
      if (!isRecord(candidate)) {
        issues.push({
          path: `elements.${index}`,
          message: "Element must be an object.",
        });
        return;
      }
      const kind = candidate.kind;
      if (!TAG_ELEMENT_KINDS.includes(kind as TagElementKind)) {
        issues.push({
          path: `elements.${index}.kind`,
          message: "Unknown element kind.",
        });
        return;
      }
      if (kinds.has(kind as TagElementKind)) {
        issues.push({
          path: `elements.${index}.kind`,
          message: "Element kind is duplicated.",
        });
      }
      kinds.add(kind as TagElementKind);
      const x = finiteNumber(candidate.xMm, -1);
      const y = finiteNumber(candidate.yMm, -1);
      const elementWidth = finiteNumber(candidate.widthMm, 0);
      const elementHeight = finiteNumber(candidate.heightMm, 0);
      if (
        x < 0 ||
        y < 0 ||
        elementWidth < MIN_ELEMENT_WIDTH_MM ||
        elementHeight < MIN_ELEMENT_HEIGHT_MM ||
        x + elementWidth > width ||
        y + elementHeight > height
      ) {
        issues.push({
          path: `elements.${index}`,
          message: "Element geometry must remain inside the tag canvas.",
        });
      }
      if (typeof candidate.visible !== "boolean") {
        issues.push({
          path: `elements.${index}.visible`,
          message: "Element visibility must be boolean.",
        });
      }
      if (
        !(["left", "center", "right"] as string[]).includes(
          String(candidate.alignment)
        )
      ) {
        issues.push({
          path: `elements.${index}.alignment`,
          message: "Element alignment is invalid.",
        });
      }
      if (
        !(["sans", "mono"] as string[]).includes(String(candidate.fontFamily))
      ) {
        issues.push({
          path: `elements.${index}.fontFamily`,
          message: "Element font family is invalid.",
        });
      }
      const fontSize = finiteNumber(candidate.fontSizePt, 0);
      if (fontSize < 6 || fontSize > 28) {
        issues.push({
          path: `elements.${index}.fontSizePt`,
          message: "Element font size is outside the supported range.",
        });
      }
    });

    for (const kind of TAG_ELEMENT_KINDS) {
      if (!kinds.has(kind)) {
        issues.push({ path: "elements", message: `Missing ${kind} element.` });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function sanitizeTagLayout(
  value: unknown,
  canvasOverride?: { widthMm?: number; heightMm?: number }
): TagLayoutV1 {
  const source = isRecord(value) ? value : {};
  const canvasSource = isRecord(source.canvas) ? source.canvas : {};
  const widthMm = rounded(
    clamp(
      finiteNumber(canvasOverride?.widthMm ?? canvasSource.widthMm, 70),
      MIN_CANVAS_WIDTH_MM,
      MAX_CANVAS_WIDTH_MM
    )
  );
  const heightMm = rounded(
    clamp(
      finiteNumber(canvasOverride?.heightMm ?? canvasSource.heightMm, 110),
      MIN_CANVAS_HEIGHT_MM,
      MAX_CANVAS_HEIGHT_MM
    )
  );
  const fallback = isRecord(value)
    ? undefined
    : createDefaultTagLayout(widthMm, heightMm);
  if (fallback) return fallback;

  const defaults = createDefaultElementsWithoutSanitizing(widthMm, heightMm);
  const sourceElements = Array.isArray(source.elements) ? source.elements : [];
  const sourceByKind = new Map<TagElementKind, Record<string, unknown>>();
  for (const candidate of sourceElements) {
    if (!isRecord(candidate)) continue;
    if (!TAG_ELEMENT_KINDS.includes(candidate.kind as TagElementKind)) continue;
    const kind = candidate.kind as TagElementKind;
    if (!sourceByKind.has(kind)) sourceByKind.set(kind, candidate);
  }

  const elements = defaults.map(defaultElement => {
    const candidate = sourceByKind.get(defaultElement.kind) ?? {};
    const minWidth = defaultElement.kind === "qr" ? 14 : MIN_ELEMENT_WIDTH_MM;
    const minHeight = defaultElement.kind === "qr" ? 14 : MIN_ELEMENT_HEIGHT_MM;
    const width = rounded(
      clamp(
        finiteNumber(candidate.widthMm, defaultElement.widthMm),
        minWidth,
        widthMm
      )
    );
    const height = rounded(
      clamp(
        finiteNumber(candidate.heightMm, defaultElement.heightMm),
        minHeight,
        heightMm
      )
    );
    const x = rounded(
      clamp(finiteNumber(candidate.xMm, defaultElement.xMm), 0, widthMm - width)
    );
    const y = rounded(
      clamp(
        finiteNumber(candidate.yMm, defaultElement.yMm),
        0,
        heightMm - height
      )
    );
    const alignment = ["left", "center", "right"].includes(
      String(candidate.alignment)
    )
      ? (candidate.alignment as TagTextAlignment)
      : defaultElement.alignment;
    const fontFamily =
      candidate.fontFamily === "mono" || candidate.fontFamily === "sans"
        ? candidate.fontFamily
        : defaultElement.fontFamily;
    const rawWeight = finiteNumber(
      candidate.fontWeight,
      defaultElement.fontWeight
    );
    const fontWeight = ([400, 600, 700, 800] as TagFontWeight[]).reduce(
      (nearest, option) =>
        Math.abs(option - rawWeight) < Math.abs(nearest - rawWeight)
          ? option
          : nearest,
      700
    );

    return {
      id:
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id.slice(0, 64)
          : defaultElement.id,
      kind: defaultElement.kind,
      label:
        typeof candidate.label === "string" && candidate.label.trim()
          ? candidate.label.trim().slice(0, 40)
          : ELEMENT_LABELS[defaultElement.kind],
      visible:
        typeof candidate.visible === "boolean" ? candidate.visible : true,
      xMm: x,
      yMm: y,
      widthMm: width,
      heightMm: height,
      fontSizePt: rounded(
        clamp(
          finiteNumber(candidate.fontSizePt, defaultElement.fontSizePt),
          6,
          28
        )
      ),
      fontFamily,
      fontWeight,
      color: color(candidate.color, defaultElement.color),
      alignment,
      zIndex: Math.round(clamp(finiteNumber(candidate.zIndex, 1), 1, 99)),
    } satisfies TagLayoutElement;
  });

  const holeSource = isRecord(source.hole) ? source.hole : {};
  const diameterMm = rounded(
    clamp(
      finiteNumber(holeSource.diameterMm, 5.5),
      3,
      Math.min(12, widthMm / 3)
    )
  );

  return {
    version: TAG_LAYOUT_VERSION,
    canvas: {
      widthMm,
      heightMm,
      backgroundColor: color(canvasSource.backgroundColor, "#ffffff"),
      borderColor: color(canvasSource.borderColor, "#0f172a"),
      borderWidthMm: rounded(
        clamp(finiteNumber(canvasSource.borderWidthMm, 0.8), 0.2, 3)
      ),
    },
    hole: {
      enabled:
        typeof holeSource.enabled === "boolean" ? holeSource.enabled : true,
      position: "top-center",
      diameterMm,
      topMm: rounded(
        clamp(
          finiteNumber(holeSource.topMm, 4),
          1,
          Math.max(1, heightMm - diameterMm)
        )
      ),
    },
    elements,
  };
}

function createDefaultElementsWithoutSanitizing(
  widthMm: number,
  heightMm: number
): TagLayoutElement[] {
  const usableWidth = Math.max(20, widthMm - 10);
  const halfWidth = Math.max(10, (usableWidth - 4) / 2);
  const lowerY = Math.min(72, Math.max(42, heightMm - 38));
  return [
    createElement("area", 5, 15, usableWidth, 8, 8),
    createElement("line", 5, 24, usableWidth, 8, 8),
    createElement("id", 5, 34, usableWidth, 13, 15, { alignment: "center" }),
    createElement("size", 5, 50, halfWidth, 8, 9),
    createElement("rating", 9 + halfWidth, 50, halfWidth, 8, 9),
    createElement("project", 5, 60, usableWidth, 8, 8),
    createElement("qr", 5, lowerY, 25, 25, 7, { alignment: "center" }),
    createElement("logo", 34, lowerY, Math.max(12, widthMm - 39), 13, 8, {
      alignment: "center",
    }),
    createElement(
      "date",
      34,
      Math.min(heightMm - 8, lowerY + 16),
      Math.max(12, widthMm - 39),
      8,
      7,
      { alignment: "center", fontWeight: 600 }
    ),
  ];
}

export function parseTagLayoutJson(
  value: string | null | undefined,
  canvasOverride?: { widthMm?: number; heightMm?: number }
): TagLayoutV1 {
  if (!value) {
    return createDefaultTagLayout(
      canvasOverride?.widthMm ?? 70,
      canvasOverride?.heightMm ?? 110
    );
  }
  try {
    return sanitizeTagLayout(JSON.parse(value), canvasOverride);
  } catch {
    return createDefaultTagLayout(
      canvasOverride?.widthMm ?? 70,
      canvasOverride?.heightMm ?? 110
    );
  }
}

export function serializeTagLayout(layout: TagLayoutV1): string {
  return JSON.stringify(sanitizeTagLayout(layout));
}

export function createEmptyTagTemplateSlots(): TagTemplateSlotsV1 {
  return {
    version: TAG_TEMPLATE_SLOTS_VERSION,
    slots: TEMPLATE_SLOT_IDS.map((id, index) => ({
      id,
      name: `Template ${index + 1}`,
      savedAt: null,
      layout: null,
    })) as TagTemplateSlotsV1["slots"],
  };
}

export function sanitizeTagTemplateSlots(value: unknown): TagTemplateSlotsV1 {
  const source =
    isRecord(value) && Array.isArray(value.slots) ? value.slots : [];
  const byId = new Map<TagTemplateSlotId, Record<string, unknown>>();
  for (const candidate of source) {
    if (!isRecord(candidate)) continue;
    if (!TEMPLATE_SLOT_IDS.includes(candidate.id as TagTemplateSlotId))
      continue;
    byId.set(candidate.id as TagTemplateSlotId, candidate);
  }

  return {
    version: TAG_TEMPLATE_SLOTS_VERSION,
    slots: TEMPLATE_SLOT_IDS.map((id, index) => {
      const candidate = byId.get(id);
      const rawLayout = candidate?.layout;
      return {
        id,
        name:
          typeof candidate?.name === "string" && candidate.name.trim()
            ? candidate.name.trim().slice(0, 40)
            : `Template ${index + 1}`,
        savedAt:
          typeof candidate?.savedAt === "string" &&
          !Number.isNaN(Date.parse(candidate.savedAt))
            ? candidate.savedAt
            : null,
        layout: isRecord(rawLayout) ? sanitizeTagLayout(rawLayout) : null,
      };
    }) as TagTemplateSlotsV1["slots"],
  };
}

export function parseTagTemplateSlotsJson(
  value: string | null | undefined
): TagTemplateSlotsV1 {
  if (!value) return createEmptyTagTemplateSlots();
  try {
    return sanitizeTagTemplateSlots(JSON.parse(value));
  } catch {
    return createEmptyTagTemplateSlots();
  }
}

export function serializeTagTemplateSlots(slots: TagTemplateSlotsV1): string {
  return JSON.stringify(sanitizeTagTemplateSlots(slots));
}
