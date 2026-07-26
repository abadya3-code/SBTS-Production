/*
Design Philosophy: Industrial Command Center Minimalism.
The fallback page preserves the operational shell and provides a clear route back to the command center.
*/
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="sbts-card mx-auto max-w-2xl p-8 text-center">
      <div className="text-xs font-extrabold uppercase tracking-[0.26em] text-cyan-700">Route not found</div>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">This operations panel does not exist yet.</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">Return to the command dashboard and continue reviewing the new SBTS frontend structure.</p>
      <Link href="/dashboard" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800">Back to Dashboard</Link>
    </div>
  );
}
