import { ChevronRight, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PhaseOwner {
  openId: string;
  name: string;
  avatarUrl?: string | null;
  email?: string | null;
}

interface PhaseData {
  phase: string;
  shortLabel?: string;
  color: string;
  count: number;
  progress: number;
  owners: PhaseOwner[];
  ownerRole?: string;
  isCritical?: boolean;
}

interface WorkflowPhasesProps {
  phases: PhaseData[];
  onPhaseClick?: (phase: string) => void;
  title?: string;
  description?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(14, 116, 144, ${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function WorkflowPhases({
  phases,
  onPhaseClick,
  title = "Canonical Workflow Phases",
  description = "Live distribution from the database-backed eight-phase runtime.",
}: WorkflowPhasesProps) {
  return (
    <Card className="sbts-card overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-950">
          <Users className="h-5 w-5 text-cyan-700" />
          {title}
        </CardTitle>
        <p className="text-xs font-medium text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-4">
        {phases.map((phaseData, index) => (
          <button
            type="button"
            key={phaseData.phase}
            className="group rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            style={{
              borderColor: hexToRgba(phaseData.color, 0.28),
              backgroundColor: hexToRgba(phaseData.color, 0.055),
            }}
            onClick={() => onPhaseClick?.(phaseData.phase)}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white shadow-sm"
                  style={{ backgroundColor: phaseData.color }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-sm font-black text-slate-950">{phaseData.shortLabel ?? phaseData.phase}</h3>
                  <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{phaseData.ownerRole ?? "Workflow owner"}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </div>

            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Current records</span>
                <span className="font-black text-slate-900">{phaseData.count}</span>
              </div>
              <Progress value={phaseData.progress} className="h-2 bg-white/80" />
              <div className="text-right text-[10px] font-bold text-slate-500">{phaseData.progress}% of registered blinds</div>
            </div>

            <div className="flex min-h-7 items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
              {phaseData.owners.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Assigned</span>
                  <div className="flex -space-x-2">
                    {phaseData.owners.slice(0, 4).map((owner) => (
                      <Avatar key={owner.openId} className="h-6 w-6 border-2 border-white" title={owner.name}>
                        <AvatarImage src={owner.avatarUrl ?? undefined} alt={owner.name} />
                        <AvatarFallback className="text-[10px] font-black">{owner.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: phaseData.color }} />
                  Role controlled
                </div>
              )}
              {phaseData.isCritical && <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-red-700">Critical</span>}
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
