import DOMPurify from "dompurify";

export function escapePrintHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sanitizePrintDocument(html: string): string {
  return String(
    DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ["style"],
      FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
      RETURN_TRUSTED_TYPE: false,
    })
  );
}

export function openSanitizedPrintWindow(
  html: string,
  options: {
    delayMs?: number;
    onBlocked?: () => void;
  } = {}
): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    options.onBlocked?.();
    return false;
  }

  // Prevent the generated report from retaining a reference to the application.
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(sanitizePrintDocument(html));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), options.delayMs ?? 300);
  return true;
}
