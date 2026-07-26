/*
Design Philosophy: Professional Certificate — Single-page printable document.
Matches the reference design: Header with logos, status badges, blind info grid,
workflow log, execution/torque table, QR code, final approvals, and footer.
All sections are controlled by certificate settings from the admin panel.
Uses real QR code generation via the qrcode library.
*/
import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

export default function BlindCertificate() {
  const [, params] = useRoute("/certificate/:projectId/:tag");
  const projectId = params?.projectId ?? "";
  const tag = decodeURIComponent(params?.tag ?? "");

  const certSettings = trpc.settings.certificate.get.useQuery();
  const generalSettings = trpc.settings.general.get.useQuery();
  const projectQuery = trpc.projects.detail.useQuery({ id: projectId }, { enabled: !!projectId });

  const blind = projectQuery.data?.blinds?.find((b: any) => b.tag === tag);
  const projectDetail = projectQuery.data;
  const project = projectDetail?.project;
  const cert = certSettings.data;
  const general = generalSettings.data;

  // QR code as data URL
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const qrData = project && blind ? JSON.stringify({
    app: "SBTS",
    v: (general as any)?.versionName || "1.0",
    certificateId: `CERT-${projectId.slice(0, 8)}-${tag}`,
    project: { id: projectId, name: (project as any).name },
    blind: { tag: blind.tag, type: blind.type, phase: blind.phase },
  }) : "";

  useEffect(() => {
    if (qrData) {
      QRCode.toDataURL(qrData, { width: 128, margin: 1, errorCorrectionLevel: "M" })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    }
  }, [qrData]);

  const handlePrint = () => {
    window.print();
  };

  if (!cert || !projectDetail || !project || !blind) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Loading certificate...</p>
        </div>
      </div>
    );
  }

  // Determine visibility from settings
  const showBlindInfo = (cert as any).showBlindInfo !== 0;
  const showProjectInfo = (cert as any).showProjectInfo !== 0;
  const showAreaInfo = (cert as any).showAreaInfo !== 0;
  const showWorkflowLog = (cert as any).showWorkflowLog !== 0;
  const showExecutionTorque = (cert as any).showExecutionTorque !== 0;
  const showFinalApprovals = (cert as any).showFinalApprovals !== 0;
  const showQrCode = (cert as any).showQrCode !== 0;
  const showLockStatus = (cert as any).showLockStatus !== 0;
  const statusBadgeText = (cert as any).statusBadgeText || "APPROVED";
  const lockBadgeText = (cert as any).lockBadgeText || "LOCKED / FINAL";

  // Get workflow logs from projectDetail (phase timeline for this blind)
  const blindDetail = (projectDetail as any).blindDetails?.find?.((bd: any) => bd.blind?.tag === tag);
  const workflowLogs: any[] = blindDetail?.logs || (projectDetail as any).logs || [];

  // Get phase approvals from projectDetail
  const phaseApprovals: any[] = blindDetail?.phaseTimeline?.filter?.((pt: any) => pt.approved) || [];

  return (
    <>
      {/* Print button - hidden in print */}
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <Button onClick={handlePrint} className="gap-2 rounded-xl bg-slate-900 text-white shadow-lg hover:bg-slate-700">
          <Printer className="h-4 w-4" /> Print Certificate
        </Button>
      </div>

      {/* Certificate Document */}
      <div className="certificate-page mx-auto bg-white print:m-0 print:shadow-none" style={{ maxWidth: "297mm", minHeight: "210mm", padding: "12mm" }}>
        {/* Header Row */}
        <div className="flex items-start justify-between border-b-2 border-slate-200 pb-3">
          {/* Left: System Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-extrabold">
              SB
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">{cert.headerCompanyName || "Smart Blind Tag System"}</div>
            </div>
          </div>

          {/* Center: Title */}
          <div className="text-center">
            <h1 className="text-lg font-extrabold text-slate-900">{cert.certificateTitle || "Smart Blind Tag System Certificate"}</h1>
            {/* Status Badge */}
            <div className="mt-1 inline-block rounded-full border border-emerald-300 bg-emerald-50 px-4 py-0.5 text-xs font-extrabold text-emerald-700">
              {statusBadgeText}
            </div>
          </div>

          {/* Right: Lock Badge + Logo */}
          <div className="flex items-center gap-3 text-right">
            {showLockStatus && (
              <span className="text-xs font-extrabold text-red-600">{lockBadgeText}</span>
            )}
            {cert.logoUrl && (
              <img src={cert.logoUrl} alt="Company" className="h-12 max-w-[100px] object-contain" />
            )}
          </div>
        </div>

        {/* Blind Information Grid */}
        {showBlindInfo && (
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
            {showAreaInfo && (
              <InfoCell label="Area" value={(project as any).areaCode || "-"} />
            )}
            {showProjectInfo && (
              <InfoCell label="Project" value={(project as any).name || "-"} />
            )}
            <InfoCell label="Blind" value={blind.tag} />
            <InfoCell label="Line" value={blind.equipment || "-"} />
            <InfoCell label="Type" value={blind.type || "-"} />
            <InfoCell label="Size" value={blind.size || "-"} />
            <InfoCell label="Current phase" value={blind.phase || "-"} />
            <InfoCell label="Priority" value={blind.priority || "-"} />
          </div>
        )}

        {/* Workflow Log */}
        {showWorkflowLog && (
          <div className="mt-5">
            <h2 className="text-sm font-extrabold text-slate-900 mb-2">Workflow log</h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2 text-left font-bold">Date</th>
                  <th className="px-3 py-2 text-left font-bold">From</th>
                  <th className="px-3 py-2 text-left font-bold">To</th>
                  <th className="px-3 py-2 text-left font-bold">Worker</th>
                  <th className="px-3 py-2 text-left font-bold">Role</th>
                </tr>
              </thead>
              <tbody>
                {workflowLogs.length > 0 ? workflowLogs.map((log: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2">{log.fromPhase || log.previousPhase || "-"}</td>
                    <td className="px-3 py-2">{log.toPhase || log.newPhase || "-"}</td>
                    <td className="px-3 py-2">{log.actorName || log.changedBy || "-"}</td>
                    <td className="px-3 py-2">{log.actorRole || log.role || "-"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-slate-400 italic">No changes yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Execution / Torque + QR Code */}
        {showExecutionTorque && (
          <div className="mt-5 flex gap-6">
            <div className="flex-1">
              <h2 className="text-sm font-extrabold text-slate-900 mb-2">Execution / Torque</h2>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-3 py-2 text-left font-bold">Item</th>
                    <th className="px-3 py-2 text-left font-bold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2">Torque (PSI)</td><td className="px-3 py-2">{(blind as any).torquePsi || "N/A"}</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2">Torque Type</td><td className="px-3 py-2">{(blind as any).torqueType || "N/A"}</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2">Technician</td><td className="px-3 py-2">{blind.owner || "N/A"}</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2">Tool ID</td><td className="px-3 py-2">{(blind as any).toolId || "N/A"}</td></tr>
                </tbody>
              </table>
            </div>
            {showQrCode && (
              <div className="flex flex-col items-center justify-center">
                <div className="flex h-28 w-28 items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-1">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="h-full w-full" />
                  ) : (
                    <div className="text-[8px] text-slate-400">QR</div>
                  )}
                </div>
                <div className="mt-1 max-w-[120px] text-center text-[7px] text-slate-400 break-all leading-tight">
                  {qrData.slice(0, 80)}...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final Approvals */}
        {showFinalApprovals && (
          <div className="mt-5">
            <h2 className="text-sm font-extrabold text-slate-900 mb-2">Final approvals</h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2 text-left font-bold">Approval</th>
                  <th className="px-3 py-2 text-left font-bold">Approved</th>
                  <th className="px-3 py-2 text-left font-bold">By</th>
                  <th className="px-3 py-2 text-left font-bold">Date</th>
                </tr>
              </thead>
              <tbody>
                {phaseApprovals.length > 0 ? phaseApprovals.map((approval: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2">{approval.phase || approval.approvalType || "-"}</td>
                    <td className="px-3 py-2 font-bold">{approval.approved ? "YES" : "NO"}</td>
                    <td className="px-3 py-2">{approval.approverName || approval.actorName || "-"}</td>
                    <td className={`px-3 py-2 ${!approval.approvedAt ? "text-red-500" : ""}`}>
                      {approval.approvedAt ? new Date(approval.approvedAt).toLocaleDateString() : "Pending"}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-slate-400 italic">No approvals recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature Section */}
        {(cert as any).signatureUrl && (
          <div className="mt-5 flex justify-end">
            <div className="text-center">
              <img src={(cert as any).signatureUrl} alt="Signature" className="h-16 object-contain" />
              <div className="mt-1 border-t border-slate-300 pt-1 text-[10px] text-slate-500">Authorized Signature</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-3 text-[10px] text-slate-500">
          <div>{cert.footerText || "This is a digital certificate (no handwritten signature required)."}</div>
          <div>Generated from SBTS local data.</div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white !important; }
          .certificate-page { box-shadow: none !important; max-width: none !important; width: 100% !important; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>
    </>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center rounded-lg border border-slate-200 px-3 py-1.5">
      <span className="text-xs font-bold text-slate-600 mr-2">{label}:</span>
      <span className="text-xs text-slate-900">{value}</span>
    </div>
  );
}
