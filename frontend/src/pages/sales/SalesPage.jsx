import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, FileText, Filter, MapPin, Printer, ReceiptText, RotateCcw, Smartphone, UserRound } from "lucide-react";
import Button from "../../components/Button.jsx";
import PrintableReceipt from "../../components/PrintableReceipt.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getRecentSales, voidSale } from "../../services/posService.js";

const periodOptions = [
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" }
];

export default function SalesPage() {
  const { activeBusiness, activeBusinessId, activeRoleName, branches } = useWorkspace();
  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [activePeriod, setActivePeriod] = useState("today");
  const [loading, setLoading] = useState(false);
  const [voidingSaleId, setVoidingSaleId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedSale = sales.find((sale) => sale.id === selectedSaleId) || sales[0] || null;
  const canVoidSales = ["Owner", "Manager"].includes(activeRoleName);
  const completedSales = sales.filter((sale) => sale.status === "COMPLETED");
  const voidedSales = sales.filter((sale) => sale.status === "VOIDED");
  const completedTotal = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const salesByPayment = useMemo(
    () =>
      completedSales.reduce(
        (totals, sale) => ({
          ...totals,
          [sale.paymentMethod]: (totals[sale.paymentMethod] || 0) + Number(sale.total)
        }),
        {}
      ),
    [completedSales]
  );

  useEffect(() => {
    if (!activeBusinessId) {
      setSales([]);
      setSelectedSaleId("");
      return;
    }

    loadSales();
  }, [activeBusinessId, filters]);

  async function loadSales() {
    try {
      setLoading(true);
      setError("");
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const data = await getRecentSales(activeBusinessId, params);
      setSales(data);
      setSelectedSaleId((current) => (data.some((sale) => sale.id === current) ? current : data[0]?.id || ""));
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load sales.");
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    setActivePeriod("custom");
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function clearFilters() {
    setActivePeriod("today");
    setFilters(createDefaultFilters());
  }

  function applyPeriod(period) {
    setActivePeriod(period);
    setFilters((current) => ({ ...current, ...getPeriodRange(period) }));
  }

  async function handleVoidSale(sale) {
    if (!activeBusinessId || !sale) {
      return;
    }

    setError("");
    setMessage("");
    setVoidingSaleId(sale.id);

    try {
      const updatedSale = await voidSale(activeBusinessId, sale.id);
      setSales((current) => current.map((item) => (item.id === updatedSale.id ? updatedSale : item)));
      setMessage(`${updatedSale.receiptNumber} was voided.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to void sale.");
    } finally {
      setVoidingSaleId("");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">POS sales</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Receipts and sales history</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              Review recorded POS sales for the selected business. Voiding is available to owners and managers only.
            </p>
          </div>
          <div className="flex min-h-14 min-w-14 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
            <ReceiptText size={30} />
          </div>
        </div>
      </section>

      {!activeBusiness ? (
        <section className="rounded-lg border border-zera-line bg-white p-6">
          <h3 className="text-lg font-bold">No business selected</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">Select a business before reviewing sales.</p>
        </section>
      ) : (
        <>
          {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

          <section className="grid gap-4 md:grid-cols-4">
            <Metric icon={ReceiptText} label="Completed" value={loading ? "..." : completedSales.length} />
            <Metric icon={RotateCcw} label="Voided" value={loading ? "..." : voidedSales.length} />
            <Metric icon={Banknote} label="Cash total" value={loading ? "..." : formatMoney(salesByPayment.CASH || 0, activeBusiness.currency)} compact />
            <Metric icon={FileText} label="Net total" value={loading ? "..." : formatMoney(completedTotal, activeBusiness.currency)} compact />
          </section>

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                <Filter size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Filters</h3>
                <p className="text-sm text-zera-muted">Narrow sales by branch, date, payment, or status.</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {periodOptions.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  className={`min-h-10 rounded-md border px-3 text-sm font-semibold transition ${
                    activePeriod === period.value
                      ? "border-zera-green bg-zera-green text-white"
                      : "border-zera-line bg-white text-zera-ink hover:border-zera-green hover:bg-zera-mint hover:text-zera-green"
                  }`}
                  onClick={() => applyPeriod(period.value)}
                >
                  {period.label}
                </button>
              ))}
              {activePeriod === "custom" ? <span className="inline-flex min-h-10 items-center rounded-md bg-[#f7faf8] px-3 text-sm font-semibold text-zera-muted">Custom range</span> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-6">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Branch</span>
                <select
                  className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={filters.branchId}
                  onChange={(event) => updateFilter("branchId", event.target.value)}
                >
                  <option value="">All branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <FilterInput label="From" type="date" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
              <FilterInput label="To" type="date" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Payment</span>
                <select
                  className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={filters.paymentMethod}
                  onChange={(event) => updateFilter("paymentMethod", event.target.value)}
                >
                  <option value="">All</option>
                  <option value="CASH">Cash</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="CARD">Card</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zera-ink">Status</span>
                <select
                  className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={filters.status}
                  onChange={(event) => updateFilter("status", event.target.value)}
                >
                  <option value="">All</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="VOIDED">Voided</option>
                </select>
              </label>
            </div>

            <Button type="button" variant="ghost" className="mt-4 px-3" onClick={clearFilters}>
              Reset today
            </Button>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-5">
                <h3 className="text-lg font-bold">Latest receipts</h3>
                <p className="mt-1 text-sm text-zera-muted">{loading ? "Loading..." : `${sales.length} receipt${sales.length === 1 ? "" : "s"}`}</p>
              </div>

              <div className="space-y-3">
                {!loading && sales.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">
                    No sales have been recorded yet.
                  </div>
                ) : null}

                {sales.map((sale) => {
                  const isSelected = selectedSale?.id === sale.id;

                  return (
                    <button
                      key={sale.id}
                      type="button"
                      className={`w-full rounded-md border p-4 text-left transition ${
                        isSelected ? "border-zera-green bg-zera-mint/60" : "border-zera-line hover:bg-[#f7faf8]"
                      }`}
                      onClick={() => setSelectedSaleId(sale.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold">{sale.receiptNumber}</h4>
                          <p className="mt-1 text-sm text-zera-muted">{formatDate(sale.createdAt)}</p>
                          <p className="mt-1 text-xs font-semibold text-zera-muted">{sale.customer?.name || "Walk-in customer"}</p>
                          {sale.table?.name ? (
                            <p className="mt-1 text-xs font-semibold text-zera-green">
                              {sale.table.name}
                              {sale.posOrder?.waiter?.name ? ` · ${sale.posOrder.waiter.name}` : ""}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatMoney(sale.total, activeBusiness.currency)}</p>
                          <StatusBadge status={sale.status} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-zera-line bg-white p-5">
              {!selectedSale ? (
                <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">Select a sale to view receipt details.</div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zera-green">Receipt</p>
                      <h3 className="mt-1 text-2xl font-bold">{selectedSale.receiptNumber}</h3>
                      <p className="mt-2 text-sm text-zera-muted">{formatDate(selectedSale.createdAt)}</p>
                    </div>
                    <StatusBadge status={selectedSale.status} />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <ReceiptInfo icon={MapPin} label="Branch" value={selectedSale.branch?.name || "Not set"} />
                    <ReceiptInfo icon={UserRound} label="Customer" value={selectedSale.customer?.name || "Walk-in customer"} />
                    <ReceiptInfo icon={ReceiptText} label="Table" value={selectedSale.table?.name || "Counter sale"} />
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <ReceiptInfo icon={paymentIcon(selectedSale.paymentMethod)} label="Payment" value={formatPayment(selectedSale.paymentMethod)} />
                    <ReceiptInfo icon={UserRound} label="Cashier" value={selectedSale.cashier?.name || "Not set"} />
                    <ReceiptInfo icon={UserRound} label="Waiter" value={selectedSale.posOrder?.waiter?.name || "Counter sale"} />
                  </div>

                  <div className="mt-5 space-y-3">
                    {selectedSale.items?.map((item) => (
                      <div key={item.id} className="rounded-md bg-[#f7faf8] px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold">{item.product?.name || "Product"}</p>
                            <p className="mt-1 text-sm text-zera-muted">
                              {item.quantity} x {formatMoney(item.unitPrice, activeBusiness.currency)}
                              {item.product?.unit ? ` / ${item.product.unit}` : ""}
                            </p>
                          </div>
                          <p className="font-bold">{formatMoney(item.lineTotal, activeBusiness.currency)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-lg border border-zera-line bg-[#f7faf8] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold">Printable receipt</h4>
                        <p className="mt-1 text-sm text-zera-muted">80mm thermal format</p>
                      </div>
                      <Printer className="text-zera-green" size={22} />
                    </div>
                    <PrintableReceipt business={activeBusiness} sale={selectedSale} />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Button type="button" variant="secondary" className="no-print gap-2" onClick={() => window.print()}>
                      <Printer size={18} />
                      Print receipt
                    </Button>
                    <Button
                      type="button"
                      variant={selectedSale.status === "COMPLETED" ? "primary" : "secondary"}
                      className="no-print"
                      disabled={!canVoidSales || selectedSale.status !== "COMPLETED" || voidingSaleId === selectedSale.id}
                      onClick={() => handleVoidSale(selectedSale)}
                    >
                      {selectedSale.status === "VOIDED" ? "Already voided" : "Void sale"}
                    </Button>
                  </div>
                </>
              )}
            </section>
          </section>
        </>
      )}
    </div>
  );
}

function FilterInput({ label, onChange, type, value }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zera-ink">{label}</span>
      <input
        className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({ icon: Icon, label, value, compact = false }) {
  return (
    <article className="rounded-lg border border-zera-line bg-white p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-zera-muted">{label}</p>
      <p className={`mt-2 font-bold text-zera-ink ${compact ? "text-lg" : "text-3xl"}`}>{value}</p>
    </article>
  );
}

function ReceiptInfo({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-[#f7faf8] p-3">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-white text-zera-green">
        <Icon size={18} />
      </div>
      <p className="text-xs font-semibold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${status === "COMPLETED" ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
      {status === "COMPLETED" ? "Completed" : "Voided"}
    </span>
  );
}

function paymentIcon(method) {
  if (method === "CARD") {
    return CreditCard;
  }

  if (method === "MOBILE_MONEY") {
    return Smartphone;
  }

  return Banknote;
}

function formatPayment(method) {
  return method.replace("_", " ").toLowerCase();
}

function createDefaultFilters() {
  return {
    branchId: "",
    paymentMethod: "",
    status: "",
    ...getPeriodRange("today")
  };
}

function getPeriodRange(period) {
  const today = new Date();
  const start = new Date(today);

  if (period === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  }

  if (period === "month") {
    start.setDate(1);
  }

  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(today)
  };
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
