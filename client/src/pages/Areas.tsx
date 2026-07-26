/*
Design Philosophy: Industrial Command Center Minimalism.
The areas page acts as the operational map before entering projects: each area card exposes project load, readiness, and a direct contextual path into its project list.
*/
import { Activity, AlertTriangle, ArrowRight, Layers3, MapPinned, Plus, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/common/PageHeader";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function AreaSkeletonGrid() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="sbts-card p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-44 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          <div className="mt-5 h-9 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function Areas() {
  const areasQuery = trpc.areas.list.useQuery();
  const areas = areasQuery.data ?? [];
  const totalProjects = areas.reduce((sum, area) => sum + area.projectCount, 0);
  const activeAreas = areas.filter((area) => area.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Area command map"
        title="Areas"
        description="Browse plant areas as first-class operational containers, then open the linked project scope without losing context. Counts and status come directly from the database."
        actions={
          <button
            onClick={() => toast.info("Area creation API is ready; the full form will be added after the review of required fields.")}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> New Area
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="sbts-card overflow-hidden p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Total areas</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{areasQuery.isLoading ? "—" : areas.length}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
              <MapPinned className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="sbts-card overflow-hidden p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Linked projects</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{areasQuery.isLoading ? "—" : totalProjects}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <Layers3 className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="sbts-card overflow-hidden p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Active zones</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{areasQuery.isLoading ? "—" : activeAreas}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
              <Activity className="h-6 w-6" />
            </div>
          </div>
        </div>
      </section>

      {areasQuery.isLoading && <AreaSkeletonGrid />}

      {areasQuery.isError && (
        <div className="sbts-card border-red-100 bg-red-50/80 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-base font-extrabold text-red-950">Areas could not be loaded</h3>
                <p className="mt-1 text-sm font-medium text-red-700">The database-backed areas API returned an error. Retry after confirming the server connection.</p>
              </div>
            </div>
            <button onClick={() => areasQuery.refetch()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-800">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </div>
      )}

      {!areasQuery.isLoading && !areasQuery.isError && areas.length === 0 && (
        <div className="sbts-card p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <MapPinned className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-xl font-extrabold text-slate-950">No areas registered yet</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-slate-600">Create the first area to group projects by plant location and make browsing less repetitive for coordinators and field teams.</p>
        </div>
      )}

      {!areasQuery.isLoading && !areasQuery.isError && areas.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-3">
          {areas.map((area) => (
            <Link key={area.id} href={`/areas/${area.id}/projects`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-4">
              <article className="sbts-card relative h-full overflow-hidden p-5 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_22px_55px_rgba(15,39,56,0.13)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-slate-300" />
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-cyan-700">{area.code}</div>
                    <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-950">{area.name}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${area.isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                    {area.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="min-h-[48px] text-sm font-medium leading-6 text-slate-600">{area.description ?? "Operational area ready for linked SBTS projects."}</p>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Projects in area</div>
                      <div className="mt-1 text-2xl font-extrabold text-slate-950">{area.projectCount}</div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm ring-1 ring-slate-100">
                      <Layers3 className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
                    <MapPinned className="h-3.5 w-3.5" />
                    <span>{area.location ?? "Location pending"}</span>
                  </div>
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-cyan-700 transition group-hover:gap-3 group-hover:text-cyan-900">
                  Open linked projects <ArrowRight className="h-4 w-4" />
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
