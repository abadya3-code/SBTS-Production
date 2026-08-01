import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import QRCode from "qrcode";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function statusClass(status: string) {
  if (status === "issued") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "revoked") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function CertificateVerification() {
  const [, params] = useRoute("/certificate/verify/:token");
  const token = decodeURIComponent(params?.token ?? "");
  const query = trpc.certificates.verify.useQuery(
    { token },
    { enabled: token.length >= 20, retry: false },
  );
  const [verificationQr, setVerificationQr] = useState("");

  useEffect(() => {
    if (!query.data || typeof window === "undefined") return;
    const verificationUrl = `${window.location.origin}/certificate/verify/${encodeURIComponent(token)}`;
    QRCode.toDataURL(verificationUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then(setVerificationQr)
      .catch(() => setVerificationQr(""));
  }, [query.data, token]);

  if (query.isPending) {
    return <PublicFrame><div className="py-24 text-center text-sm text-slate-500">Verifying controlled certificate…</div></PublicFrame>;
  }

  if (query.error || !query.data) {
    return <PublicFrame><Card className="mx-auto max-w-xl border-red-200"><CardContent className="flex flex-col items-center gap-4 p-10 text-center"><AlertTriangle className="h-12 w-12 text-red-600" /><div><h1 className="text-xl font-black text-slate-950">Certificate could not be verified</h1><p className="mt-2 text-sm text-slate-600">{query.error?.message || "The verification token is invalid or unavailable."}</p></div></CardContent></Card></PublicFrame>;
  }

  const data = query.data;
  const snapshot = data.publicSnapshot;
  const valid = data.hashValid && data.status === "issued";
  return <PublicFrame>
    <div className="certificate-print-page mx-auto max-w-6xl space-y-5">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: #fff !important; }
          .certificate-print-page { max-width: none !important; zoom: 0.72; }
          .certificate-print-page > * { break-inside: avoid; }
          .certificate-print-page .shadow-sm { box-shadow: none !important; }
        }
      `}</style>
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {valid ? <ShieldCheck className="h-7 w-7" /> : <Ban className="h-7 w-7" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">SBTS Controlled Certificate</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{data.certificateNumber}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className={statusClass(data.status)}>{data.status.toUpperCase()}</Badge>
              <Badge variant="outline" className={data.hashValid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}>{data.hashValid ? "HASH VERIFIED" : "HASH MISMATCH"}</Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">VERSION {data.version}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {verificationQr && (
            <div className="rounded-xl border border-slate-200 bg-white p-1.5 text-center">
              <img
                src={verificationQr}
                alt={`Certificate verification QR for ${data.certificateNumber}`}
                className="h-20 w-20"
              />
              <p className="mt-1 text-[8px] font-bold uppercase tracking-wide text-slate-500">
                Verify
              </p>
            </div>
          )}
          <Button variant="outline" className="gap-2 print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save PDF</Button>
        </div>
      </div>

      {data.status === "revoked" && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><strong>Revoked certificate:</strong> {data.revocationReason || "No public reason provided."}</div>}
      {data.status === "superseded" && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This certificate version has been superseded by a controlled later revision.</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-slate-200 lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-blue-700" /> Certificate identity</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <Info label="Project" value={snapshot.project.name || snapshot.project.id} />
          <Info label="Project status" value={snapshot.project.status} />
          <Info label="Blind tag" value={snapshot.blind.tag} />
          <Info label="Equipment / line" value={snapshot.blind.equipment || snapshot.blind.lineNumber} />
          <Info label="Blind type" value={snapshot.blind.type} />
          <Info label="Size / rating" value={[snapshot.blind.size, snapshot.blind.rating].filter(Boolean).join(" · ")} />
          <Info label="Material" value={snapshot.blind.material} />
          <Info label="P&ID reference" value={snapshot.blind.pidReference} />
        </CardContent></Card>

        <Card className="border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-violet-700" /> Governance</CardTitle></CardHeader><CardContent className="space-y-4">
          <Info label="Issued at" value={formatDate(data.issuedAt)} />
          <Info label="Issued by" value={data.issuedByName} />
          <Info label="Workflow status" value={snapshot.workflow.lifecycleStatus} />
          <Info label="Workflow locked" value={snapshot.workflow.locked ? "Yes" : "No"} />
        </CardContent></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-700" /> Final approvals</CardTitle></CardHeader><CardContent className="space-y-2">
          {snapshot.finalApprovals.length ? snapshot.finalApprovals.map((approval: any) => <div key={approval.role} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="text-sm font-bold text-slate-900">{String(approval.role).replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{approval.approvedByName || "Controlled role approval"} · {formatDate(approval.approvedAt)}</p></div><Badge variant="outline" className={approval.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}>{String(approval.status).replaceAll("_", " ")}</Badge></div>) : <Empty text="No public approval summary." />}
        </CardContent></Card>

        <Card className="border-slate-200"><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-cyan-700" /> Closeout summary</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
          <Info label="Leak test" value={snapshot.leakTest?.status || "—"} />
          <Info label="No leak observed" value={snapshot.leakTest ? (snapshot.leakTest.noLeakObserved ? "Yes" : "No") : "—"} />
          <Info label="Defects controlled" value={`${snapshot.qualitySummary.defectsClosedOrTransferred} / ${snapshot.qualitySummary.defects}`} />
          <Info label="Open mandatory punch" value={snapshot.qualitySummary.mandatoryPunchItemsOpen} />
          <Info label="Accepted NDT records" value={`${snapshot.qualitySummary.ndtAccepted} / ${snapshot.qualitySummary.ndtRecords}`} />
          <Info label="Isolation package" value={snapshot.isolationPackages.map((item: any) => item.packageId).join(", ") || "—"} />
        </CardContent></Card>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">SHA-256 snapshot fingerprint</p>
        <p className="mt-2 break-all font-mono text-xs leading-6">{data.snapshotHash}</p>
        <p className="mt-3 text-xs text-slate-400">The public page confirms the immutable certificate snapshot without exposing permits, LOTO details, gas readings, evidence files or internal user identifiers.</p>
      </div>
    </div>
  </PublicFrame>;
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 print:bg-white print:p-0"><header className="mx-auto mb-6 flex max-w-6xl items-center gap-3 print:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">SB</div><div><p className="text-sm font-black">SBTS Professional</p><p className="text-xs text-slate-500">Public certificate verification</p></div></header>{children}</div>;
}
function Info({ label, value }: { label: string; value: unknown }) { return <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-950">{value === null || value === undefined || value === "" ? "—" : String(value).replaceAll("_", " ")}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{text}</div>; }
