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
  Tag
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
  const uncategorizedPhysicalProducts = physicalProducts.filter((product) => !product.category);
  const lowStockItems = stockItems.filter((stock) => stock.reorderLevel > 0 && stock.quantity <= stock.reorderLevel);
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
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [product.name, product.sku, product.barcode, product.category, product.unit]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));

    return matchesType && matchesSearch;
  });

  const readiness = [
    {
      label: "Physical catalog",
      value: activePhysicalProducts.length,
      helper: activePhysicalProducts.length ? "Items ready for stock tracking" : "Create active physical products first",
      ready: activePhysicalProducts.length > 0
    },
    {
      label: "Codes",
      value: uncodedPhysicalProducts.length,
      helper: uncodedPhysicalProducts.length ? "Need SKU or barcode" : "Physical items have identifiers",
      ready: uncodedPhysicalProducts.length === 0 && physicalProducts.length > 0
    },
    {
      label: "Categories",
      value: categories.length,
      helper: uncategorizedPhysicalProducts.length ? "Some products need grouping" : "Catalog is easy to scan",
      ready: uncategorizedPhysicalProducts.length === 0 && physicalProducts.length > 0
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
        <section className="rounded-lg border border-zera-line bg-white p-6">
          <h2 className="text-2xl font-bold">Inventory</h2>
          <p className="mt-2 text-sm text-zera-muted">Select a business before managing inventory.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-zera-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-zera-green">{guide.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{guide.title}</h2>
            <p className="mt-2 max-w-3xl leading-7 text-zera-muted">{guide.description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-semibold text-zera-ink transition hover:bg-zera-mint disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={loadStock}
            >
              {loading ? "Refreshing..." : "Refresh stock"}
            </button>
            <Link
              to="/products"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zera-green px-4 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              <Package size={17} />
              Products
            </Link>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        {readiness.map((item) => (
          <InventoryMetric key={item.label} {...item} loading={loading} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-zera-line bg-white p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <IconFrame icon={ShieldCheck} />
              <div>
                <h3 className="text-lg font-bold">Stock desk</h3>
                <p className="text-sm text-zera-muted">Update the selected item for {activeBranch?.name || "this branch"}.</p>
              </div>
            </div>
            <span className="rounded-md bg-[#f7faf8] px-3 py-2 text-xs font-bold uppercase text-zera-muted">
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

          <AttentionList currency={activeBusiness.currency} items={lowStockItems} onSelect={selectLowStock} />

          <div className="mt-5 rounded-lg border border-zera-line bg-[#f7faf8] p-4">
            <div className="mb-3 flex items-center gap-3">
              <IconFrame icon={ClipboardCheck} />
              <div>
                <h3 className="text-base font-bold">{guide.checklistTitle}</h3>
                <p className="text-sm text-zera-muted">{guide.checklistHelper}</p>
              </div>
            </div>
            <div className="space-y-2">
              {guide.tasks.map((task) => (
                <div key={task.title} className="flex gap-2 text-sm leading-6">
                  <CheckCircle2 className="mt-1 shrink-0 text-zera-green" size={16} />
                  <p>
                    <span className="font-bold text-zera-ink">{task.title}: </span>
                    <span className="text-zera-muted">{task.helper}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <MovementHistory adjustments={recentAdjustments} filter={movementFilter} onFilterChange={setMovementFilter} />
        </article>

        <article className="rounded-lg border border-zera-line bg-white p-5">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <IconFrame icon={Boxes} />
              <div>
                <h3 className="text-lg font-bold">Stock list</h3>
                <p className="text-sm text-zera-muted">
                  {loading ? "Loading..." : `${physicalProducts.length} physical item${physicalProducts.length === 1 ? "" : "s"} in this branch`}
                </p>
              </div>
            </div>
            <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-zera-line bg-white px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10 xl:w-80">
              <Search size={18} className="shrink-0 text-zera-muted" />
              <input
                className="w-full border-0 bg-transparent text-sm outline-none"
                placeholder="Search item, SKU, barcode"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {[
              ["ALL", "All stock"],
              ["LOW", "Needs attention"],
              ["NEEDS_CODE", "Missing code"],
              ["PAUSED", "Paused"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`min-h-10 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition ${
                  typeFilter === value ? "border-zera-green bg-zera-green text-white" : "border-zera-line bg-white text-zera-ink hover:bg-zera-mint"
                }`}
                onClick={() => setTypeFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-md border border-zera-line">
            <div className="grid grid-cols-[1.25fr_0.7fr_0.6fr_0.65fr_0.55fr] gap-3 border-b border-zera-line bg-[#f7faf8] px-4 py-3 text-xs font-bold uppercase text-zera-muted">
              <span>Item</span>
              <span>Code</span>
              <span>Current stock</span>
              <span>Low stock alert</span>
              <span>Status</span>
            </div>
            <div className="max-h-[430px] overflow-y-auto">
              {!loading && filteredStockItems.length === 0 ? (
                <div className="p-5 text-sm text-zera-muted">No stock items match this view.</div>
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
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SmallSummary icon={Package} label="Physical" value={physicalProducts.length} />
            <SmallSummary icon={AlertTriangle} label="Low stock" value={lowStockItems.length} />
            <SmallSummary icon={Tag} label="Categories" value={categories.length} />
          </div>
        </article>
      </section>
    </div>
  );
}

function IconFrame({ icon: Icon }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
      <Icon size={22} />
    </div>
  );
}

function InventoryMetric({ helper, label, loading, ready, value }) {
  return (
    <article className="rounded-lg border border-zera-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold uppercase text-zera-muted">{label}</p>
        {ready ? <CheckCircle2 className="text-zera-green" size={19} /> : <AlertTriangle className="text-amber-600" size={19} />}
      </div>
      <p className="text-2xl font-bold">{loading ? "..." : value}</p>
      <p className="mt-1 text-sm leading-6 text-zera-muted">{helper}</p>
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
    <form className="rounded-lg border border-zera-line bg-white p-4" onSubmit={isReceiveMode ? onReceiveSubmit : onSubmit}>
      <div className="mb-4 flex items-center gap-3">
        <IconFrame icon={Package} />
        <div>
          <h3 className="text-lg font-bold">Update stock</h3>
          <p className="text-sm text-zera-muted">{activeBranch?.name || "Selected branch"}</p>
        </div>
      </div>

      {!stock ? (
        <div className="rounded-md border border-dashed border-zera-line p-4 text-sm text-zera-muted">
          Create physical products first, then stock counts can be managed here.
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-md bg-[#f7faf8] p-3">
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
                <p className="mt-1 text-2xl font-bold">{stock.quantity}</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-xs font-bold uppercase text-zera-muted">Low stock alert</p>
                <p className="mt-1 text-2xl font-bold">{stock.reorderLevel || "Off"}</p>
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-[#f7faf8] p-1">
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
                  className="min-h-11 w-full rounded-md border border-zera-line px-3 text-base outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  min="1"
                  placeholder="e.g. 12"
                  type="number"
                  value={receiveForm.quantity}
                  onChange={(event) => onReceiveChange({ ...receiveForm, quantity: event.target.value })}
                />
              </label>

              <div className="mt-3 rounded-md bg-zera-mint p-3 text-sm text-zera-green">
                Current stock {stock.quantity} + received {receivedQuantity || 0} ={" "}
                <span className="font-bold">{projectedStock}</span>
              </div>

              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Delivery note</span>
                <input
                  className="min-h-11 w-full rounded-md border border-zera-line px-3 text-base outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
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
                    className="min-h-11 w-full rounded-md border border-zera-line px-3 text-base outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                    min="0"
                    type="number"
                    value={form.quantity}
                    onChange={(event) => onChange({ ...form, quantity: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zera-ink">Alert when stock reaches</span>
                  <input
                    className="min-h-11 w-full rounded-md border border-zera-line px-3 text-base outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
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
                  className="min-h-11 w-full rounded-md border border-zera-line px-3 text-base outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  placeholder="e.g. Stock count, breakage correction"
                  value={form.note}
                  onChange={(event) => onChange({ ...form, note: event.target.value })}
                />
              </label>
            </>
          )}

          <button
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zera-green px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
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

function AttentionList({ currency, items, onSelect }) {
  return (
    <article className="mt-5 rounded-lg border border-zera-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">Needs attention</h3>
          <p className="text-sm text-zera-muted">Select an item to receive new stock.</p>
        </div>
        <span className={`rounded-md px-3 py-1 text-sm font-bold ${items.length ? "bg-amber-50 text-amber-700" : "bg-zera-mint text-zera-green"}`}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-zera-line p-4 text-sm text-zera-muted">No low-stock items in this branch.</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 4).map((stock) => (
            <button
              key={stock.id}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-3 py-3 text-left transition hover:border-zera-green hover:bg-zera-mint"
              type="button"
              onClick={() => onSelect(stock)}
            >
              <div className="min-w-0">
                <p className="truncate font-bold">{stock.product.name}</p>
                <p className="mt-1 text-xs text-zera-muted">
                  {formatMoney(stock.product.price, currency)}
                  {stock.product.unit ? ` / ${stock.product.unit}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-amber-700">{stock.quantity}</p>
                <p className="text-xs text-zera-muted">Receive</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function MovementHistory({ adjustments, filter, onFilterChange }) {
  const movements = adjustments.map((adjustment) => ({
    ...adjustment,
    movement: getMovementLabel(adjustment)
  }));
  const filteredMovements = movements.filter((adjustment) => filter === "ALL" || adjustment.movement.key === filter);

  return (
    <article className="mt-5 rounded-lg border border-zera-line bg-white p-4">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <IconFrame icon={ClipboardCheck} />
          <div>
            <h3 className="text-lg font-bold">Stock movements</h3>
            <p className="text-sm text-zera-muted">Received stock, sales, voids, and count corrections.</p>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
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
                filter === value ? "border-zera-green bg-zera-green text-white" : "border-zera-line bg-white text-zera-muted hover:bg-zera-mint hover:text-zera-ink"
              }`}
              type="button"
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredMovements.length === 0 ? (
          <div className="rounded-md border border-dashed border-zera-line p-4 text-sm text-zera-muted">No stock movements in this view.</div>
        ) : null}
        {filteredMovements.slice(0, 8).map((adjustment) => (
          <div key={adjustment.id} className="rounded-md bg-[#f7faf8] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold">{adjustment.product?.name || "Product"}</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${adjustment.movement.className}`}>{adjustment.movement.label}</span>
                </div>
                <p className="mt-1 text-xs text-zera-muted">{formatMovementTime(adjustment.createdAt)} by {adjustment.user?.name || "User"}</p>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${adjustment.quantityChange < 0 ? "bg-red-50 text-red-700" : "bg-zera-mint text-zera-green"}`}>
                {adjustment.quantityChange > 0 ? "+" : ""}
                {adjustment.quantityChange}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-zera-muted">
              <span>{adjustment.quantityBefore}</span>
              <span>to</span>
              <span className="font-bold text-zera-ink">{adjustment.quantityAfter}</span>
            </div>
            {adjustment.note ? <p className="mt-2 text-xs text-zera-muted">{adjustment.note}</p> : null}
          </div>
        ))}
      </div>
    </article>
  );
}

function InventoryRow({ active, currency, onSelect, stock }) {
  const product = stock.product;
  const missingCode = !product.sku && !product.barcode;
  const status = getStockStatus(stock);

  return (
    <button
      className={`grid w-full grid-cols-[1.25fr_0.7fr_0.6fr_0.65fr_0.55fr] gap-3 border-b border-zera-line px-4 py-3 text-left text-sm transition last:border-b-0 ${
        active ? "bg-zera-mint" : "hover:bg-[#f7faf8]"
      }`}
      type="button"
      onClick={onSelect}
    >
      <div className="min-w-0">
        <p className="truncate font-bold">{product.name}</p>
        <p className="mt-1 text-xs text-zera-muted">
          {formatMoney(product.price, currency)}
          {product.unit ? ` / ${product.unit}` : ""}
        </p>
      </div>
      <div className="min-w-0">
        <span
          className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
            missingCode ? "bg-amber-50 text-amber-700" : "bg-white text-zera-muted"
          }`}
        >
          <Barcode size={13} />
          <span className="truncate">{product.sku || product.barcode || "Needs code"}</span>
        </span>
      </div>
      <div>
        <span className={`text-lg font-bold ${status.tone === "warning" ? "text-amber-700" : "text-zera-ink"}`}>{stock.quantity}</span>
      </div>
      <div className="font-semibold text-zera-muted">{stock.reorderLevel}</div>
      <div>
        <StockStatusBadge status={status} />
      </div>
    </button>
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

function SmallSummary({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-[#f7faf8] p-3">
      <div className="flex items-center gap-2 text-sm font-bold text-zera-muted">
        <Icon size={16} className="text-zera-green" />
        {label}
      </div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
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
