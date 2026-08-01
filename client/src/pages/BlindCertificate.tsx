import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, ExternalLink, LockKeyhole } from "lucide-react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Compatibility route for the former locally assembled certificate page.
 * It deliberately refuses to build a certificate from live/unlocked records.
 * A printable page is opened only for the current immutable certificate token.
 */
export default function BlindCertificate() {
  const [, params] = useRoute("/certificate/:projectId/:tag");
  const projectId = params?.projectId ?? "";
  const blindTag = decodeURIComponent(params?.tag ?? "");
  const list = trpc.certificates.list.useQuery(
    { projectId, blindTag },
    { enabled: Boolean(projectId && blindTag), retry: false }
  );
  const readiness = trpc.certificates.readiness.useQuery(
    { projectId, blindTag },
    { enabled: Boolean(projectId && blindTag), retry: false }
  );
  const current = list.data?.find(certificate => certificate.status === "issued");
  const verificationHref = current
    ? `/certificate/verify/${current.verificationToken}`
    : null;

  useEffect(() => {
    if (verificationHref) window.location.replace(verificationHref);
  }, [verificationHref]);

  const blindHref = `/projects/${encodeURIComponent(projectId)}/blinds/${encodeURIComponent(blindTag)}`;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
            SB
          </div>
          <div>
            <p className="font-black">SBTS Professional</p>
            <p className="text-xs text-slate-500">Controlled certificate gateway</p>
          </div>
        </div>

        {list.isPending ? (
          <Card className="border-slate-200">
            <CardContent className="py-16 text-center text-sm text-slate-500">
              Checking the governed certificate register…
            </CardContent>
          </Card>
        ) : verificationHref ? (
          <Card className="border-emerald-200">
            <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
              <LockKeyhole className="h-12 w-12 text-emerald-700" />
              <div>
                <h1 className="text-xl font-black">Opening controlled certificate</h1>
                <p className="mt-2 text-sm text-slate-600">
                  The immutable, hash-verified certificate is ready for printing or PDF export.
                </p>
              </div>
              <a href={verificationHref}>
                <Button className="gap-2">
                  Open certificate <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-950">
                <AlertTriangle className="h-5 w-5" /> Certificate is not available yet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-6 text-slate-700">
                SBTS does not create a printable certificate from unfinished or mutable records.
                Complete the controlled workflow and issue the final certificate from Certificate
                Governance first.
              </p>
              {readiness.data?.blockingReasons.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-bold">Current blockers</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {readiness.data.blockingReasons.map(reason => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(list.error || readiness.error) && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {list.error?.message ?? readiness.error?.message}
                </div>
              )}
              <Link href={blindHref}>
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Return to blind workflow
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
