import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Search,
  X,
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getInventoryStock, receiveInventoryStock, transferInventoryStock, updateInventoryStock } from "../../services/inventoryService.js";

export default function InventoryPage() {
  const { activeBranch, activeBranchId, activeBusiness, activeBusinessId, activeRoleName, branches } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [stockItems, setStockItems] = useState([]);
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState("");
  const [stockActionModalOpen, setStockActionModalOpen] = useState(false);
  const [stockForm, setStockForm] = useState({ quantity: "0", reorderLevel: "0", note: "" });
  const [receiveForm, setReceiveForm] = useState({ quantity: "", note: "" });
  const [transferForm, setTransferForm] = useState({ toBranchId: "", quantity: "", note: "" });
  const [stockAction, setStockAction] = useState("RECEIVE");
  const [movementFilter, setMovementFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const guide = getInventoryGuide(activeBusiness, activeRoleName);

  useEffect(() => {
    if (!activeBusinessId || !activeBranchId) {
      setStockItems([]);
      setRecentAdjustments([]);
      return;
    }

    loadStock();
  }, [activeBusinessId, activeBranchId]);

  async function loadStock() {
    try {
      setLoading(true);
      setError("");
      const data = await getInventoryStock(activeBusinessId, activeBranchId);
      setStockItems(data.stockItems || []);
      setRecentAdjustments(data.recentAdjustments || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load inventory stock.");
    } finally {
      setLoading(false);
    }
  }

  function selectStock(stock, action = stockAction, openModal = true) {
    setSelectedStockId(stock.id);
    setStockAction(action);
    setStockForm({
      quantity: String(stock.quantity ?? 0),
      reorderLevel: String(stock.reorderLevel ?? 0),
      note: ""
    });
    setReceiveForm({ quantity: "", note: "" });
    setTransferForm((current) => ({ ...current, quantity: "", note: "" }));
    setError("");
    setMessage("");
    setStockActionModalOpen(openModal);
  }

  function selectLowStock(stock) {
    selectStock(stock, "RECEIVE", true);
    setTypeFilter("LOW");
  }

  async function handleReceiveSubmit(event) {
    event.preventDefault();

    const selectedStock = stockItems.find((stock) => stock.id === selectedStockId);

    if (!selectedStock || !activeBusinessId || !activeBranchId) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const updatedStock = await receiveInventoryStock(activeBusinessId, activeBranchId, selectedStock.productId, receiveForm);
      setStockItems((current) => current.map((stock) => (stock.id === updatedStock.id ? updatedStock : stock)));
      setSelectedStockId(updatedStock.id);
      setStockForm({
        quantity: String(updatedStock.quantity ?? 0),
        reorderLevel: String(updatedStock.reorderLevel ?? 0),
        note: ""
      });
      setReceiveForm({ quantity: "", note: "" });
      setMessage(`${receiveForm.quantity} ${updatedStock.product.name} added to ${activeBranch?.name || "this branch"}.`);
      setStockActionModalOpen(false);
      await loadStock();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to receive stock.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStockSubmit(event) {
    event.preventDefault();

    const selectedStock = stockItems.find((stock) => stock.id === selectedStockId);

    if (!selectedStock || !activeBusinessId || !activeBranchId) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const updatedStock = await updateInventoryStock(activeBusinessId, activeBranchId, selectedStock.productId, stockForm);
      setStockItems((current) => current.map((stock) => (stock.id === updatedStock.id ? updatedStock : stock)));
      setSelectedStockId(updatedStock.id);
      setStockForm({
        quantity: String(updatedStock.quantity ?? 0),
        reorderLevel: String(updatedStock.reorderLevel ?? 0),
        note: ""
      });
      setMessage(`${updatedStock.product.name} stock updated for ${activeBranch?.name || "this branch"}.`);
      setStockActionModalOpen(false);
      await loadStock();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update stock.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferSubmit(event) {
    event.preventDefault();

    const selectedStock = stockItems.find((stock) => stock.id === selectedStockId);

    if (!selectedStock || !activeBusinessId || !activeBranchId || !transferForm.toBranchId) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      const result = await transferInventoryStock(activeBusinessId, {
        fromBranchId: activeBranchId,
        productId: selectedStock.productId,
        quantity: transferForm.quantity,
        toBranchId: transferForm.toBranchId,
        note: transferForm.note
      });
      const updatedStock = result.sourceStock;
      setStockItems((current) => current.map((stock) => (stock.id === updatedStock.id ? updatedStock : stock)));
      setSelectedStockId(updatedStock.id);
      setStockForm({
        quantity: String(updatedStock.quantity ?? 0),
        reorderLevel: String(updatedStock.reorderLevel ?? 0),
        note: ""
      });
      const destinationName = branches.find((branch) => branch.id === transferForm.toBranchId)?.name || "another branch";
      setTransferForm((current) => ({ ...current, quantity: "", note: "" }));
      setMessage(`${transferForm.quantity} ${updatedStock.product.name} transferred to ${destinationName}.`);
      setStockActionModalOpen(false);
      await loadStock();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to transfer stock.");
    } finally {
      setSaving(false);
    }
  }

  const products = stockItems.map((stock) => stock.product);
  const physicalProducts = products.filter((product) => product.type === "PHYSICAL");
  const activePhysicalProducts = physicalProducts.filter((product) => product.status === "ACTIVE");
  const uncodedPhysicalProducts = physicalProducts.filter((product) => !product.sku && !product.barcode);
  const lowStockItems = stockItems.filter((stock) => stock.reorderLevel > 0 && stock.quantity <= stock.reorderLevel);
  const missingCodeStockItems = stockItems.filter((stock) => stock.product?.type === "PHYSICAL" && !stock.product?.sku && !stock.product?.barcode);
  const totalUnits = stockItems.reduce((total, stock) => total + Number(stock.quantity || 0), 0);
  const stockValue = stockItems.reduce((total, stock) => total + Number(stock.quantity || 0) * Number(stock.product?.price || 0), 0);
  const selectedStock = stockItems.find((stock) => stock.id === selectedStockId) || null;
  const categories = useMemo(
    () => [...new Set(physicalProducts.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [physicalProducts]
  );

  useEffect(() => {
    if (selectedStockId && stockItems.length > 0 && !selectedStock) {
      setSelectedStockId("");
      setStockActionModalOpen(false);
    }
  }, [selectedStock, selectedStockId, stockItems.length]);

  useEffect(() => {
    if (searchParams.get("view") === "low") {
      setTypeFilter("LOW");
      setStockAction("RECEIVE");
    }
  }, [searchParams]);

  const transferBranches = useMemo(
    () => branches.filter((branch) => branch.id !== activeBranchId && branch.status === "ACTIVE"),
    [activeBranchId, branches]
  );

  useEffect(() => {
    if (transferBranches.length === 0) {
      setTransferForm((current) => ({ ...current, toBranchId: "" }));
      return;
    }

    if (!transferBranches.some((branch) => branch.id === transferForm.toBranchId)) {
      setTransferForm((current) => ({ ...current, toBranchId: transferBranches[0].id }));
    }
  }, [transferBranches, transferForm.toBranchId]);

  const filteredStockItems = stockItems.filter((stock) => {
    const product = stock.product;
    const matchesType =
      typeFilter === "ALL" ||
      (typeFilter === "LOW" && stock.reorderLevel > 0 && stock.quantity <= stock.reorderLevel) ||
      (typeFilter === "NEEDS_CODE" && !product.sku && !product.barcode) ||
      (typeFilter === "PAUSED" && product.status === "INACTIVE");
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [product.name, product.sku, product.barcode, product.category, product.unit]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesType && matchesCategory && matchesSearch;
  });

  const readiness = [
    {
      label: "Physical catalog",
      value: activePhysicalProducts.length,
      helper: activePhysicalProducts.length ? "Items ready for stock tracking" : "Create active physical products first",
      ready: activePhysicalProducts.length > 0
    },
    {
      label: "Stock value",
      value: formatMoney(stockValue, activeBusiness?.currency),
      helper: `${totalUnits} unit${totalUnits === 1 ? "" : "s"} currently on hand`,
      ready: totalUnits > 0
    },
    {
      label: "Missing codes",
      value: uncodedPhysicalProducts.length,
      helper: uncodedPhysicalProducts.length ? "Need SKU or barcode" : "Products are easy to scan",
      ready: uncodedPhysicalProducts.length === 0 && physicalProducts.length > 0
    },
    {
      label: "Low stock",
      value: lowStockItems.length,
      helper: lowStockItems.length ? "Items need attention" : "No low-stock alerts",
      ready: lowStockItems.length === 0
    }
  ];

  if (!activeBusiness) {
    return (
      <div className="mx-auto max-w-5xl">
        <section className="rounded-md border border-zera-line bg-white p-5 shadow-xs">
          <h2 className="text-xl font-bold">Inventory</h2>
          <p className="mt-2 text-sm text-zera-muted">Select a business before managing inventory.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <section className="rounded-md border border-zera-line bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-zera-green">{guide.eyebrow}</p>
              <span className="h-1 w-1 rounded-full bg-zera-lineStrong" />
              <p className="truncate text-xs font-bold uppercase tracking-wide text-zera-muted">{activeBranch?.name || "Current branch"}</p>
            </div>
            <h2 className="mt-1 text-xl font-bold text-zera-ink">{guide.title}</h2>
          </div>

          <InventorySummaryStrip items={readiness} loading={loading} />

          <div className="flex shrink-0 items-center gap-2">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink shadow-xs transition hover:bg-zera-mintSoft disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={loadStock}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              to="/products"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zera-green px-3 text-sm font-semibold text-white shadow-xs transition hover:bg-zera-greenDark"
            >
              <Package size={16} />
              Products
            </Link>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mintSoft px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-zera-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <IconFrame icon={Boxes} />
              <div>
                <h3 className="text-base font-bold">Products in stock</h3>
                <p className="text-sm text-zera-muted">
                  {loading ? "Loading..." : `${filteredStockItems.length} of ${physicalProducts.length} physical item${physicalProducts.length === 1 ? "" : "s"}. Click any row to manage stock.`}
                </p>
              </div>
            </div>
            <div className="min-w-0 overflow-x-auto">
              <div className="flex min-w-max flex-nowrap items-center gap-2 lg:min-w-0">
                <label className="flex h-9 w-[280px] shrink-0 items-center gap-2 rounded-md border border-zera-line bg-white px-2.5 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
                  <Search size={16} className="shrink-0 text-zera-muted" />
                  <input
                    className="w-full border-0 bg-transparent text-sm outline-none"
                    placeholder="Search item, SKU, barcode"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <select
                  className="h-9 w-[150px] shrink-0 rounded-md border border-zera-line bg-white px-2.5 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border-b border-zera-line px-3 py-2">
            <div className="flex min-w-max flex-nowrap items-center gap-2">
              <InventoryFilterTabs
                activeValue={typeFilter}
                items={[
                  ["ALL", "All stock"],
                  ["LOW", "Low stock"],
                  ["NEEDS_CODE", "Missing code"],
                  ["PAUSED", "Paused"]
                ]}
                onChange={setTypeFilter}
              />
              <button
                className="h-9 w-[64px] shrink-0 rounded-md border border-zera-line bg-white px-2 text-sm font-bold text-zera-muted transition hover:bg-zera-surface hover:text-zera-ink"
                type="button"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("ALL");
                  setCategoryFilter("");
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="max-h-[calc(100vh-255px)] min-w-[980px] overflow-y-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
                  <tr>
                    <th className="w-[32%] px-3 py-2.5">Product</th>
                    <th className="w-[18%] px-3 py-2.5">Category</th>
                    <th className="w-[18%] px-3 py-2.5">Code</th>
                    <th className="w-[12%] px-3 py-2.5 text-right">On hand</th>
                    <th className="w-[11%] px-3 py-2.5 text-right">Alert</th>
                    <th className="w-[9%] px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zera-line">
                  {!loading && filteredStockItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-zera-muted" colSpan="6">
                        No stock items match this view.
                      </td>
                    </tr>
                  ) : null}
                  {filteredStockItems.map((stock) => (
                    <InventoryRow
                      key={stock.id}
                      active={stock.id === selectedStock?.id}
                      currency={activeBusiness.currency}
                      onSelect={() => selectStock(stock, "RECEIVE", true)}
                      stock={stock}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <aside className="space-y-4">
          <InventoryPriorityPanel
            currency={activeBusiness.currency}
            lowStockItems={lowStockItems}
            missingCodeItems={missingCodeStockItems}
            onSelectCode={(stock) => {
              selectStock(stock, "SET", true);
              setTypeFilter("NEEDS_CODE");
            }}
            onSelectLowStock={selectLowStock}
          />

          <MovementHistory adjustments={recentAdjustments} filter={movementFilter} onFilterChange={setMovementFilter} />
        </aside>
      </section>

      {stockActionModalOpen ? (
        <StockActionModal
          activeBranch={activeBranch}
          activeRoleName={activeRoleName}
          action={stockAction}
          branches={transferBranches}
          currency={activeBusiness.currency}
          form={stockForm}
          onActionChange={setStockAction}
          onChange={setStockForm}
          onClose={() => setStockActionModalOpen(false)}
          onReceiveChange={setReceiveForm}
          onReceiveSubmit={handleReceiveSubmit}
          onSubmit={handleStockSubmit}
          onTransferChange={setTransferForm}
          onTransferSubmit={handleTransferSubmit}
          receiveForm={receiveForm}
          saving={saving}
          stock={selectedStock}
          transferForm={transferForm}
        />
      ) : null}
    </div>
  );
}

function IconFrame({ icon: Icon }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
      <Icon size={22} />
    </div>
  );
}

function InventorySummaryStrip({ items, loading }) {
  return (
    <section className="grid min-w-0 grid-cols-2 overflow-hidden rounded-md border border-zera-line bg-white lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`min-w-[118px] border-zera-line px-3 py-2 text-sm odd:border-r lg:border-r lg:last:border-r-0 ${item.ready ? "text-zera-ink" : "text-amber-800"}`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {item.ready ? <CheckCircle2 className="shrink-0 text-zera-green" size={14} /> : <AlertTriangle className="shrink-0 text-amber-700" size={14} />}
              <p className="truncate text-[11px] font-bold uppercase tracking-wide text-zera-muted">{item.label}</p>
            </div>
            <p className="mt-1 truncate text-base font-bold text-zera-ink">{loading ? "..." : item.value}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function InventoryFilterTabs({ activeValue, items, onChange }) {
  return items.map(([value, label]) => (
    <button
      key={value}
      type="button"
      className={`h-9 min-w-[86px] shrink-0 whitespace-nowrap rounded-md border px-2 text-sm font-bold transition ${
        activeValue === value ? "border-zera-green bg-zera-mintSoft text-zera-green shadow-xs" : "border-zera-line bg-white text-zera-muted hover:bg-zera-mintSoft hover:text-zera-ink"
      }`}
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  ));
}

function InventoryPriorityPanel({ currency, lowStockItems, missingCodeItems, onSelectCode, onSelectLowStock }) {
  const visibleLowStock = lowStockItems.slice(0, 3);
  const visibleMissingCodes = missingCodeItems.slice(0, 3);
  const hasAttention = lowStockItems.length > 0 || missingCodeItems.length > 0;

  return (
    <article className="rounded-md border border-zera-line bg-white shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-zera-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold">Needs attention</h3>
          <p className="truncate text-sm text-zera-muted">{hasAttention ? "Open an item to fix it." : "No inventory issues now."}</p>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${hasAttention ? "bg-amber-50 text-amber-700" : "bg-zera-mint text-zera-green"}`}>
          {lowStockItems.length + missingCodeItems.length} item{lowStockItems.length + missingCodeItems.length === 1 ? "" : "s"}
        </span>
      </div>

      {!hasAttention ? (
        <div className="m-3 rounded-md border border-dashed border-zera-line bg-zera-surface px-3 py-4 text-sm text-zera-muted">
          No low-stock or missing-code items need attention.
        </div>
      ) : null}

      {visibleLowStock.length > 0 ? (
        <div className="p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Low stock</p>
          <div className="divide-y divide-zera-line overflow-hidden rounded-md border border-zera-line">
            {visibleLowStock.map((stock) => (
              <button
                key={stock.id}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 text-left transition hover:bg-zera-mintSoft"
                type="button"
                onClick={() => onSelectLowStock(stock)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-zera-ink">{stock.product?.name || "Product"}</span>
                  <span className="mt-0.5 block truncate text-xs text-zera-muted">
                    {stock.quantity} on hand, alert at {stock.reorderLevel}
                  </span>
                </span>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Receive</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {visibleMissingCodes.length > 0 ? (
        <div className={visibleLowStock.length > 0 ? "px-3 pb-3" : "p-3"}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zera-muted">Missing SKU or barcode</p>
          <div className="divide-y divide-zera-line overflow-hidden rounded-md border border-zera-line">
            {visibleMissingCodes.map((stock) => (
              <button
                key={stock.id}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 text-left transition hover:bg-zera-mintSoft"
                type="button"
                onClick={() => onSelectCode(stock)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-zera-ink">{stock.product?.name || "Product"}</span>
                  <span className="mt-0.5 block truncate text-xs text-zera-muted">
                    {stock.product?.category || "No category"} - {formatMoney(stock.product?.price || 0, currency)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                  <Barcode size={13} />
                  Code
                </span>
              </button>
            ))}
          </div>
          <Link
            className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-md border border-zera-line bg-white px-3 text-sm font-bold text-zera-green transition hover:bg-zera-mintSoft"
            to="/products"
          >
            Manage product codes
          </Link>
        </div>
      ) : null}
    </article>
  );
}

function StockActionModal({
  action,
  activeBranch,
  activeRoleName,
  branches,
  currency,
  form,
  onActionChange,
  onChange,
  onClose,
  onReceiveChange,
  onReceiveSubmit,
  onSubmit,
  onTransferChange,
  onTransferSubmit,
  receiveForm,
  saving,
  stock,
  transferForm
}) {
  const product = stock?.product;
  const status = stock ? getStockStatus(stock) : null;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 no-print" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-zera-line bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-zera-line bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Inventory action</p>
            <h3 className="mt-1 truncate text-xl font-bold text-zera-ink">{product?.name || "Product"}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-zera-muted">
              <span>{activeBranch?.name || "Current branch"}</span>
              {activeRoleName ? <span>{activeRoleName}</span> : null}
              {product?.category ? <span>{product.category}</span> : null}
              {product?.sku || product?.barcode ? <span>{product.sku || product.barcode}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {status ? <StockStatusBadge status={status} /> : null}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md border border-zera-line bg-white text-zera-muted transition hover:bg-zera-surface hover:text-zera-ink"
              type="button"
              onClick={onClose}
              aria-label="Close inventory action"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto p-5">
          <StockEditor
            activeBranch={activeBranch}
            action={action}
            branches={branches}
            currency={currency}
            form={form}
            onActionChange={onActionChange}
            onChange={onChange}
            onReceiveChange={onReceiveChange}
            onReceiveSubmit={onReceiveSubmit}
            onSubmit={onSubmit}
            onTransferChange={onTransferChange}
            onTransferSubmit={onTransferSubmit}
            receiveForm={receiveForm}
            saving={saving}
            stock={stock}
            transferForm={transferForm}
          />
        </div>
      </section>
    </div>
  );
}

function StockEditor({
  action,
  activeBranch,
  branches,
  currency,
  form,
  onActionChange,
  onChange,
  onReceiveChange,
  onReceiveSubmit,
  onSubmit,
  onTransferChange,
  onTransferSubmit,
  receiveForm,
  saving,
  stock,
  transferForm
}) {
  const product = stock?.product;
  const status = stock ? getStockStatus(stock) : null;
  const receivedQuantity = Number(receiveForm.quantity || 0);
  const projectedStock = stock ? stock.quantity + (Number.isFinite(receivedQuantity) ? receivedQuantity : 0) : 0;
  const transferQuantity = Number(transferForm.quantity || 0);
  const projectedSourceStock = stock ? stock.quantity - (Number.isFinite(transferQuantity) ? transferQuantity : 0) : 0;
  const destinationBranch = branches.find((branch) => branch.id === transferForm.toBranchId);
  const isReceiveMode = action === "RECEIVE";
  const isTransferMode = action === "TRANSFER";
  const countedQuantity = Number(form.quantity || 0);
  const reorderLevel = Number(form.reorderLevel || 0);
  const receiveDisabled = !receivedQuantity || receivedQuantity <= 0;
  const transferDisabled = branches.length === 0 || !transferQuantity || transferQuantity <= 0 || projectedSourceStock < 0;
  const countDisabled = !Number.isFinite(countedQuantity) || countedQuantity < 0 || !Number.isFinite(reorderLevel) || reorderLevel < 0;
  const submitDisabled = saving || (isReceiveMode ? receiveDisabled : isTransferMode ? transferDisabled : countDisabled);

  return (
    <form onSubmit={isReceiveMode ? onReceiveSubmit : isTransferMode ? onTransferSubmit : onSubmit}>
      {!stock ? (
        <div className="rounded-md border border-dashed border-zera-line p-4 text-sm text-zera-muted">
          Create physical products first, then stock counts can be managed here.
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <StockFact label="On hand" value={stock.quantity} />
            <StockFact label="Low stock alert" value={stock.reorderLevel || "Off"} />
            <StockFact label="Unit price" value={formatMoney(product.price, currency)} />
            <StockFact label="Unit" value={product.unit || "Item"} />
          </div>

          {!product.sku && !product.barcode ? (
            <div className="mb-4 flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold">SKU or barcode is missing.</span>
              <Link className="font-bold text-amber-900 underline-offset-4 hover:underline" to="/products">
                Edit product
              </Link>
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-3 gap-1 rounded-md border border-zera-line bg-zera-surface p-1">
            {[
              ["RECEIVE", "Receive stock"],
              ["SET", "Set count"],
              ["TRANSFER", "Transfer"]
            ].map(([value, label]) => (
              <button
                key={value}
                className={`min-h-10 rounded-md text-sm font-bold transition ${
                  action === value ? "bg-white text-zera-green shadow-sm" : "text-zera-muted hover:text-zera-ink"
                }`}
                type="button"
                onClick={() => onActionChange(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {isReceiveMode ? (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Quantity received</span>
                <input
                  className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  min="1"
                  placeholder="Quantity"
                  required
                  type="number"
                  value={receiveForm.quantity}
                  onChange={(event) => onReceiveChange({ ...receiveForm, quantity: event.target.value })}
                />
              </label>

              <div className="mt-3 rounded-md border border-zera-line bg-zera-mintSoft p-3 text-sm text-zera-green">
                Current stock {stock.quantity} + received {receivedQuantity || 0} ={" "}
                <span className="font-bold">{projectedStock}</span>
              </div>

              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Delivery note</span>
                <input
                  className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  placeholder="Delivery note"
                  value={receiveForm.note}
                  onChange={(event) => onReceiveChange({ ...receiveForm, note: event.target.value })}
                />
              </label>
            </>
          ) : isTransferMode ? (
            <>
              {branches.length === 0 ? (
                <div className="rounded-md border border-dashed border-zera-line bg-zera-surface p-4 text-sm text-zera-muted">
                  Add another active branch before transferring stock.
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zera-ink">Receiving branch</span>
                    <select
                      className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                      value={transferForm.toBranchId}
                      onChange={(event) => onTransferChange({ ...transferForm, toBranchId: event.target.value })}
                    >
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-3 block">
                    <span className="mb-2 block text-sm font-medium text-zera-ink">Quantity to transfer</span>
                    <input
                      className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                      min="1"
                      max={stock.quantity}
                      placeholder="Quantity"
                      required
                      type="number"
                      value={transferForm.quantity}
                      onChange={(event) => onTransferChange({ ...transferForm, quantity: event.target.value })}
                    />
                  </label>

                  <div
                    className={`mt-3 rounded-md p-3 text-sm ${
                      projectedSourceStock < 0 ? "bg-red-50 text-red-700" : "bg-zera-mintSoft text-zera-green"
                    }`}
                  >
                    {activeBranch?.name || "Current branch"} stock after transfer:{" "}
                    <span className="font-bold">{Number.isFinite(projectedSourceStock) ? projectedSourceStock : stock.quantity}</span>
                    {destinationBranch ? <span> to {destinationBranch.name}</span> : null}
                  </div>

                  <label className="mt-3 block">
                    <span className="mb-2 block text-sm font-medium text-zera-ink">Transfer note</span>
                    <input
                      className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                      placeholder="Transfer note"
                      value={transferForm.note}
                      onChange={(event) => onTransferChange({ ...transferForm, note: event.target.value })}
                    />
                  </label>
                </>
              )}
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zera-ink">Actual counted stock</span>
                  <input
                    className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                    min="0"
                    type="number"
                    value={form.quantity}
                    onChange={(event) => onChange({ ...form, quantity: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zera-ink">Alert when stock reaches</span>
                  <input
                    className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                    min="0"
                    type="number"
                    value={form.reorderLevel}
                    onChange={(event) => onChange({ ...form, reorderLevel: event.target.value })}
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Correction note</span>
                <input
                  className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  placeholder="Correction note"
                  value={form.note}
                  onChange={(event) => onChange({ ...form, note: event.target.value })}
                />
              </label>
            </>
          )}

          <button
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-zera-green px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-zera-greenDark disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitDisabled}
            type="submit"
          >
            {saving ? "Saving stock..." : isReceiveMode ? "Add to current stock" : isTransferMode ? "Transfer stock" : "Save counted stock"}
          </button>
        </>
      )}
    </form>
  );
}

function StockFact({ label, value }) {
  return (
    <div className="min-w-0 rounded-md border border-zera-line bg-white px-3 py-2.5">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-zera-ink">{value}</p>
    </div>
  );
}

function MovementHistory({ adjustments, filter, onFilterChange }) {
  const movements = adjustments.map((adjustment) => ({
    ...adjustment,
    movement: getMovementLabel(adjustment)
  }));
  const filteredMovements = movements.filter((adjustment) => filter === "ALL" || adjustment.movement.key === filter);

  return (
    <article className="rounded-md border border-zera-line bg-white shadow-xs">
      <div className="border-b border-zera-line px-4 py-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold">Stock movements</h3>
            <p className="truncate text-sm text-zera-muted">{filteredMovements.length} movement{filteredMovements.length === 1 ? "" : "s"} in this view</p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
            <ClipboardCheck size={17} />
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {[
            ["ALL", "All"],
            ["RECEIVED", "Received"],
            ["TRANSFER", "Transfers"],
            ["SALE", "Sales"],
            ["COUNT", "Counts"],
            ["VOID", "Voids"]
          ].map(([value, label]) => (
            <button
              key={value}
              className={`min-h-8 whitespace-nowrap rounded-md border px-2.5 text-xs font-bold transition ${
                filter === value ? "border-zera-green bg-zera-mintSoft text-zera-green shadow-xs" : "border-zera-line bg-white text-zera-muted hover:bg-zera-mintSoft hover:text-zera-ink"
              }`}
              type="button"
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[330px] overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
            <tr>
              <th className="px-3 py-2.5">Item</th>
              <th className="px-3 py-2.5">Movement</th>
              <th className="px-3 py-2.5 text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {filteredMovements.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-zera-muted" colSpan="3">
                  No stock movements in this view.
                </td>
              </tr>
            ) : null}
            {filteredMovements.slice(0, 12).map((adjustment) => (
              <tr key={adjustment.id} className="hover:bg-zera-mintSoft">
                <td className="px-3 py-2.5">
                  <p className="max-w-[170px] truncate font-bold text-zera-ink">{adjustment.product?.name || "Product"}</p>
                  <p className="mt-1 text-xs text-zera-muted">{formatMovementTime(adjustment.createdAt)}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${adjustment.movement.className}`}>{adjustment.movement.label}</span>
                  {adjustment.note ? <p className="mt-2 max-w-44 truncate text-xs text-zera-muted">{adjustment.note}</p> : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${adjustment.quantityChange < 0 ? "bg-red-50 text-red-700" : "bg-zera-mint text-zera-green"}`}>
                    {adjustment.quantityChange > 0 ? "+" : ""}
                    {adjustment.quantityChange}
                  </span>
                  <p className="mt-2 text-xs text-zera-muted">
                    {adjustment.quantityBefore} to <span className="font-bold text-zera-ink">{adjustment.quantityAfter}</span>
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function InventoryRow({ active, currency, onSelect, stock }) {
  const product = stock.product;
  const missingCode = !product.sku && !product.barcode;
  const status = getStockStatus(stock);

  return (
    <tr
      className={`cursor-pointer transition ${active ? "bg-zera-mintSoft" : "hover:bg-zera-mintSoft"}`}
      onClick={onSelect}
    >
      <td className="px-3 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{product.name}</p>
          <p className="mt-1 text-xs text-zera-muted">
            {formatMoney(product.price, currency)}
            {product.unit ? ` / ${product.unit}` : ""}
          </p>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="block max-w-[180px] truncate font-semibold text-zera-muted">{product.category || "Uncategorized"}</span>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
            missingCode ? "bg-amber-50 text-amber-700" : "bg-white text-zera-muted"
          }`}
        >
          <Barcode size={13} />
          <span className="truncate">{product.sku || product.barcode || "Needs code"}</span>
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right">
        <span className={`text-base font-bold ${status.tone === "warning" ? "text-amber-700" : "text-zera-ink"}`}>{stock.quantity}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-zera-muted">{stock.reorderLevel}</td>
      <td className="px-3 py-3">
        <StockStatusBadge status={status} />
      </td>
    </tr>
  );
}

function StockStatusBadge({ status }) {
  const toneClass =
    status?.tone === "danger"
      ? "bg-red-50 text-red-700"
      : status?.tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-zera-mint text-zera-green";

  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${toneClass}`}>{status?.label || "Ready"}</span>;
}

function getStockStatus(stock) {
  if (stock.product?.status !== "ACTIVE") {
    return { label: "Paused", tone: "danger" };
  }

  if (stock.reorderLevel > 0 && stock.quantity <= stock.reorderLevel) {
    return { label: "Low stock", tone: "warning" };
  }

  return { label: "Ready", tone: "success" };
}

function getMovementLabel(adjustment) {
  const note = (adjustment.note || "").toLowerCase();

  if (note.startsWith("transfer")) {
    return { key: "TRANSFER", label: "Transfer", className: "bg-blue-50 text-blue-700" };
  }

  if (note.startsWith("voided")) {
    return { key: "VOID", label: "Void restored", className: "bg-blue-50 text-blue-700" };
  }

  if (adjustment.type === "DECREASE" || note.startsWith("sale")) {
    return { key: "SALE", label: "Sale deducted", className: "bg-red-50 text-red-700" };
  }

  if (adjustment.type === "SET") {
    return { key: "COUNT", label: "Count set", className: "bg-slate-100 text-slate-700" };
  }

  return { key: "RECEIVED", label: "Received", className: "bg-zera-mint text-zera-green" };
}

function formatMovementTime(value) {
  if (!value) {
    return "Recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getInventoryGuide(business, roleName) {
  const type = (business?.type || "").toLowerCase();

  if (roleName === "Pharmacist" || type.includes("pharmacy")) {
    return {
      eyebrow: "Pharmacy inventory",
      title: "Medicine catalog readiness",
      description: "",
      checklistTitle: "Pharmacist daily focus",
      checklistHelper: "Keep medicine records clear for counter work.",
      tasks: [
        { title: "Confirm medicine names", helper: "Use clear names with strength where possible, such as Paracetamol 500mg." },
        { title: "Keep codes clean", helper: "Add SKU or barcode to physical medicine products for faster counter search." },
        { title: "Separate services", helper: "Use service items for consultation or clinical services that do not move stock." }
      ]
    };
  }

  if (type.includes("supermarket")) {
    return {
      eyebrow: "Supermarket inventory",
      title: "Fast-moving stock control",
      description: "",
      checklistTitle: "Store keeper daily focus",
      checklistHelper: "Make checkout products easy to scan and group.",
      tasks: [
        { title: "Review product codes", helper: "Physical supermarket items should have SKU or barcode before stock tracking." },
        { title: "Group by aisle or category", helper: "Use categories such as Drinks, Bakery, Groceries, and Household." },
        { title: "Pause unavailable items", helper: "Inactive products stay out of daily selling flows." }
      ]
    };
  }

  if (type.includes("electronic")) {
    return {
      eyebrow: "Electronics inventory",
      title: "Device and accessory stock",
      description: "",
      checklistTitle: "Electronics shop daily focus",
      checklistHelper: "Keep stock and product records ready for sales.",
      tasks: [
        { title: "Code devices and accessories", helper: "Use SKU or barcode so phones, chargers, cables, and accessories are quick to find." },
        { title: "Set low-stock alerts", helper: "Use alerts for fast-moving accessories and high-value devices that must not run out." },
        { title: "Separate repair services", helper: "Use service items for screen replacement, diagnosis, or repair labor that does not move stock." }
      ]
    };
  }

  if (type.includes("bar") || type.includes("restaurant")) {
    return {
      eyebrow: "Restaurant stock",
      title: "Menu items ready for stock",
      description: "",
      checklistTitle: "Service inventory focus",
      checklistHelper: "Prepare menu items for table-service POS.",
      tasks: [
        { title: "Separate food and drinks", helper: "Categories help waiters find menu items quickly during service." },
        { title: "Use fees for charges", helper: "Delivery, takeaway, or service charge should not be physical stock." },
        { title: "Keep active menu tight", helper: "Pause unavailable items so waiters do not sell what the kitchen cannot serve." }
      ]
    };
  }

  if (type.includes("hotel")) {
    return {
      eyebrow: "Hotel inventory",
      title: "Guest service catalog",
      description: "",
      checklistTitle: "Front desk stock focus",
      checklistHelper: "Keep guest-billable items simple and searchable.",
      tasks: [
        { title: "Mark services correctly", helper: "Laundry, pickup, and room services should be service items." },
        { title: "Code physical items", helper: "Minibar and shop products should have SKU or barcode." },
        { title: "Separate fees", helper: "Use fee items for service charges or penalties." }
      ]
    };
  }

  return {
    eyebrow: "Inventory workspace",
    title: "Retail stock readiness",
    description: "",
    checklistTitle: "Store keeper daily focus",
    checklistHelper: "Keep the catalog ready for selling and stock control.",
    tasks: [
      { title: "Check active stock items", helper: "Make sure daily products are active and easy for cashiers to find." },
      { title: "Add SKU or barcode", helper: "Physical products need identifiers before proper stock movement is reliable." },
      { title: "Group products", helper: "Categories keep POS, reports, and stock counts organized." }
    ]
  };
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}
