import { LockKeyhole } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

export default function PlaceholderPage({ moduleKey, title }) {
  const { activeBranch, activeBusiness, activeRoleName } = useWorkspace();

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-zera-mint text-zera-green">
          <LockKeyhole size={23} />
        </div>
        <h2 className="mt-5 text-2xl font-bold">{title}</h2>
        <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
          This module is part of the Zera platform direction, but Phase 1 only prepares the secure navigation and activation structure.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatusItem label="Business" value={activeBusiness?.name || "Not assigned"} />
          <StatusItem label="Branch" value={activeBranch?.name || "Not selected"} />
          <StatusItem label="Access" value={activeRoleName || "Not set"} />
        </div>
        {moduleKey ? <p className="mt-4 text-sm font-semibold text-zera-green">{moduleKey} access is enabled for this workspace.</p> : null}
      </section>
    </div>
  );
}

function StatusItem({ label, value }) {
  return (
    <div className="rounded-md bg-[#f7faf8] px-3 py-3">
      <p className="text-xs font-semibold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-zera-ink">{value}</p>
    </div>
  );
}
