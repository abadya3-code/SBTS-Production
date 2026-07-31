import { strToU8, zipSync } from "fflate";

type CellValue = unknown;
type ColumnWidth = { wch?: number };
type PortableSheet = { rows: CellValue[][]; "!cols"?: ColumnWidth[] };
type PortableWorkbook = {
  SheetNames: string[];
  sheets: Array<{ name: string; sheet: PortableSheet }>;
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function cellXml(value: CellValue, column: number, row: number, header: boolean): string {
  const reference = `${columnName(column)}${row}`;
  const style = header ? ' s="1"' : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${reference}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
  }
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function worksheetXml(sheet: PortableSheet): string {
  const widthCount = Math.max(sheet["!cols"]?.length ?? 0, ...sheet.rows.map((row) => row.length), 1);
  const columns = Array.from({ length: widthCount }, (_, index) => {
    const width = Math.min(80, Math.max(8, sheet["!cols"]?.[index]?.wch ?? 14));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => cellXml(value, columnIndex, rowIndex + 1, rowIndex === 0)).join("");
    return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="22" customHeight="1"' : ""}>${cells}</row>`;
  }).join("");
  const lastCell = `${columnName(widthCount - 1)}${Math.max(sheet.rows.length, 1)}`;
  const autoFilter = sheet.rows.length > 1 ? `<autoFilter ref="A1:${columnName(widthCount - 1)}1"/>` : "";
  return `${XML_HEADER}<worksheet xmlns="${MAIN_NS}"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData>${autoFilter}</worksheet>`;
}

function objectRowsToArray(rows: Record<string, unknown>[]): CellValue[][] {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

function safeSheetName(name: string, index: number): string {
  const safe = name.replace(/[\\/?*:[\]]/g, " ").trim().slice(0, 31);
  return safe || `Sheet ${index + 1}`;
}

async function writeFile(model: PortableWorkbook, fileName: string): Promise<void> {
  const sheets = model.sheets.length > 0
    ? model.sheets
    : [{ name: "Empty", sheet: { rows: [["No data available"]] } }];
  const names = sheets.map((entry, index) => safeSheetName(entry.name, index));

  const workbookSheets = names.map((name, index) =>
    `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRelationships = names.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const contentOverrides = names.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentOverrides}</Types>`),
    "_rels/.rels": strToU8(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${workbookSheets}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRelationships}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(`${XML_HEADER}<styleSheet xmlns="${MAIN_NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`),
  };
  sheets.forEach((entry, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(entry.sheet));
  });

  const archive = zipSync(files, { level: 6 });
  const blobBytes = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([blobBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const XLSX = {
  utils: {
    book_new: (): PortableWorkbook => ({ SheetNames: [], sheets: [] }),
    json_to_sheet: (rows: Record<string, unknown>[]): PortableSheet => ({ rows: objectRowsToArray(rows) }),
    aoa_to_sheet: (rows: CellValue[][]): PortableSheet => ({ rows }),
    book_append_sheet: (workbook: PortableWorkbook, sheet: PortableSheet, name: string) => {
      workbook.SheetNames.push(name);
      workbook.sheets.push({ name, sheet });
    },
  },
  writeFile,
};
