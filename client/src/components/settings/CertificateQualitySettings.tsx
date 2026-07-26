import { Award, ClipboardCheck, FileWarning, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function CertificateQualitySettings({ form, setForm }: { form: any; setForm: React.Dispatch<React.SetStateAction<any>> }) {
  const update = (key: string, value: unknown) => setForm((current: any) => current ? ({ ...current, [key]: value }) : current);
  const prefix = (key: string, value: string) => update(key, value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="sbts-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-extrabold"><Award className="h-5 w-5 text-emerald-700" /> Certificate Governance</CardTitle>
          <CardDescription>Control immutable certificate issue, public verification, reissue and revocation without changing code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Certificate prefix</Label><Input value={form.certificateNumberPrefix} onChange={(event) => prefix("certificateNumberPrefix", event.target.value)} placeholder="CERT" /></div>
            <div className="space-y-1.5"><Label>Public verification base URL</Label><Input value={form.certificatePublicBaseUrl || ""} onChange={(event) => update("certificatePublicBaseUrl", event.target.value || null)} placeholder="https://sbts.example.com" /></div>
          </div>
          {[
            ["certificateVerificationEnabled", "Public certificate verification", "Allow QR verification using a secure token and immutable SHA-256 snapshot hash."],
            ["certificateRequireClosedWorkflow", "Require closed workflow before issue", "Prevent issuance until the eight-phase runtime is closed and locked."],
            ["certificateReissueRequiresReason", "Reason required for reissue", "Create a superseding version while preserving every prior certificate."],
            ["certificateAllowRevocation", "Allow controlled revocation", "Permit revocation only with authority and a permanent reason."],
          ].map(([key, label, description]) => <SettingRow key={key} label={label} description={description} checked={Boolean(form[key])} onChange={(value) => update(key, value)} />)}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900"><ShieldCheck className="mr-1 inline h-4 w-4" />Issued certificates are snapshot-based, versioned, hashed and never edited in place.</div>
        </CardContent>
      </Card>

      <Card className="sbts-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-extrabold"><FileWarning className="h-5 w-5 text-amber-700" /> Defect, Punch & NDT Governance</CardTitle>
          <CardDescription>Configure numbering and closure gates used by Internal Inspection & Work Execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label>Defect prefix</Label><Input value={form.defectNumberPrefix} onChange={(event) => prefix("defectNumberPrefix", event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Punch prefix</Label><Input value={form.punchNumberPrefix} onChange={(event) => prefix("punchNumberPrefix", event.target.value)} /></div>
            <div className="space-y-1.5"><Label>NDT prefix</Label><Input value={form.ndtNumberPrefix} onChange={(event) => prefix("ndtNumberPrefix", event.target.value)} /></div>
          </div>
          {[
            ["requireDefectDispositionBeforeClosure", "Defect disposition required", "Open defects must be accepted, repaired, transferred, closed or cancelled with disposition."],
            ["requireMandatoryPunchClosureBeforeReadyForClosure", "Mandatory punch closure required", "Ready for Closure is blocked while mandatory punch items remain open."],
            ["requireNdtAcceptanceBeforeReadyForClosure", "NDT acceptance required", "Defects marked as requiring NDT must have an accepted result."],
            ["allowPunchTransfer", "Allow controlled punch transfer", "Permit transfer only when a formal destination reference and verification note are stored."],
          ].map(([key, label, description]) => <SettingRow key={key} label={label} description={description} checked={Boolean(form[key])} onChange={(value) => update(key, value)} />)}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900"><ClipboardCheck className="mr-1 inline h-4 w-4" />These policies are enforced by the backend gate, not only by the screen.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-3"><div><p className="text-sm font-bold text-foreground">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
