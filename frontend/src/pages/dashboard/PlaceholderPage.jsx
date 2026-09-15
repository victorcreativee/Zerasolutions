import { LockKeyhole } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";

export default function PlaceholderPage({ moduleKey, title }) {
  const { activeBranch, activeBusiness, activeRoleName } = useWorkspace();

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-zera-line pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Module</p>
          <h2 className="mt-1 text-2xl font-bold">{title}</h2>
        </div>
      </header>

      <section className="rounded-md border border-zera-line bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
            <LockKeyhole size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold">Module unavailable</h3>
            <p className="mt-1 text-sm leading-6 text-zera-muted">This workspace does not have access to this module.</p>
          </div>
          {moduleKey ? <span className="rounded-md bg-zera-mint px-2 py-1 text-xs font-bold text-zera-green">{moduleKey}</span> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatusItem label="Business" value={activeBusiness?.name || "Not assigned"} />
          <StatusItem label="Branch" value={activeBranch?.name || "Not selected"} />
          <StatusItem label="Access" value={activeRoleName || "Not set"} />
        </div>
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
