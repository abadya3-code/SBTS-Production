import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Printer,
  QrCode,
} from "lucide-react";
import QRCode from "qrcode";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { BlindTag } from "@/components/tags/BlindTag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { parseTagLayoutJson } from "@shared/tagLayout";

function absoluteVerificationUrl(relativeUrl: string): string {
  return new URL(relativeUrl, window.location.origin).href;
}

export default function BlindTagPrint() {
  const [, params] = useRoute("/tags/print/:projectId");
  const projectId = params?.projectId ?? "";
  const detail = trpc.projects.detail.useQuery(
    { id: projectId },
    { enabled: Boolean(projectId), retry: false }
  );
  const tagSettings = trpc.settings.defaultTag.get.useQuery(undefined, {
    retry: false,
  });
  const generalSettings = trpc.settings.general.get.useQuery(undefined, {
    retry: false,
  });
  const blindTags = useMemo(
    () => detail.data?.blinds.map(blind => blind.tag) ?? [],
    [detail.data?.blinds]
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const selectionInitialized = useRef(false);

  useEffect(() => {
    if (!blindTags.length) return;
    if (!selectionInitialized.current) {
      const requestedTag = new URLSearchParams(window.location.search).get("blind");
      setSelectedTags(
        requestedTag && blindTags.includes(requestedTag) ? [requestedTag] : blindTags
      );
      selectionInitialized.current = true;
      return;
    }
    setSelectedTags(current => current.filter(tag => blindTags.includes(tag)));
  }, [blindTags]);

  const qrState = trpc.blindQr.batchState.useQuery(
    { projectId, blindTags },
    { enabled: Boolean(projectId && blindTags.length), retry: false }
  );
  const generateMissing = trpc.blindQr.generateBatch.useMutation({
    onSuccess: async result => {
      toast.success(
        result.generatedCount
          ? `${result.generatedCount} secure QR token${result.generatedCount === 1 ? "" : "s"} generated.`
          : "All selected blinds already have active QR tokens."
      );
      await qrState.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const preparePrint = trpc.tagPrinting.prepare.useMutation({
    onSuccess: result => {
      if (result.output === "pdf") {
        toast.info("Choose Save as PDF in the browser print dialog.");
      }
      window.setTimeout(() => window.print(), 80);
    },
    onError: error => toast.error(error.message),
  });

  const activeByTag = useMemo(
    () =>
      new Map(
        (qrState.data?.items ?? []).map(item => [item.blindTag, item.active])
      ),
    [qrState.data?.items]
  );

  useEffect(() => {
    let cancelled = false;
    const active = Array.from(activeByTag.entries()).filter(
      (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
        Boolean(entry[1])
    );
    Promise.all(
      active.map(async ([blindTag, token]) => {
        const verificationUrl = absoluteVerificationUrl(token.verificationUrl);
        const image = await QRCode.toDataURL(verificationUrl, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        return [blindTag, image] as const;
      })
    )
      .then(entries => {
        if (!cancelled) setQrImages(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setQrImages({});
      });
    return () => {
      cancelled = true;
    };
  }, [activeByTag]);

  const layout = useMemo(
    () =>
      parseTagLayoutJson(tagSettings.data?.layoutJson, {
        widthMm: tagSettings.data?.tagWidth ?? 70,
        heightMm: tagSettings.data?.tagHeight ?? 110,
      }),
    [
      tagSettings.data?.layoutJson,
      tagSettings.data?.tagHeight,
      tagSettings.data?.tagWidth,
    ]
  );
  const selectedBlinds = (detail.data?.blinds ?? []).filter(blind =>
    selectedTags.includes(blind.tag)
  );
  const missingQrTags = selectedTags.filter(tag => !activeByTag.get(tag));
  const pendingQrImages = selectedTags.filter(tag => !qrImages[tag]);
  const readyToPrint =
    selectedTags.length > 0 &&
    missingQrTags.length === 0 &&
    pendingQrImages.length === 0;
  const project = detail.data?.project;

  const toggleTag = (tag: string, checked: boolean) => {
    setSelectedTags(current =>
      checked
        ? Array.from(new Set([...current, tag]))
        : current.filter(candidate => candidate !== tag)
    );
  };

  const prepare = (output: "print" | "pdf") => {
    if (!readyToPrint) {
      toast.error("Generate all missing QR tokens before printing.");
      return;
    }
    preparePrint.mutate({ projectId, blindTags: selectedTags, output });
  };

  const loading =
    detail.isPending || tagSettings.isPending || generalSettings.isPending;
  const error =
    detail.error ?? tagSettings.error ?? generalSettings.error ?? qrState.error;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <style>{`
        @media print {
          @page { size: ${layout.canvas.widthMm}mm ${layout.canvas.heightMm}mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .tag-print-page { page-break-after: always; break-after: page; margin: 0 !important; }
          .tag-print-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      <section className="print:hidden">
        <div className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">
                Controlled print center
              </p>
              <h1 className="mt-1 text-2xl font-black">Blind Tags · {projectId}</h1>
              <p className="mt-1 text-sm text-slate-600">
                Saved layout, secure per-Blind QR URLs, and one physical page per tag.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/projects/${encodeURIComponent(projectId)}`}>
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Project
                </Button>
              </Link>
              <Button
                variant="outline"
                className="gap-2"
                disabled={!blindTags.length || generateMissing.isPending}
                onClick={() =>
                  generateMissing.mutate({ projectId, blindTags })
                }
              >
                <QrCode className="h-4 w-4" /> Generate missing QR
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={!readyToPrint || preparePrint.isPending}
                onClick={() => prepare("pdf")}
              >
                <FileDown className="h-4 w-4" /> Save PDF
              </Button>
              <Button
                className="gap-2"
                disabled={!readyToPrint || preparePrint.isPending}
                onClick={() => prepare("print")}
              >
                <Printer className="h-4 w-4" /> Print selected
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 py-5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Loading the controlled tag package…
            </div>
          ) : error ? (
            <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">Tag package is unavailable</p>
                <p className="mt-1 text-sm">{error.message}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">Print selection</p>
                    <p className="text-xs text-slate-500">
                      {selectedTags.length} of {blindTags.length} selected
                    </p>
                  </div>
                  <Checkbox
                    checked={
                      blindTags.length > 0 && selectedTags.length === blindTags.length
                    }
                    onCheckedChange={checked =>
                      setSelectedTags(checked === true ? blindTags : [])
                    }
                    aria-label="Select all blind tags"
                  />
                </div>
                <div className="mt-4 max-h-[62vh] space-y-2 overflow-auto pr-1">
                  {(detail.data?.blinds ?? []).map(blind => {
                    const active = activeByTag.get(blind.tag);
                    return (
                      <label
                        key={blind.tag}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                      >
                        <Checkbox
                          checked={selectedTags.includes(blind.tag)}
                          onCheckedChange={checked =>
                            toggleTag(blind.tag, checked === true)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black">
                            {blind.tag}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {blind.equipment || blind.lineNumber || "No line assigned"}
                          </span>
                        </span>
                        {active ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </aside>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="font-black">Physical preview</p>
                    <p className="text-xs text-slate-500">
                      {layout.canvas.widthMm} × {layout.canvas.heightMm} mm · one tag per page
                    </p>
                  </div>
                  {missingQrTags.length ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      {missingQrTags.length} QR token{missingQrTags.length === 1 ? "" : "s"} missing
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      Secure QR ready
                    </span>
                  )}
                </div>
                <div className="mt-5 flex max-h-[70vh] flex-wrap justify-center gap-5 overflow-auto rounded-xl bg-slate-200/60 p-6">
                  {selectedBlinds.slice(0, 6).map(blind => {
                    const active = activeByTag.get(blind.tag);
                    return (
                      <div key={blind.tag} className="origin-top scale-[0.78]">
                        <BlindTag
                          layout={layout}
                          content={{
                            area: project
                              ? `${project.areaCode} · ${project.areaName}`
                              : "—",
                            line:
                              blind.lineNumber || blind.equipment || "Not assigned",
                            id: blind.tag,
                            size: blind.size,
                            rating: blind.rate || "—",
                            project: project
                              ? `${project.id} · ${project.name}`
                              : projectId,
                            qrDataUrl: qrImages[blind.tag] ?? null,
                            verificationUrl: active?.verificationUrl ?? null,
                            logoUrl: generalSettings.data?.companyLogoUrl ?? null,
                            date: new Date().toLocaleDateString(),
                          }}
                        />
                      </div>
                    );
                  })}
                  {selectedBlinds.length > 6 && (
                    <div className="flex items-center text-sm font-bold text-slate-600">
                      + {selectedBlinds.length - 6} more tags in the print package
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="hidden print:block">
        {selectedBlinds.map(blind => {
          const active = activeByTag.get(blind.tag);
          return (
            <div key={blind.tag} className="tag-print-page">
              <BlindTag
                layout={layout}
                content={{
                  area: project ? `${project.areaCode} · ${project.areaName}` : "—",
                  line: blind.lineNumber || blind.equipment || "Not assigned",
                  id: blind.tag,
                  size: blind.size,
                  rating: blind.rate || "—",
                  project: project ? `${project.id} · ${project.name}` : projectId,
                  qrDataUrl: qrImages[blind.tag] ?? null,
                  verificationUrl: active?.verificationUrl ?? null,
                  logoUrl: generalSettings.data?.companyLogoUrl ?? null,
                  date: new Date().toLocaleDateString(),
                }}
              />
            </div>
          );
        })}
      </main>
    </div>
  );
}
