import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, FileText, Filter, MapPin, Printer, ReceiptText, RotateCcw, Smartphone, UserRound } from "lucide-react";
import Button from "../../components/Button.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getRecentSales, voidSale } from "../../services/posService.js";

export default function SalesPage() {
  const { activeBusiness, activeBusinessId, activeRoleName, branches } = useWorkspace();
  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [filters, setFilters] = useState({
    branchId: "",
    dateFrom: "",
    dateTo: "",
    paymentMethod: "",
    status: ""
  });
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
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function clearFilters() {
    setFilters({
      branchId: "",
      dateFrom: "",
      dateTo: "",
      paymentMethod: "",
      status: ""
    });
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
              Clear filters
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
                    <ReceiptInfo icon={UserRound} label="Cashier" value={selectedSale.cashier?.name || "Not set"} />
                    <ReceiptInfo icon={paymentIcon(selectedSale.paymentMethod)} label="Payment" value={formatPayment(selectedSale.paymentMethod)} />
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

function PrintableReceipt({ business, sale }) {
  const currency = business?.currency || "UGX";
  const receiptDate = new Date(sale.createdAt);
  const subtotal = sale.items?.reduce((total, item) => total + Number(item.lineTotal), 0) || Number(sale.total);

  return (
    <article className="receipt-print-root mx-auto w-full max-w-[360px] bg-white p-5 font-mono text-[12px] leading-tight text-black shadow-soft">
      <header className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-black text-lg font-black">
          {business?.name?.charAt(0)?.toUpperCase() || "Z"}
        </div>
        <h3 className="mt-3 text-base font-black uppercase tracking-normal">{business?.name || "Zera Business"}</h3>
        <p className="mt-1">{sale.branch?.name || "Main Branch"}</p>
        {business?.country ? <p>{business.country}</p> : null}
        <p>Powered by Zera Solutions</p>
      </header>

      <div className="my-4 border-y-2 border-black py-2">
        <div className="flex justify-between gap-3">
          <span className="font-black">BILL</span>
          <span>{sale.receiptNumber}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Date</span>
          <span>{formatReceiptDate(receiptDate)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Time</span>
          <span>{formatReceiptTime(receiptDate)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Cashier</span>
          <span className="text-right">{sale.cashier?.name || "Not set"}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Payment</span>
          <span>{formatPayment(sale.paymentMethod)}</span>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-[1fr_42px_76px] gap-2 border-b-2 border-black pb-2 font-black uppercase">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Total</span>
        </div>
        <div className="divide-y divide-dashed divide-black">
          {sale.items?.map((item) => (
            <div key={item.id} className="py-2">
              <div className="grid grid-cols-[1fr_42px_76px] gap-2">
                <span className="break-words font-bold">{item.product?.name || "Product"}</span>
                <span className="text-right">{item.quantity}</span>
                <span className="text-right">{formatReceiptAmount(item.lineTotal)}</span>
              </div>
              <div className="mt-1 text-[11px] text-zera-muted">
                {item.quantity} x {formatMoney(item.unitPrice, currency)}
                {item.product?.unit ? ` / ${item.product.unit}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t-2 border-black pt-3">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Tax</span>
          <span>{formatMoney(0, currency)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>Discount</span>
          <span>{formatMoney(0, currency)}</span>
        </div>
        <div className="mt-3 border-2 border-black p-2 text-center">
          <p className="text-xs font-black uppercase">Total</p>
          <p className="mt-1 text-xl font-black">{formatMoney(sale.total, currency)}</p>
        </div>
      </div>

      {sale.status === "VOIDED" ? (
        <div className="mt-3 border border-black py-2 text-center text-sm font-black uppercase">Voided receipt</div>
      ) : null}

      <footer className="mt-5 text-center">
        <div className="mx-auto h-10 w-44 bg-[repeating-linear-gradient(90deg,#000_0_2px,#fff_2px_5px,#000_5px_6px,#fff_6px_9px)]" />
        <p className="mt-4 font-black">Thank you for your purchase</p>
        <p className="mt-1 text-[11px]">Goods sold are subject to the shop return policy.</p>
      </footer>
    </article>
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

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatReceiptAmount(value) {
  return Number(value).toLocaleString();
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatReceiptDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(value);
}

function formatReceiptTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}
