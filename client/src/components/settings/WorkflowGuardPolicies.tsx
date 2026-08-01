import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Layers3,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export type WorkflowGuardPolicyItem<Key extends string> = {
  key: Key;
  label: string;
  description: string;
  critical?: boolean;
};

export type WorkflowGuardPolicySection<Key extends string> = {
  id: string;
  title: string;
  description: string;
  items: WorkflowGuardPolicyItem<Key>[];
};

type WorkflowGuardPoliciesProps<Key extends string> = {
  sections: WorkflowGuardPolicySection<Key>[];
  values: Record<Key, boolean>;
  onToggle: (key: Key, value: boolean) => void;
};

export function WorkflowGuardPolicies<Key extends string>({
  sections,
  values,
  onToggle,
}: WorkflowGuardPoliciesProps<Key>) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(sections.map(section => section.id))
  );

  const summary = useMemo(() => {
    const items = sections.flatMap(section => section.items);
    const criticalItems = items.filter(item => item.critical);
    return {
      total: items.length,
      enabled: items.filter(item => values[item.key]).length,
      criticalTotal: criticalItems.length,
      criticalEnabled: criticalItems.filter(item => values[item.key]).length,
    };
  }, [sections, values]);

  const allOpen = openSections.size === sections.length;

  const toggleSection = (id: string) => {
    setOpenSections(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section
      className="space-y-4"
      aria-labelledby="workflow-guard-title"
      dir="ltr"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-5 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
                <ShieldAlert className="h-4 w-4" /> Plant control matrix
              </div>
              <h3 id="workflow-guard-title" className="mt-2 text-xl font-black">
                Workflow Guard Policies
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Nine operational domains keep runtime gates, safety controls,
                closeout rules, and field behavior understandable without
                changing their stored database keys.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setOpenSections(
                  allOpen
                    ? new Set()
                    : new Set(sections.map(section => section.id))
                )
              }
              className="w-fit border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          </div>
        </div>

        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          <div className="bg-white p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Policy domains
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-black text-slate-950">
                {sections.length}
              </span>
              <span className="pb-1 text-xs text-slate-500">
                organized sections
              </span>
            </div>
          </div>
          <div className="bg-white p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Controls enabled
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-black text-slate-950">
                {summary.enabled}/{summary.total}
              </span>
              <span className="pb-1 text-xs text-slate-500">
                current selection
              </span>
            </div>
          </div>
          <div className="bg-white p-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Safety-critical enabled
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-black text-red-700">
                {summary.criticalEnabled}/{summary.criticalTotal}
              </span>
              <span className="pb-1 text-xs text-slate-500">
                review before save
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section, index) => {
          const enabled = section.items.filter(item => values[item.key]).length;
          const criticalItems = section.items.filter(item => item.critical);
          const criticalEnabled = criticalItems.filter(
            item => values[item.key]
          ).length;
          const isOpen = openSections.has(section.id);
          const progress = section.items.length
            ? Math.round((enabled / section.items.length) * 100)
            : 0;

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                aria-expanded={isOpen}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-black text-slate-950">
                      {section.title}
                    </h4>
                    {criticalItems.length > 0 && (
                      <Badge
                        variant="outline"
                        className="border-red-200 bg-red-50 text-[10px] font-extrabold uppercase tracking-wide text-red-700"
                      >
                        Safety critical
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {section.description}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 min-w-24 max-w-56 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-cyan-600 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600">
                      {enabled}/{section.items.length} enabled
                    </span>
                    {criticalItems.length > 0 && (
                      <span className="hidden text-[11px] font-bold text-red-700 sm:inline">
                        {criticalEnabled}/{criticalItems.length} critical
                      </span>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-slate-400" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    {section.items.map(item => (
                      <div
                        key={item.key}
                        className={`flex min-h-24 items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3 ${
                          item.critical ? "border-red-100" : "border-slate-200"
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                            {item.label}
                            {item.critical && (
                              <ShieldCheck className="h-3.5 w-3.5 text-red-600" />
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(values[item.key])}
                          onCheckedChange={value => onToggle(item.key, value)}
                          aria-label={item.label}
                        />
                      </div>
                    ))}
                  </div>
                  {section.items.length === 0 && (
                    <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500">
                      <Layers3 className="h-4 w-4" /> No configurable controls
                      in this domain.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
