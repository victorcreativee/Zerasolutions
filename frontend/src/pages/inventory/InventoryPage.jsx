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
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getInventoryStock, receiveInventoryStock, updateInventoryStock } from "../../services/inventoryService.js";

export default function InventoryPage() {
  const { activeBranch, activeBranchId, activeBusiness, activeBusinessId, activeRoleName } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [stockItems, setStockItems] = useState([]);
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState("");
  const [stockForm, setStockForm] = useState({ quantity: "0", reorderLevel: "0", note: "" });
  const [receiveForm, setReceiveForm] = useState({ quantity: "", note: "" });
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

  function selectStock(stock) {
    setSelectedStockId(stock.id);
    setStockForm({
      quantity: String(stock.quantity ?? 0),
      reorderLevel: String(stock.reorderLevel ?? 0),
      note: ""
    });
    setReceiveForm({ quantity: "", note: "" });
    setError("");
    setMessage("");
  }

  function selectLowStock(stock) {
    selectStock(stock);
    setStockAction("RECEIVE");
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
      await loadStock();
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update stock.");
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
  const selectedStock = stockItems.find((stock) => stock.id === selectedStockId) || stockItems[0] || null;
  const categories = useMemo(
    () => [...new Set(physicalProducts.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [physicalProducts]
  );

  useEffect(() => {
    if (!selectedStockId && selectedStock) {
      selectStock(selectedStock);
    }
  }, [selectedStock?.id, selectedStockId]);

  useEffect(() => {
    if (searchParams.get("view") === "low") {
      setTypeFilter("LOW");
      setStockAction("RECEIVE");
    }
  }, [searchParams]);

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
    <div className="mx-auto max-w-[1500px] space-y-4">
      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="grid gap-4 border-b border-zera-line px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">{guide.eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold text-zera-ink">{guide.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">{guide.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink shadow-xs transition hover:bg-zera-mintSoft disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={loadStock}
            >
              {loading ? "Refreshing..." : "Refresh stock"}
            </button>
            <Link
              to="/products"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zera-green px-3 text-sm font-semibold text-white shadow-xs transition hover:bg-zera-greenDark"
            >
              <Package size={17} />
              Products
            </Link>
          </div>
        </div>

        <InventoryCounts items={readiness} loading={loading} />
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mintSoft px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <article className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-zera-line px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <IconFrame icon={Boxes} />
              <div>
                <h3 className="text-base font-bold">Stock list</h3>
                <p className="text-sm text-zera-muted">
                  {loading ? "Loading..." : `${filteredStockItems.length} shown from ${physicalProducts.length} physical item${physicalProducts.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-w-max flex-nowrap items-center gap-2">
                <label className="flex h-9 w-[300px] shrink-0 items-center gap-2 rounded-md border border-zera-line bg-white px-2.5 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
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
            <div className="max-h-[calc(100vh-330px)] min-w-[900px] overflow-y-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
                  <tr>
                    <th className="w-[36%] px-3 py-2.5">Item</th>
                    <th className="w-[22%] px-3 py-2.5">Code</th>
                    <th className="w-[14%] px-3 py-2.5 text-right">Current stock</th>
                    <th className="w-[14%] px-3 py-2.5 text-right">Low stock alert</th>
                    <th className="w-[14%] px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zera-line">
                  {!loading && filteredStockItems.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-zera-muted" colSpan="5">
                        No stock items match this view.
                      </td>
                    </tr>
                  ) : null}
                  {filteredStockItems.map((stock) => (
                    <InventoryRow
                      key={stock.id}
                      active={stock.id === selectedStock?.id}
                      currency={activeBusiness.currency}
                      onSelect={() => selectStock(stock)}
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
              selectStock(stock);
              setTypeFilter("NEEDS_CODE");
            }}
            onSelectLowStock={selectLowStock}
          />

          <article className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <IconFrame icon={ShieldCheck} />
                <div>
                  <h3 className="text-base font-bold">Stock action</h3>
                  <p className="text-sm text-zera-muted">{selectedStock?.product?.name || "Select an item"}</p>
                </div>
              </div>
              <span className="rounded-md bg-zera-mintSoft px-3 py-2 text-xs font-bold uppercase text-zera-muted">
                {activeRoleName || "Staff"}
              </span>
            </div>

            <StockEditor
              activeBranch={activeBranch}
              action={stockAction}
              currency={activeBusiness.currency}
              onActionChange={setStockAction}
              form={stockForm}
              receiveForm={receiveForm}
              onChange={setStockForm}
              onReceiveChange={setReceiveForm}
              onReceiveSubmit={handleReceiveSubmit}
              onSubmit={handleStockSubmit}
              saving={saving}
              stock={selectedStock}
            />
          </article>

          <MovementHistory adjustments={recentAdjustments} filter={movementFilter} onFilterChange={setMovementFilter} />
        </aside>
      </section>
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

function InventoryCounts({ items, loading }) {
  return (
    <section className="grid divide-y divide-zera-line md:grid-cols-4 md:divide-x md:divide-y-0">
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex items-center gap-3 bg-white p-4 text-sm ${item.ready ? "text-zera-ink" : "text-amber-800"}`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${item.ready ? "bg-zera-mintSoft text-zera-green" : "bg-amber-50 text-amber-800"}`}>
            {item.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-zera-muted">{item.label}</p>
            <p className="mt-1 truncate text-lg font-bold text-zera-ink">{loading ? "..." : item.value}</p>
            <p className="mt-0.5 truncate text-xs text-zera-muted">{item.helper}</p>
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
  const visibleLowStock = lowStockItems.slice(0, 4);
  const visibleMissingCodes = missingCodeItems.slice(0, 4);
  const hasAttention = lowStockItems.length > 0 || missingCodeItems.length > 0;

  return (
    <article className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconFrame icon={AlertTriangle} />
          <div>
            <h3 className="text-base font-bold">Inventory attention</h3>
            <p className="text-sm text-zera-muted">
              {hasAttention ? "Fix what can slow down selling." : "Stock setup is calm right now."}
            </p>
          </div>
        </div>
        <span className="rounded-md bg-zera-mintSoft px-2.5 py-1 text-xs font-bold text-zera-green">
          {lowStockItems.length + missingCodeItems.length} item{lowStockItems.length + missingCodeItems.length === 1 ? "" : "s"}
        </span>
      </div>

      {!hasAttention ? (
        <div className="rounded-md border border-dashed border-zera-line bg-zera-surface px-3 py-4 text-sm text-zera-muted">
          No low-stock or missing-code items need attention.
        </div>
      ) : null}

      {visibleLowStock.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Low stock</p>
          <div className="divide-y divide-zera-line rounded-md border border-zera-line">
            {visibleLowStock.map((stock) => (
              <button
                key={stock.id}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-zera-mintSoft"
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
        <div className={visibleLowStock.length > 0 ? "mt-4" : ""}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zera-muted">Missing SKU or barcode</p>
          <div className="divide-y divide-zera-line rounded-md border border-zera-line">
            {visibleMissingCodes.map((stock) => (
              <button
                key={stock.id}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 text-left transition hover:bg-zera-mintSoft"
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

function StockEditor({
  action,
  activeBranch,
  currency,
  form,
  onActionChange,
  onChange,
  onReceiveChange,
  onReceiveSubmit,
  onSubmit,
  receiveForm,
  saving,
  stock
}) {
  const product = stock?.product;
  const status = stock ? getStockStatus(stock) : null;
  const receivedQuantity = Number(receiveForm.quantity || 0);
  const projectedStock = stock ? stock.quantity + (Number.isFinite(receivedQuantity) ? receivedQuantity : 0) : 0;
  const isReceiveMode = action === "RECEIVE";

  return (
    <form onSubmit={isReceiveMode ? onReceiveSubmit : onSubmit}>
      {!stock ? (
        <div className="rounded-md border border-dashed border-zera-line p-4 text-sm text-zera-muted">
          Create physical products first, then stock counts can be managed here.
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-md bg-zera-mintSoft p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{product.name}</p>
                <p className="mt-1 text-sm text-zera-muted">
                  {formatMoney(product.price, currency)}
                  {product.unit ? ` / ${product.unit}` : ""}
                </p>
              </div>
              <StockStatusBadge status={status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-zera-muted">Current stock</p>
                <p className="mt-1 text-xl font-bold">{stock.quantity}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-zera-muted">Low stock alert</p>
                <p className="mt-1 text-xl font-bold">{stock.reorderLevel || "Off"}</p>
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-zera-mintSoft p-1">
            {[
              ["RECEIVE", "Receive stock"],
              ["SET", "Set count"]
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
                  placeholder="e.g. 12"
                  type="number"
                  value={receiveForm.quantity}
                  onChange={(event) => onReceiveChange({ ...receiveForm, quantity: event.target.value })}
                />
              </label>

              <div className="mt-3 rounded-md bg-zera-mintSoft p-3 text-sm text-zera-green">
                Current stock {stock.quantity} + received {receivedQuantity || 0} ={" "}
                <span className="font-bold">{projectedStock}</span>
              </div>

              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Delivery note</span>
                <input
                  className="min-h-10 w-full rounded-md border border-zera-line px-3 text-sm outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  placeholder="e.g. Supplier delivery, purchase received"
                  value={receiveForm.note}
                  onChange={(event) => onReceiveChange({ ...receiveForm, note: event.target.value })}
                />
              </label>
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
                  placeholder="e.g. Stock count, breakage correction"
                  value={form.note}
                  onChange={(event) => onChange({ ...form, note: event.target.value })}
                />
              </label>
            </>
          )}

          <button
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-zera-green px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-zera-greenDark disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving stock..." : isReceiveMode ? "Add to current stock" : "Save counted stock"}
          </button>
        </>
      )}
    </form>
  );
}

function MovementHistory({ adjustments, filter, onFilterChange }) {
  const movements = adjustments.map((adjustment) => ({
    ...adjustment,
    movement: getMovementLabel(adjustment)
  }));
  const filteredMovements = movements.filter((adjustment) => filter === "ALL" || adjustment.movement.key === filter);

  return (
    <article className="rounded-md border border-zera-line bg-white">
      <div className="border-b border-zera-line p-4">
        <div className="mb-3 flex items-center gap-3">
          <IconFrame icon={ClipboardCheck} />
          <div>
            <h3 className="text-base font-bold">Stock movements</h3>
            <p className="text-sm text-zera-muted">{filteredMovements.length} movement{filteredMovements.length === 1 ? "" : "s"} in this view</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["ALL", "All"],
            ["RECEIVED", "Received"],
            ["SALE", "Sales"],
            ["COUNT", "Counts"],
            ["VOID", "Voids"]
          ].map(([value, label]) => (
            <button
              key={value}
              className={`min-h-9 whitespace-nowrap rounded-md border px-3 text-xs font-bold transition ${
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

      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Movement</th>
              <th className="px-4 py-3">Change</th>
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {filteredMovements.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-zera-muted" colSpan="4">
                  No stock movements in this view.
                </td>
              </tr>
            ) : null}
            {filteredMovements.slice(0, 12).map((adjustment) => (
              <tr key={adjustment.id} className="hover:bg-zera-mintSoft">
                <td className="px-4 py-3">
                  <p className="font-bold text-zera-ink">{adjustment.product?.name || "Product"}</p>
                  <p className="mt-1 text-xs text-zera-muted">{formatMovementTime(adjustment.createdAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${adjustment.movement.className}`}>{adjustment.movement.label}</span>
                  {adjustment.note ? <p className="mt-2 max-w-44 truncate text-xs text-zera-muted">{adjustment.note}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${adjustment.quantityChange < 0 ? "bg-red-50 text-red-700" : "bg-zera-mint text-zera-green"}`}>
                    {adjustment.quantityChange > 0 ? "+" : ""}
                    {adjustment.quantityChange}
                  </span>
                  <p className="mt-2 text-xs text-zera-muted">
                    {adjustment.quantityBefore} to <span className="font-bold text-zera-ink">{adjustment.quantityAfter}</span>
                  </p>
                </td>
                <td className="px-4 py-3 text-zera-muted">{adjustment.user?.name || "User"}</td>
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
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{product.name}</p>
          <p className="mt-1 text-xs text-zera-muted">
            {formatMoney(product.price, currency)}
            {product.unit ? ` / ${product.unit}` : ""}
          </p>
        </div>
      </td>
      <td className="px-4 py-3">
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
      <td className="px-4 py-3">
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
      description:
        "Prepare medicines, services, and counter charges so pharmacy sales stay searchable and controlled before batch and expiry tracking is added.",
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
      description:
        "Prepare coded products, categories, and units for high-volume checkout. Stock quantities and purchase orders will connect after the catalog is clean.",
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
      description:
        "Track phones, accessories, parts, and repair-service items with clear stock counts, low-stock alerts, and product codes before serial-number tracking is added.",
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
      description:
        "Keep drinks, food, services, and charges clean. Ingredient recipes and kitchen stock movement will come later.",
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
      description:
        "Prepare guest services, minibar products, fees, and front desk charges before the full hotel inventory module arrives.",
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
    description:
      "Prepare physical products for stock tracking by keeping names, categories, units, and codes clean. Purchase and stock movement tools will build on this foundation.",
    checklistTitle: "Store keeper daily focus",
    checklistHelper: "Keep the catalog ready for selling and stock control.",
    tasks: [
      { title: "Check active stock items", helper: "Make sure daily products are active and easy for cashiers to find." },
      { title: "Add SKU or barcode", helper: "Physical products need identifiers before proper stock movement is reliable." },
      { title: "Group products", helper: "Categories make POS, reports, and future stock counts easier to understand." }
    ]
  };
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}
