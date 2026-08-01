import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  EyeOff,
  GripVertical,
  Maximize2,
  QrCode,
  RotateCcw,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createDefaultTagLayout,
  sanitizeTagLayout,
  sanitizeTagTemplateSlots,
  type TagFontFamily,
  type TagFontWeight,
  type TagLayoutElement,
  type TagLayoutV1,
  type TagTemplateSlotId,
  type TagTemplateSlotsV1,
  type TagTextAlignment,
} from "../../../../shared/tagLayout";

type TagLayoutDesignerProps = {
  layout: TagLayoutV1;
  templateSlots: TagTemplateSlotsV1;
  onLayoutChange: (layout: TagLayoutV1) => void;
  onTemplateSlotsChange: (slots: TagTemplateSlotsV1) => void;
  sampleValues?: Partial<Record<TagLayoutElement["kind"], string>>;
};

type Interaction = {
  mode: "move" | "resize";
  element: TagLayoutElement;
  startClientX: number;
  startClientY: number;
};

const SAMPLE_CONTENT: Record<TagLayoutElement["kind"], string> = {
  area: "R-44 · Utility Area",
  line: 'D-102 · Line 6"',
  id: "BLD-001",
  size: 'Size · 12"',
  rating: "Rating · 150#",
  project: "PRJ-001 · D-102 T&I",
  qr: "Preview only",
  logo: "Logo preview",
  date: "01 Aug 2026",
};

function alignmentClass(alignment: TagTextAlignment): string {
  if (alignment === "center") return "items-center justify-center text-center";
  if (alignment === "right") return "items-end justify-center text-right";
  return "items-start justify-center text-left";
}

function updateElement(
  layout: TagLayoutV1,
  elementId: string,
  patch: Partial<TagLayoutElement>
): TagLayoutV1 {
  return sanitizeTagLayout({
    ...layout,
    elements: layout.elements.map(element =>
      element.id === elementId ? { ...element, ...patch } : element
    ),
  });
}

