import { ChevronDown, Hotel, MapPin, Pill, ShoppingBasket, Store, Table2 } from "lucide-react";

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

  const activeBusiness = businesses.find((business) => business.id === activeBusinessId) || businesses[0];
  const mode = getPOSModeInfo(activeBusiness);
  const ModeIcon = mode.icon;

  return (
    <div className="flex min-h-12 min-w-0 items-center rounded-md border border-zera-line bg-white shadow-xs">
      <div className="hidden h-11 w-11 shrink-0 items-center justify-center border-r border-zera-line text-zera-green sm:flex">
        <ModeIcon size={18} />
      </div>

      <label className="relative min-w-0 flex-1 border-r border-zera-line">
        <span className="sr-only">Active business</span>
        <select
          className="h-11 w-full appearance-none bg-transparent pb-1 pl-3 pr-8 pt-4 text-sm font-semibold text-zera-ink outline-none sm:min-w-52"
          value={activeBusinessId}
          onChange={(event) => onBusinessChange(event.target.value)}
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute left-3 top-1.5 text-[10px] font-bold uppercase text-zera-muted">
          {mode.label}
        </span>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zera-muted" size={15} />
      </label>

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Active branch</span>
        <MapPin className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 text-zera-muted md:block" size={15} />
        <select
          className="h-11 w-full appearance-none bg-transparent py-1 pl-3 pr-8 text-sm font-medium text-zera-ink outline-none md:min-w-40 md:pl-9"
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
        <div className="hidden border-l border-zera-line px-3 xl:block">
          <p className="text-[10px] font-bold uppercase text-zera-muted">Access</p>
          <p className="text-xs font-bold text-zera-green">{roleName}</p>
        </div>
      ) : null}
    </div>
  );
}

function getPOSModeInfo(business) {
  const type = business?.type?.toLowerCase() || "";

  if (business?.posMode === "TABLE_SERVICE") {
    return {
      icon: Table2,
      label: "Table-service"
    };
  }

  if (type.includes("pharmacy")) {
    return {
      icon: Pill,
      label: "Pharmacy counter"
    };
  }

  if (type.includes("hotel")) {
    return {
      icon: Hotel,
      label: "Front desk"
    };
  }

  if (type.includes("supermarket")) {
    return {
      icon: ShoppingBasket,
      label: "Supermarket checkout"
    };
  }

  if (type.includes("retail")) {
    return {
      icon: Store,
      label: "Retail checkout"
    };
  }

  return {
    icon: Store,
    label: "Checkout"
  };
}
