/*
Design Philosophy: Industrial Command Center Minimalism.
Page headers communicate operational context first: title, owner, status, and a restrained action area that can grow without breaking page structure.
*/
import { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.26em] text-cyan-700">{eyebrow}</div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
