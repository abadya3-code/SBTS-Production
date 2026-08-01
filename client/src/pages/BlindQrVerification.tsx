import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LogIn,
  Printer,
  QrCode as QrCodeIcon,
  ShieldAlert,
} from "lucide-react";
import QRCode from "qrcode";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VerificationStatus = "active" | "superseded" | "revoked";

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function statusPresentation(status: VerificationStatus) {
  if (status === "active") {
    return {
      title: "Active blind QR",
      description: "This is the current controlled QR token for this blind.",
      icon: CheckCircle2,
      frame: "border-emerald-200 bg-emerald-50 text-emerald-900",
      badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
    };
  }
  if (status === "superseded") {
    return {
      title: "Superseded blind QR",
      description: "A newer controlled QR token has replaced this version.",
      icon: Clock3,
      frame: "border-amber-200 bg-amber-50 text-amber-900",
      badge: "border-amber-200 bg-amber-100 text-amber-800",
    };
  }
  return {
    title: "Revoked blind QR",
    description: "This QR token is no longer valid. Contact the project team.",
    icon: ShieldAlert,
    frame: "border-red-200 bg-red-50 text-red-900",
    badge: "border-red-200 bg-red-100 text-red-800",
  };
}

export default function BlindQrVerification() {
  const [, params] = useRoute("/blind/verify/:token");
  const token = decodeURIComponent(params?.token ?? "");
  const validTokenShape = /^[A-Za-z0-9_-]{32,96}$/.test(token);
  const query = trpc.blindQr.verify.useQuery(
    { token },
    { enabled: validTokenShape, retry: false }
  );
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!validTokenShape) return;
    const verificationUrl = `${window.location.origin}/blind/verify/${encodeURIComponent(token)}`;
    QRCode.toDataURL(verificationUrl, {
      width: 192,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [token, validTokenShape]);

  if (!validTokenShape) {
    return (
      <PublicFrame>
        <ErrorCard
          title="Invalid QR code"
          description="The verification link is incomplete or malformed. Scan the printed tag again."
        />
      </PublicFrame>
    );
  }

  if (query.isPending) {
    return (
      <PublicFrame>
        <div className="py-24 text-center text-sm text-slate-500">
          Verifying controlled blind QR…
        </div>
      </PublicFrame>
    );
  }

  if (query.error || !query.data) {
    const authenticationRequired = query.error?.data?.code === "UNAUTHORIZED";
    return (
      <PublicFrame>
        <ErrorCard
          title={
            authenticationRequired
              ? "Sign in required"
              : "Blind QR could not be verified"
          }
          description={
            authenticationRequired
              ? "Plant security settings require an authenticated SBTS session before blind details can be shown."
              : query.error?.message ||
                "The QR token is invalid or unavailable."
          }
          action={
            authenticationRequired ? (
              <Button asChild className="gap-2">
                <a
                  href={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
                >
                  <LogIn className="h-4 w-4" /> Sign in
                </a>
              </Button>
            ) : undefined
          }
        />
      </PublicFrame>
    );
  }

  const data = query.data;
  const presentation = statusPresentation(
    data.verification.status as VerificationStatus
  );
  const StatusIcon = presentation.icon;

  return (
    <PublicFrame>
      <div className="mx-auto max-w-5xl space-y-5">
        <section
          className={`flex flex-col gap-4 rounded-3xl border p-6 shadow-sm sm:flex-row sm:items-start sm:justify-between ${presentation.frame}`}
        >
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
              <StatusIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] opacity-70">
                SBTS Blind Verification
              </p>
              <h1 className="mt-1 text-2xl font-black">{presentation.title}</h1>
              <p className="mt-2 text-sm opacity-80">
                {presentation.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className={presentation.badge}>
                  {data.verification.status.toUpperCase()}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-white/80 text-slate-700"
                >
                  VERSION {data.verification.version}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 bg-white/80 print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" /> Print verification
          </Button>
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="border-slate-200 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5 text-cyan-700" /> Blind identity
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="Blind tag" value={data.blind.tag} />
              <Info label="Current phase" value={data.blind.phase} />
              <Info label="Type" value={data.blind.type} />
              <Info
                label="Size / rating"
                value={[data.blind.size, data.blind.rating]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Info label="Priority" value={data.blind.priority} />
              <Info label="Equipment" value={data.blind.equipment} />
              <Info label="Material" value={data.blind.material} />
              <Info label="Flange type" value={data.blind.flangeType} />
              <Info label="Line number" value={data.blind.lineNumber} />
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Project context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Info
                label="Project"
                value={data.project.name || data.project.id}
              />
              <Info label="Project ID" value={data.project.id} />
              <Info label="Project status" value={data.project.status} />
              <Info
                label="Issued"
                value={formatDate(data.verification.issuedAt)}
              />
              <Info
                label="Verified"
                value={formatDate(data.verification.scannedAt)}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 print:hidden">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
            <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Blind verification QR"
                  className="h-full w-full"
                />
              ) : (
                <QrCodeIcon className="h-16 w-16 text-slate-300" />
              )}
            </div>
            <div>
              <h2 className="font-black text-slate-950">
                Controlled verification link
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                This public view uses an allowlisted operational summary. It
                does not expose permits, LOTO records, evidence, notes, user
                identifiers, or approval actors.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicFrame>
  );
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <header className="mx-auto mb-6 flex max-w-5xl items-center gap-3 print:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
          SB
        </div>
        <div>
          <p className="text-sm font-black">SBTS Professional</p>
          <p className="text-xs text-slate-500">Secure blind QR verification</p>
        </div>
      </header>
      {children}
    </div>
  );
}

function ErrorCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-xl border-red-200">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <AlertTriangle className="h-12 w-12 text-red-600" />
        <div>
          <h1 className="text-xl font-black text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">
        {value === null || value === undefined || value === ""
          ? "—"
          : String(value)}
      </p>
    </div>
  );
}
