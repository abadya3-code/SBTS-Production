/*
Design Philosophy: Industrial Command Center Minimalism.
The projects page works in two modes: a full project portfolio and a contextual area scope opened from the Areas page, so users avoid repetitive navigation while keeping area context visible.
*/
import { AlertTriangle, ArrowLeft, ArrowRight, FolderKanban, MapPin, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Link, useRoute } from "wouter";
import { PageHeader } from "@/components/common/PageHeader";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ProjectStatus = "Active" | "Completed" | "On Hold" | "Planning" | "Final Review";

const statusStyles: Record<ProjectStatus, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Completed: "bg-blue-50 text-blue-700 ring-blue-100",
  "On Hold": "bg-amber-50 text-amber-700 ring-amber-100",
  Planning: "bg-slate-100 text-slate-700 ring-slate-200",
  "Final Review": "bg-cyan-50 text-cyan-700 ring-cyan-100",
};

function ProjectSkeletonGrid() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="sbts-card p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-48 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="h-7 w-24 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="mt-5 h-2 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function Projects() {
  const [isAreaRoute, params] = useRoute("/areas/:areaId/projects");
  const requestedAreaId = isAreaRoute ? params?.areaId ?? "" : "";
  const parsedAreaId = Number(requestedAreaId);
  const hasInvalidAreaParam = isAreaRoute && (!Number.isInteger(parsedAreaId) || parsedAreaId <= 0);
  const selectedAreaId = isAreaRoute && !hasInvalidAreaParam ? parsedAreaId : null;
  const isScopedToArea = selectedAreaId !== null;

  const allProjectsQuery = trpc.projects.list.useQuery(undefined, { enabled: !isAreaRoute });
  const areaProjectsQuery = trpc.projects.listByArea.useQuery({ areaId: selectedAreaId ?? 0 }, { enabled: isScopedToArea });
  const areaQuery = trpc.areas.getById.useQuery({ id: selectedAreaId ?? 0 }, { enabled: isScopedToArea });

  const activeProjectsQuery = isScopedToArea ? areaProjectsQuery : allProjectsQuery;
  const projects = activeProjectsQuery.data ?? [];
  const totalBlinds = projects.reduce((sum, project) => sum + project.blindsCount, 0);
  const averageProgress = projects.length > 0 ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0;
  const area = areaQuery.data;
  const isAreaLookupError = isScopedToArea && areaQuery.isError;
  const isAreaMissing = hasInvalidAreaParam || (isScopedToArea && !areaQuery.isLoading && !areaQuery.isError && !area);
  const shouldBlockProjectView = isAreaMissing || isAreaLookupError;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isAreaRoute ? "Area project scope" : "Project control"}
        title={isScopedToArea && area ? `${area.code} Projects` : "Projects"}
        description={
          isScopedToArea && area
            ? `Projects are filtered to ${area.name}. Use this view to move from area context into execution without jumping between unrelated screens.`
            : isAreaRoute
              ? "This contextual project view requires a valid area identifier before projects can be shown."
              : "A database-backed project portfolio linked to operational areas, with progress, blind load, and status visible at a glance."
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {isScopedToArea && (
              <Link href="/areas" className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" /> Areas
              </Link>
            )}
            <button
              onClick={() => toast.info(isScopedToArea ? "Project creation API is ready; the form will open with this area pre-selected." : "Project creation API is ready; select an area first for the fastest entry flow.")}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> New project
            </button>
          </div>
        }
      />

      {isAreaMissing && (
        <div className="sbts-card border-amber-100 bg-amber-50/80 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <h3 className="text-base font-extrabold text-amber-950">Area not found</h3>
                <p className="mt-1 text-sm font-medium text-amber-800">The requested area identifier is invalid, does not exist, or is no longer active. Return to Areas to choose a valid operational scope.</p>
              </div>
            </div>
            <Link href="/areas" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-amber-800">
              <ArrowLeft className="h-4 w-4" /> Back to Areas
            </Link>
          </div>
        </div>
      )}

      {isAreaLookupError && (
        <div className="sbts-card border-red-100 bg-red-50/80 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-base font-extrabold text-red-950">Area lookup failed</h3>
                <p className="mt-1 text-sm font-medium text-red-700">The selected area could not be verified. Retry the lookup or return to the Areas map.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => areaQuery.refetch()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-800">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
              <Link href="/areas" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" /> Areas
              </Link>
            </div>
          </div>
        </div>
      )}

      {isScopedToArea && area && (
        <section className="sbts-card overflow-hidden p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-cyan-700">Selected area</div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">{area.name}</h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">{area.description ?? "This area is available for linked project execution."}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Projects</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-950">{projects.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Blinds</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-950">{totalBlinds}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Progress</div>
                <div className="mt-1 text-2xl font-extrabold text-slate-950">{averageProgress}%</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {!shouldBlockProjectView && (
      <section className="grid gap-4 md:grid-cols-3">
        <div className="sbts-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Visible projects</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{activeProjectsQuery.isLoading ? "—" : projects.length}</div>
            </div>
            <FolderKanban className="h-8 w-8 text-cyan-700" />
          </div>
        </div>
        <div className="sbts-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Blind load</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{activeProjectsQuery.isLoading ? "—" : totalBlinds}</div>
            </div>
            <ShieldCheck className="h-8 w-8 text-emerald-700" />
          </div>
        </div>
        <div className="sbts-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Avg progress</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{activeProjectsQuery.isLoading ? "—" : `${averageProgress}%`}</div>
            </div>
            <MapPin className="h-8 w-8 text-amber-700" />
          </div>
        </div>
      </section>
      )}

      {!shouldBlockProjectView && activeProjectsQuery.isLoading && <ProjectSkeletonGrid />}

      {!shouldBlockProjectView && activeProjectsQuery.isError && (
        <div className="sbts-card border-red-100 bg-red-50/80 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-base font-extrabold text-red-950">Projects could not be loaded</h3>
                <p className="mt-1 text-sm font-medium text-red-700">The project API did not respond successfully. Retry after confirming the database connection.</p>
              </div>
            </div>
            <button onClick={() => activeProjectsQuery.refetch()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-800">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </div>
      )}

      {!shouldBlockProjectView && !activeProjectsQuery.isLoading && !activeProjectsQuery.isError && projects.length === 0 && (
        <div className="sbts-card p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-xl font-extrabold text-slate-950">No projects in this scope</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-slate-600">Create a project from this context to keep the area relationship assigned automatically and reduce duplicate navigation.</p>
        </div>
      )}

      {!shouldBlockProjectView && !activeProjectsQuery.isLoading && !activeProjectsQuery.isError && projects.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-3">
          {projects.map((project) => (
            <article key={project.id} className="sbts-card p-5 transition hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(15,39,56,0.13)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-cyan-700">{project.id}</div>
                  <h3 className="mt-2 text-lg font-extrabold text-slate-950">{project.name}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${statusStyles[project.status as ProjectStatus] ?? statusStyles.Planning}`}>{project.status}</span>
              </div>
              <p className="min-h-[48px] text-sm font-medium leading-6 text-slate-600">{project.description ?? "Project scope linked to the selected operational area."}</p>
              <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <MapPin className="h-4 w-4" /> {project.areaCode} · {project.areaName} · {project.blindsCount} blinds
              </div>
              <div className="mb-3 mt-5 flex items-center justify-between text-sm"><span className="font-bold text-slate-600">Progress</span><span className="font-extrabold text-slate-950">{project.progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${project.progress}%` }} /></div>
              <Link href={isScopedToArea ? `/areas/${selectedAreaId}/projects/${project.id}` : `/projects/${project.id}`} className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-cyan-700 hover:text-cyan-900">
                Open project <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