export function TagLayoutDesigner({
  layout,
  templateSlots,
  onLayoutChange,
  onTemplateSlotsChange,
  sampleValues,
}: TagLayoutDesignerProps) {
  const [selectedId, setSelectedId] = useState(
    () => layout.elements.find(element => element.kind === "id")?.id ?? ""
  );
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const pixelsPerMm = useMemo(
    () =>
      Math.max(
        2.2,
        Math.min(4.2, 520 / layout.canvas.heightMm, 430 / layout.canvas.widthMm)
      ),
    [layout.canvas.heightMm, layout.canvas.widthMm]
  );
  const selectedElement =
    layout.elements.find(element => element.id === selectedId) ??
    layout.elements[0];
  const previewContent = { ...SAMPLE_CONTENT, ...sampleValues };

  const snap = (value: number) =>
    snapToGrid ? Math.round(value) : Math.round(value * 10) / 10;

  useEffect(() => {
    if (!interaction) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = (event.clientX - interaction.startClientX) / pixelsPerMm;
      const deltaY = (event.clientY - interaction.startClientY) / pixelsPerMm;
      if (interaction.mode === "move") {
        onLayoutChange(
          updateElement(layout, interaction.element.id, {
            xMm: snap(interaction.element.xMm + deltaX),
            yMm: snap(interaction.element.yMm + deltaY),
          })
        );
      } else {
        onLayoutChange(
          updateElement(layout, interaction.element.id, {
            widthMm: snap(interaction.element.widthMm + deltaX),
            heightMm: snap(interaction.element.heightMm + deltaY),
          })
        );
      }
    };

    const handlePointerUp = () => setInteraction(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [interaction, layout, onLayoutChange, pixelsPerMm, snapToGrid]);

  const beginInteraction = (
    event: React.PointerEvent,
    element: TagLayoutElement,
    mode: Interaction["mode"]
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    setInteraction({
      mode,
      element,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  };

  const changeSelected = (patch: Partial<TagLayoutElement>) => {
    if (!selectedElement) return;
    onLayoutChange(updateElement(layout, selectedElement.id, patch));
  };

  const resizeCanvas = (widthMm: number, heightMm: number) => {
    onLayoutChange(sanitizeTagLayout(layout, { widthMm, heightMm }));
  };

  const saveTemplate = (slotId: TagTemplateSlotId) => {
    onTemplateSlotsChange(
      sanitizeTagTemplateSlots({
        ...templateSlots,
        slots: templateSlots.slots.map(slot =>
          slot.id === slotId
            ? {
                ...slot,
                savedAt: new Date().toISOString(),
                layout: sanitizeTagLayout(layout),
              }
            : slot
        ),
      })
    );
  };

  const loadTemplate = (slotId: TagTemplateSlotId) => {
    const slot = templateSlots.slots.find(candidate => candidate.id === slotId);
    if (slot?.layout) onLayoutChange(sanitizeTagLayout(slot.layout));
  };

  const renameTemplate = (slotId: TagTemplateSlotId, name: string) => {
    onTemplateSlotsChange(
      sanitizeTagTemplateSlots({
        ...templateSlots,
        slots: templateSlots.slots.map(slot =>
          slot.id === slotId ? { ...slot, name } : slot
        ),
      })
    );
  };

  const nudgeSelected = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      !selectedElement ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 5 : 1;
    changeSelected({
      xMm:
        selectedElement.xMm +
        (event.key === "ArrowLeft"
          ? -step
          : event.key === "ArrowRight"
            ? step
            : 0),
      yMm:
        selectedElement.yMm +
        (event.key === "ArrowUp"
          ? -step
          : event.key === "ArrowDown"
            ? step
            : 0),
    });
  };

  return (
    <div className="space-y-5" dir="ltr">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-5 text-white xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
              <GripVertical className="h-4 w-4" /> Physical tag workspace
            </div>
            <h3 className="mt-2 text-xl font-black">Default Tag Designer</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
              Drag fields on the millimetre canvas, resize them from the corner,
              and control typography without allowing content outside the
              printable tag.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/30">
              JSON contract v{layout.version}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onLayoutChange(
                  createDefaultTagLayout(
                    layout.canvas.widthMm,
                    layout.canvas.heightMm
                  )
                )
              }
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Reset layout
            </Button>
          </div>
        </div>

        <div className="grid xl:grid-cols-[240px_minmax(420px,1fr)_300px]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-4 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Elements
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Select or hide a field
                </div>
              </div>
              <Badge variant="outline">
                {layout.elements.filter(item => item.visible).length}/9
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {layout.elements.map(element => (
                <div
                  key={element.id}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                    selectedElement?.id === element.id
                      ? "border-cyan-300 bg-cyan-50 text-cyan-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(element.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">
                      {element.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={element.visible}
                    aria-label={`${element.visible ? "Hide" : "Show"} ${element.label}`}
                    onClick={() => {
                      onLayoutChange(
                        updateElement(layout, element.id, {
                          visible: !element.visible,
                        })
                      );
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    {element.visible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0 bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] bg-[size:18px_18px] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold uppercase text-slate-500">
                    Width mm
                  </Label>
                  <Input
                    type="number"
                    min={40}
                    max={200}
                    value={layout.canvas.widthMm}
                    onChange={event =>
                      resizeCanvas(
                        Number(event.target.value),
                        layout.canvas.heightMm
                      )
                    }
                    className="h-8 w-20"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold uppercase text-slate-500">
                    Height mm
                  </Label>
                  <Input
                    type="number"
                    min={50}
                    max={240}
                    value={layout.canvas.heightMm}
                    onChange={event =>
                      resizeCanvas(
                        layout.canvas.widthMm,
                        Number(event.target.value)
                      )
                    }
                    className="h-8 w-20"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="tag-grid-snap"
                  className="text-xs font-bold text-slate-600"
                >
                  Snap 1 mm
                </Label>
                <Switch
                  id="tag-grid-snap"
                  checked={snapToGrid}
                  onCheckedChange={setSnapToGrid}
                />
              </div>
            </div>

            <div className="flex min-h-[560px] items-center justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-5 shadow-inner">
              <div
                ref={canvasRef}
                tabIndex={0}
                onKeyDown={nudgeSelected}
                onPointerDown={() => setSelectedId("")}
                className="relative shrink-0 overflow-hidden shadow-2xl outline-none ring-offset-4 focus:ring-2 focus:ring-cyan-400"
                style={{
                  width: layout.canvas.widthMm * pixelsPerMm,
                  height: layout.canvas.heightMm * pixelsPerMm,
                  backgroundColor: layout.canvas.backgroundColor,
                  borderColor: layout.canvas.borderColor,
                  borderWidth: Math.max(
                    1,
                    layout.canvas.borderWidthMm * pixelsPerMm
                  ),
                  borderStyle: "solid",
                  borderRadius: 8,
                }}
                aria-label="Printable tag canvas"
              >
                {layout.hole.enabled && (
                  <div
                    className="absolute z-[100] -translate-x-1/2 rounded-full border border-slate-500 bg-slate-100 shadow-inner"
                    style={{
                      left: "50%",
                      top: layout.hole.topMm * pixelsPerMm,
                      width: layout.hole.diameterMm * pixelsPerMm,
                      height: layout.hole.diameterMm * pixelsPerMm,
                    }}
                    title="Top-center hanging hole"
                  />
                )}

                {layout.elements
                  .filter(element => element.visible)
                  .map(element => {
                    const selected = element.id === selectedElement?.id;
                    const fontSize = Math.max(
                      7,
                      (element.fontSizePt * pixelsPerMm) / 4
                    );
                    return (
                      <div
                        key={element.id}
                        onPointerDown={event =>
                          beginInteraction(event, element, "move")
                        }
                        className={`absolute flex select-none flex-col overflow-hidden rounded-sm border border-dashed px-1 py-0.5 ${alignmentClass(element.alignment)} ${
                          selected
                            ? "border-cyan-500 bg-cyan-50/70 ring-2 ring-cyan-400/30"
                            : "border-transparent hover:border-slate-300"
                        }`}
                        style={{
                          left: element.xMm * pixelsPerMm,
                          top: element.yMm * pixelsPerMm,
                          width: element.widthMm * pixelsPerMm,
                          height: element.heightMm * pixelsPerMm,
                          zIndex: element.zIndex,
                          color: element.color,
                          cursor:
                            interaction?.element.id === element.id
                              ? "grabbing"
                              : "grab",
                        }}
                        title={`${element.label} · drag to move`}
                      >
                        {element.kind === "qr" ? (
                          <div className="flex h-full w-full flex-col items-center justify-center rounded border border-dashed border-slate-400 bg-slate-50 text-slate-500">
                            <QrCode className="h-1/2 max-h-8 w-1/2 max-w-8" />
                            <span className="mt-0.5 text-[7px] font-extrabold uppercase tracking-wide">
                              Preview only
                            </span>
                          </div>
                        ) : element.kind === "logo" ? (
                          <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-slate-300 text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                            Logo preview
                          </div>
                        ) : (
                          <span
                            className="max-w-full truncate leading-tight"
                            style={{
                              fontFamily:
                                element.fontFamily === "mono"
                                  ? "ui-monospace, SFMono-Regular, monospace"
                                  : "Inter, ui-sans-serif, system-ui, sans-serif",
                              fontSize,
                              fontWeight: element.fontWeight,
                            }}
                          >
                            {previewContent[element.kind]}
                          </span>
                        )}

                        {selected && (
                          <button
                            type="button"
                            onPointerDown={event =>
                              beginInteraction(event, element, "resize")
                            }
                            className="absolute bottom-0 right-0 flex h-4 w-4 cursor-se-resize items-center justify-center rounded-tl bg-cyan-600 text-white"
                            title="Drag to resize"
                          >
                            <Maximize2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Drag to reposition · resize from the cyan corner · arrow keys
              nudge 1 mm · Shift + arrow nudges 5 mm
            </p>
          </div>

          <aside className="border-t border-slate-200 bg-white p-4 xl:border-l xl:border-t-0">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Inspector
            </div>
            {selectedElement ? (
              <div className="mt-4 space-y-5">
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                  <div className="text-sm font-black text-cyan-950">
                    {selectedElement.label}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-cyan-700">
                    {selectedElement.kind} · x {selectedElement.xMm} · y{" "}
                    {selectedElement.yMm}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold">Visible</Label>
                    <Switch
                      checked={selectedElement.visible}
                      onCheckedChange={visible => changeSelected({ visible })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["X (mm)", "xMm"],
                        ["Y (mm)", "yMm"],
                        ["Width", "widthMm"],
                        ["Height", "heightMm"],
                      ] as const
                    ).map(([label, key]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">
                          {label}
                        </Label>
                        <Input
                          type="number"
                          step={snapToGrid ? 1 : 0.1}
                          value={selectedElement[key]}
                          onChange={event =>
                            changeSelected({
                              [key]: Number(event.target.value),
                            })
                          }
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {!(["qr", "logo"] as const).includes(
                  selectedElement.kind as "qr" | "logo"
                ) && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">
                          Font
                        </Label>
                        <Select
                          value={selectedElement.fontFamily}
                          onValueChange={(fontFamily: TagFontFamily) =>
                            changeSelected({ fontFamily })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sans">Sans</SelectItem>
                            <SelectItem value="mono">Mono</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">
                          Weight
                        </Label>
                        <Select
                          value={String(selectedElement.fontWeight)}
                          onValueChange={fontWeight =>
                            changeSelected({
                              fontWeight: Number(fontWeight) as TagFontWeight,
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="400">Regular</SelectItem>
                            <SelectItem value="600">Semibold</SelectItem>
                            <SelectItem value="700">Bold</SelectItem>
                            <SelectItem value="800">Extra bold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_52px] gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">
                          Font size (pt)
                        </Label>
                        <Input
                          type="number"
                          min={6}
                          max={28}
                          value={selectedElement.fontSizePt}
                          onChange={event =>
                            changeSelected({
                              fontSizePt: Number(event.target.value),
                            })
                          }
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">
                          Color
                        </Label>
                        <input
                          type="color"
                          value={selectedElement.color}
                          onChange={event =>
                            changeSelected({ color: event.target.value })
                          }
                          className="h-8 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">
                        Alignment
                      </Label>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                        {(
                          [
                            ["left", AlignLeft],
                            ["center", AlignCenter],
                            ["right", AlignRight],
                          ] as const
                        ).map(([alignment, Icon]) => (
                          <Button
                            type="button"
                            key={alignment}
                            variant="ghost"
                            size="sm"
                            onClick={() => changeSelected({ alignment })}
                            className={`h-8 ${selectedElement.alignment === alignment ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500"}`}
                            aria-label={`Align ${alignment}`}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-xs leading-5 text-slate-500">
                Select an element on the canvas or in the element list to edit
                its geometry and typography.
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold">Top-center hole</Label>
                  <p className="text-[10px] text-slate-500">
                    Locked to the physical centerline
                  </p>
                </div>
                <Switch
                  checked={layout.hole.enabled}
                  onCheckedChange={enabled =>
                    onLayoutChange(
                      sanitizeTagLayout({
                        ...layout,
                        hole: { ...layout.hole, enabled },
                      })
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">
                    Diameter mm
                  </Label>
                  <Input
                    type="number"
                    min={3}
                    max={12}
                    value={layout.hole.diameterMm}
                    onChange={event =>
                      onLayoutChange(
                        sanitizeTagLayout({
                          ...layout,
                          hole: {
                            ...layout.hole,
                            diameterMm: Number(event.target.value),
                          },
                        })
                      )
                    }
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">
                    Top offset mm
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={layout.hole.topMm}
                    onChange={event =>
                      onLayoutChange(
                        sanitizeTagLayout({
                          ...layout,
                          hole: {
                            ...layout.hole,
                            topMm: Number(event.target.value),
                          },
                        })
                      )
                    }
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-700">
              Reusable layouts
            </div>
            <h4 className="mt-1 text-base font-black text-slate-950">
              Template slots
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Save or restore three complete, versioned tag layouts. Saving
              application settings persists all slots.
            </p>
          </div>
          <Badge variant="outline">3 slots</Badge>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {templateSlots.slots.map((slot, index) => (
            <div
              key={slot.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-black text-white">
                  {index + 1}
                </span>
                <Input
                  value={slot.name}
                  maxLength={40}
                  onChange={event =>
                    renameTemplate(slot.id, event.target.value)
                  }
                  className="h-8 bg-white text-xs font-bold"
                  aria-label={`Template ${index + 1} name`}
                />
              </div>
              <div className="mt-3 min-h-8 text-[10px] leading-4 text-slate-500">
                {slot.savedAt
                  ? `Saved ${new Date(slot.savedAt).toLocaleString("en-SA")}`
                  : "Empty slot"}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadTemplate(slot.id)}
                  disabled={!slot.layout}
                  className="text-xs"
                >
                  Load
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveTemplate(slot.id)}
                  className="bg-slate-950 text-xs text-white hover:bg-slate-800"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
