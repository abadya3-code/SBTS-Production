import type {
  TagLayoutElement,
  TagLayoutV1,
} from "../../../../shared/tagLayout";

export type BlindTagContent = {
  area: string;
  line: string;
  id: string;
  size: string;
  rating: string;
  project: string;
  qrDataUrl: string | null;
  verificationUrl: string | null;
  logoUrl: string | null;
  date: string;
};

type BlindTagProps = {
  layout: TagLayoutV1;
  content: BlindTagContent;
  className?: string;
};

function alignmentStyle(alignment: TagLayoutElement["alignment"]) {
  if (alignment === "center") return { textAlign: "center" as const };
  if (alignment === "right") return { textAlign: "right" as const };
  return { textAlign: "left" as const };
}

function fieldValue(
  kind: TagLayoutElement["kind"],
  content: BlindTagContent
): string {
  if (kind === "area") return content.area;
  if (kind === "line") return content.line;
  if (kind === "id") return content.id;
  if (kind === "size") return content.size;
  if (kind === "rating") return content.rating;
  if (kind === "project") return content.project;
  if (kind === "date") return content.date;
  return "";
}

function TagElement({
  element,
  content,
}: {
  element: TagLayoutElement;
  content: BlindTagContent;
}) {
  const commonStyle = {
    left: `${element.xMm}mm`,
    top: `${element.yMm}mm`,
    width: `${element.widthMm}mm`,
    height: `${element.heightMm}mm`,
    zIndex: element.zIndex,
  };

  if (element.kind === "qr") {
    return (
      <div
        className="absolute flex items-center justify-center overflow-hidden"
        style={commonStyle}
      >
        {content.qrDataUrl ? (
          <img
            src={content.qrDataUrl}
            alt={`Verification QR for ${content.id}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-dashed border-red-400 p-1 text-center text-[6pt] font-bold text-red-700">
            QR token required
          </div>
        )}
      </div>
    );
  }

  if (element.kind === "logo") {
    return (
      <div
        className="absolute flex items-center justify-center overflow-hidden"
        style={commonStyle}
      >
        {content.logoUrl ? (
          <img
            src={content.logoUrl}
            alt="Company logo"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-center text-[7pt] font-black tracking-[0.18em] text-slate-700">
            SBTS
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute flex min-w-0 flex-col justify-center overflow-hidden px-[0.7mm] leading-tight"
      style={{
        ...commonStyle,
        ...alignmentStyle(element.alignment),
        color: element.color,
        fontFamily:
          element.fontFamily === "mono"
            ? "ui-monospace, SFMono-Regular, Menlo, monospace"
            : "Arial, Helvetica, sans-serif",
        fontSize: `${element.fontSizePt}pt`,
        fontWeight: element.fontWeight,
      }}
    >
      {element.kind !== "id" && (
        <span className="block truncate text-[0.62em] font-semibold uppercase tracking-wider opacity-65">
          {element.label}
        </span>
      )}
      <span className="block truncate">{fieldValue(element.kind, content) || "—"}</span>
    </div>
  );
}

export function BlindTag({ layout, content, className = "" }: BlindTagProps) {
  return (
    <article
      className={`relative box-border shrink-0 overflow-hidden bg-white text-slate-950 ${className}`}
      style={{
        width: `${layout.canvas.widthMm}mm`,
        height: `${layout.canvas.heightMm}mm`,
        backgroundColor: layout.canvas.backgroundColor,
        borderColor: layout.canvas.borderColor,
        borderWidth: `${layout.canvas.borderWidthMm}mm`,
        borderStyle: "solid",
      }}
      aria-label={`Printable blind tag ${content.id}`}
    >
      {layout.hole.enabled && (
        <div
          className="absolute z-[100] -translate-x-1/2 rounded-full border border-slate-500 bg-white"
          style={{
            left: "50%",
            top: `${layout.hole.topMm}mm`,
            width: `${layout.hole.diameterMm}mm`,
            height: `${layout.hole.diameterMm}mm`,
          }}
          aria-hidden="true"
        />
      )}
      {layout.elements
        .filter(element => element.visible)
        .map(element => (
          <TagElement key={element.id} element={element} content={content} />
        ))}
      {content.verificationUrl && (
        <span className="absolute bottom-[1.5mm] left-[2mm] right-[2mm] truncate text-center text-[5pt] font-medium text-slate-500">
          Secure SBTS verification · tokenized URL
        </span>
      )}
    </article>
  );
}
