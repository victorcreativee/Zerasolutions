import { Building2, ChevronDown, MapPin } from "lucide-react";

export default function WorkspaceSwitcher({
  activeBranchId,
  activeBusinessId,
  branches,
  businesses,
  loading,
  onBranchChange,
  onBusinessChange,
  roleName
}) {
  if (loading && !businesses.length) {
    return <div className="h-11 w-full animate-pulse rounded-md bg-zera-surface sm:w-80" />;
  }

  if (!businesses.length) {
    return null;
  }

  return (
    <div className="flex min-h-11 min-w-0 items-center rounded-md border border-zera-line bg-white shadow-xs">
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center text-zera-green sm:flex">
        <Building2 size={18} />
      </div>

      <label className="relative min-w-0 flex-1 border-r border-zera-line">
        <span className="sr-only">Active business</span>
        <select
          className="h-10 w-full appearance-none bg-transparent py-1 pl-3 pr-8 text-sm font-semibold text-zera-ink outline-none sm:min-w-44 sm:pl-0"
          value={activeBusinessId}
          onChange={(event) => onBusinessChange(event.target.value)}
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zera-muted" size={15} />
      </label>

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Active branch</span>
        <MapPin className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 text-zera-muted md:block" size={15} />
        <select
          className="h-10 w-full appearance-none bg-transparent py-1 pl-3 pr-8 text-sm font-medium text-zera-ink outline-none md:min-w-40 md:pl-9"
          value={activeBranchId}
          onChange={(event) => onBranchChange(event.target.value)}
          disabled={!branches.length}
        >
          {branches.length ? (
            branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))
          ) : (
            <option value="">No branch</option>
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zera-muted" size={15} />
      </label>

      {roleName ? (
        <div className="hidden border-l border-zera-line px-3 text-xs font-bold text-zera-green xl:block">{roleName}</div>
      ) : null}
    </div>
  );
}
