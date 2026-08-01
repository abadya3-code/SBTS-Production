import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("controlled QR, tag, certificate, and inbox integration", () => {
  it("renders physical tags only from active real verification URLs", () => {
    const page = read("client/src/pages/BlindTagPrint.tsx");
    const renderer = read("client/src/components/tags/BlindTag.tsx");

    expect(page).toContain("trpc.blindQr.batchState.useQuery");
    expect(page).toContain("trpc.blindQr.generateBatch.useMutation");
    expect(page).toContain("QRCode.toDataURL(verificationUrl");
    expect(page).toContain("trpc.tagPrinting.prepare.useMutation");
    expect(page).toContain("@page { size: ${layout.canvas.widthMm}mm ${layout.canvas.heightMm}mm");
    expect(renderer).toContain("content.qrDataUrl");
    expect(renderer).toContain("QR token required");
    expect(renderer).not.toContain("JSON.stringify");
    expect(page).not.toContain("qrLabel");
  });

  it("connects Blind Detail actions to governed certificates and QR lifecycle", () => {
    const hub = read("client/src/pages/BlindDetailHub.tsx");
    const gateway = read("client/src/pages/BlindCertificate.tsx");
    const certificate = read("client/src/pages/CertificateVerification.tsx");

    expect(hub).toContain("trpc.blindQr.state.useQuery");
    expect(hub).toContain("trpc.blindQr.generate.useMutation");
    expect(hub).toContain("trpc.blindQr.rotate.useMutation");
    expect(hub).toContain("trpc.blindQr.revoke.useMutation");
    expect(hub).toContain("QRCode.toDataURL(absoluteUrl");
    expect(hub).toContain("openControlledCertificate");
    expect(gateway).toContain("current.verificationToken");
    expect(certificate).toContain("Print / Save PDF");
    expect(certificate).toContain("SHA-256 snapshot fingerprint");
  });

  it("records tag printing and QR governance in workflow audit and inbox", () => {
    const tagDb = read("server/db/tagPrinting.ts");
    const qrDb = read("server/db/blindQr.ts");
    const routers = read("server/routers/index.ts");
    const routes = read("client/src/App.tsx");

    expect(tagDb).toContain("Secure Tag Print Prepared");
    expect(tagDb).toContain('type: "tag_printed"');
    expect(tagDb).toContain("broadcastNotification");
    expect(qrDb).toContain("notifyBlindQrGovernance");
    expect(qrDb).toContain("Blind QR Rotated");
    expect(qrDb).toContain("Blind QR Revoked");
    expect(routers).toContain("tagPrinting: tagPrintingRouter");
    expect(routes).toContain('/tags/print/:projectId');
  });

  it("keeps project registers separate from immutable certificates and QR tags", () => {
    const sharedPdf = read("shared/pdfExports.ts");
    const project = read("client/src/pages/ProjectDetail.tsx");

    expect(sharedPdf).toContain("SBTS Project Blind Register");
    expect(sharedPdf).not.toContain("buildTagsPdfSpec");
    expect(project).toContain("Open tag print center");
    expect(project).toContain("buildProjectRegisterPdfSpec");
    expect(project).not.toContain("buildCertificatePdfTableSpec");
    expect(project).not.toContain("buildTagsHtml");
  });
});
