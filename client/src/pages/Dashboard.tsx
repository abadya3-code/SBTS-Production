/*
Design Philosophy: Industrial Command Center Minimalism.
The dashboard functions as the first operations-room view: high signal, low clutter, with statuses, ownership, and risk surfaced before decorative content.
*/
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock3, FileWarning, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { blindRows, phases, projects, recentEvents } from "@/lib/mockData";
import { trpc } from "@/lib/trpc";

const heroUrl = "https://d2xsxph8kpxj0f.cloudfront.net/95256836/T9nk6A5dkk7H7GaCBwTuhX/sbts-command-center-hero-UhGNvmibStQht4VPE3rmFJ.webp";
const fieldUrl = "https://d2xsxph8kpxj0f.cloudfront.net/95256836/T9nk6A5dkk7H7GaCBwTuhX/sbts-field-qr-blind-tag-ib8jkhZ5Q9DrAYW7LZ3mVY.webp";

export default function Dashboard() {
  const totalBlinds = phases.reduce((sum, phase) => sum + phase.count, 0);
  const completed = phases.find((phase) => phase.key === "finalTight")?.count ?? 0;
  const completion = Math.round((completed / totalBlinds) * 100);

  // Load dynamic settings from General Settings
  const { data: generalSettings } = trpc.settings.general.get.useQuery();
  const heroTitle = generalSettings?.dashboardHeroTitle || "SBTS command center rebuilt for maintainable React architecture.";
  const heroDescription = generalSettings?.dashboardHeroDescription || "The new frontend starts with a centralized Access Control Center, clear domain boundaries, and responsive operational views for mobile field users, tablets, and desktop supervisors.";
  const heroBadge = generalSettings?.dashboardHeroBadge || "Access-first migration";
  const configuredHeroUrl = generalSettings?.dashboardHeroImageUrl || heroUrl;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 text-white shadow-[0_26px_90px_rgba(15,39,56,0.28)]">
        <div className="absolute inset-0 opacity-80" style={{ backgroundImage: `url(${configuredHeroUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/82 to-slate-950/30" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.25fr_0.75fr] lg:p-10">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" /> {heroBadge}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">{heroTitle}</h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{heroDescription}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/access-control" className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-200">
                Open Access Control <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/blinds" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15">
                Review Blind Registry
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { label: "Tracked blinds", value: totalBlinds, icon: FileWarning, tone: "text-cyan-200" },
              { label: "Completion", value: `${completion}%`, icon: TrendingUp, tone: "text-emerald-300" },
              { label: "Active roles", value: 8, icon: Users, tone: "text-amber-200" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="sbts-dark-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-300">{item.label}</span>
                    <Icon className={`h-5 w-5 ${item.tone}`} />
                  </div>
                  <div className="mt-3 text-3xl font-extrabold tracking-tight">{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="sbts-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-950">Workflow phase ownership</h3>
              <p className="mt-1 text-sm text-slate-500">Phase responsibility is now designed to come from one access-control model.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Live model draft</span>
          </div>
          <div className="space-y-3">
            {phases.map((phase) => (
              <div key={phase.key} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-200 hover:shadow-md">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="status-dot" style={{ backgroundColor: phase.color }} />
                    <div>
                      <div className="font-extrabold text-slate-900">{phase.label}</div>
                      <div className="text-xs font-semibold text-slate-500">Owner: {phase.owner}</div>
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-950">{phase.count}</div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, phase.count * 2.4)}%`, backgroundColor: phase.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="sbts-card overflow-hidden">
            <img src={fieldUrl} alt="Industrial blind tag QR field illustration" className="h-52 w-full object-cover" />
            <div className="p-5">
              <h3 className="text-lg font-extrabold text-slate-950">Field-ready QR visibility</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">The frontend structure is prepared for a public QR route where field teams can scan a blind tag and instantly see status, history, and approval context.</p>
            </div>
          </div>

          <div className="sbts-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-950">Recent activity</h3>
              <Clock3 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div key={`${event.title}-${event.time}`} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><CheckCircle2 className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-slate-900">{event.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{event.detail}</div>
                  </div>
                  <div className="text-xs font-bold text-slate-400">{event.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sbts-card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-extrabold text-slate-950">Current blind focus</h3>
          <p className="mt-1 text-sm text-slate-500">Representative registry view that will later connect to the Node + SQL backend.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Tag</th><th className="px-5 py-3">Project</th><th className="px-5 py-3">Area</th><th className="px-5 py-3">Phase</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {blindRows.map((blind) => (
                <tr key={blind.tag} className="bg-white transition hover:bg-cyan-50/40">
                  <td className="px-5 py-4 font-extrabold text-slate-950">{blind.tag}</td>
                  <td className="px-5 py-4 text-slate-600">{blind.project}</td>
                  <td className="px-5 py-4 text-slate-600">{blind.area}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{blind.phase}</span></td>
                  <td className="px-5 py-4 text-slate-600">{blind.owner}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${blind.priority === "High" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{blind.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
