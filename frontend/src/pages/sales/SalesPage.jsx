import { useEffect, useMemo, useState } from "react";
import { Banknote, FileText, Printer, ReceiptText, RotateCcw, Search, X } from "lucide-react";
import Button from "../../components/Button.jsx";
import PrintableReceipt from "../../components/PrintableReceipt.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getRecentSales, voidSale } from "../../services/posService.js";

const periodOptions = [
  { label: "Today", value: "today" },
  { label: "Weekly", value: "week" },
  { label: "Monthly", value: "month" }
];

export default function SalesPage() {
  const { activeBusiness, activeBusinessId, activeRoleName, branches } = useWorkspace();
  const [sales, setSales] = useState([]);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [query, setQuery] = useState("");
  const [activePeriod, setActivePeriod] = useState("today");
  const [loading, setLoading] = useState(false);
  const [voidingSaleId, setVoidingSaleId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canVoidSales = ["Owner", "Manager"].includes(activeRoleName);
  const visibleSales = useMemo(() => filterSalesByQuery(sales, query), [sales, query]);
  const selectedSale = visibleSales.find((sale) => sale.id === selectedSaleId) || null;
  const completedSales = visibleSales.filter((sale) => sale.status === "COMPLETED");
  const voidedSales = visibleSales.filter((sale) => sale.status === "VOIDED");
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
      setSelectedSaleId((current) => (data.some((sale) => sale.id === current) ? current : ""));
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

  if (!activeBusiness) {
    return (
      <section className="rounded-md border border-zera-line bg-white p-5">
        <h2 className="text-xl font-bold">Sales</h2>
        <p className="mt-2 text-sm text-zera-muted">Select a business before reviewing sales.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="grid gap-3 border-b border-zera-line px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Sales register</p>
              <span className="h-1 w-1 rounded-full bg-zera-line" />
              <p className="text-xs font-semibold text-zera-muted">{completedSales.length} completed receipts</p>
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-zera-ink">Receipts</h2>
            <p className="mt-0.5 max-w-3xl text-sm text-zera-muted">
              Filter, review, print, or void receipts from one compact register.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center rounded-md border border-zera-line bg-white px-3 text-sm font-bold text-zera-muted">
              {activeBusiness.name}
            </span>
            <Button type="button" variant="secondary" className="h-9 px-3" disabled={loading} onClick={loadSales}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <SalesCounts
          cashTotal={salesByPayment.CASH || 0}
          completedCount={completedSales.length}
          currency={activeBusiness.currency}
          loading={loading}
          netTotal={completedTotal}
          voidedCount={voidedSales.length}
        />
        <SalesInsightPanel activeBusiness={activeBusiness} sales={visibleSales} />
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mintSoft px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section>
        <article className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
          <SalesToolbar
            activePeriod={activePeriod}
            branches={branches}
            filters={filters}
            onClear={clearFilters}
            onFilterChange={updateFilter}
            onPeriodChange={applyPeriod}
            onQueryChange={setQuery}
            query={query}
          />
          <SalesTable
            activeBusiness={activeBusiness}
            loading={loading}
            onSelect={setSelectedSaleId}
            sales={visibleSales}
            selectedSaleId={selectedSaleId}
          />
        </article>
      </section>

      {selectedSale ? (
        <ReceiptModal
          activeBusiness={activeBusiness}
          canVoidSales={canVoidSales}
          onClose={() => setSelectedSaleId("")}
          onPrint={() => window.print()}
          onVoid={handleVoidSale}
          sale={selectedSale}
          voidingSaleId={voidingSaleId}
        />
      ) : null}
    </div>
  );
}

function SalesCounts({ cashTotal, completedCount, currency, loading, netTotal, voidedCount }) {
  const items = [
    { label: "Completed", value: completedCount, icon: ReceiptText },
    { label: "Voided", value: voidedCount, icon: RotateCcw },
    { label: "Cash", value: formatMoney(cashTotal, currency), icon: Banknote },
    { label: "Net total", value: formatMoney(netTotal, currency), icon: FileText }
  ];

  return (
    <section className="grid divide-y divide-zera-line md:grid-cols-4 md:divide-x md:divide-y-0">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div className="flex min-w-0 items-center gap-2.5 bg-white px-4 py-3 text-sm" key={item.label}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
              <Icon size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zera-muted">{item.label}</p>
              <p className="mt-0.5 truncate text-base font-bold text-zera-ink">{loading ? "..." : item.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function SalesToolbar({ activePeriod, branches, filters, onClear, onFilterChange, onPeriodChange, onQueryChange, query }) {
  return (
    <div className="overflow-x-auto border-b border-zera-line px-3 py-2">
      <div className="flex min-w-max flex-nowrap items-center gap-2">
        <label className="flex h-9 w-[320px] shrink-0 items-center gap-2 rounded-md border border-zera-line bg-white px-2.5 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
          <Search size={16} className="shrink-0 text-zera-muted" />
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="Search receipt, customer, product"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <div className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-zera-line bg-zera-surface p-1">
          {periodOptions.map((period) => (
            <button
              className={`h-7 min-w-[70px] rounded px-2 text-sm font-bold transition ${
                activePeriod === period.value ? "bg-white text-zera-green shadow-xs" : "text-zera-muted hover:bg-white hover:text-zera-ink"
              }`}
              key={period.value}
              type="button"
              onClick={() => onPeriodChange(period.value)}
            >
              {period.label}
            </button>
          ))}
        </div>

        <CompactSelect className="w-[128px]" value={filters.branchId} onChange={(value) => onFilterChange("branchId", value)} label="Branch">
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </CompactSelect>

        <CompactInput className="w-[136px]" label="From" type="date" value={filters.dateFrom} onChange={(value) => onFilterChange("dateFrom", value)} />
        <CompactInput className="w-[136px]" label="To" type="date" value={filters.dateTo} onChange={(value) => onFilterChange("dateTo", value)} />

        <CompactSelect className="w-[136px]" value={filters.paymentMethod} onChange={(value) => onFilterChange("paymentMethod", value)} label="Payment">
          <option value="">All payments</option>
          <option value="CASH">Cash</option>
          <option value="MOBILE_MONEY">Mobile money</option>
          <option value="CARD">Card</option>
        </CompactSelect>

        <CompactSelect className="w-[112px]" value={filters.status} onChange={(value) => onFilterChange("status", value)} label="Status">
          <option value="">All status</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
        </CompactSelect>

        <button className="h-9 w-[64px] shrink-0 rounded-md border border-zera-line bg-white px-2 text-sm font-bold text-zera-muted hover:bg-zera-surface hover:text-zera-ink" type="button" onClick={onClear}>
          Reset
        </button>
      </div>
    </div>
  );
}

function CompactSelect({ children, className = "", label, onChange, value }) {
  return (
    <label className={`min-w-[120px] shrink-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        className="h-9 w-full rounded-md border border-zera-line bg-white px-2.5 pr-7 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function CompactInput({ className = "", label, onChange, type, value }) {
  return (
    <label className={`min-w-[140px] shrink-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <input
        className="h-9 w-full rounded-md border border-zera-line bg-white px-2.5 text-sm font-semibold tabular-nums text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SalesTable({ activeBusiness, loading, onSelect, sales, selectedSaleId }) {
  return (
    <div className="overflow-x-auto">
      <div className="max-h-[calc(100vh-278px)] min-w-[1080px] overflow-y-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
            <tr>
              <th className="w-[17%] px-3 py-2.5">Receipt</th>
              <th className="w-[14%] px-3 py-2.5">Time</th>
              <th className="w-[20%] px-3 py-2.5">Customer</th>
              <th className="w-[13%] px-3 py-2.5">Branch</th>
              <th className="w-[11%] px-3 py-2.5">Payment</th>
              <th className="w-[9%] px-3 py-2.5">Status</th>
              <th className="w-[16%] px-3 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {loading ? (
              <tr>
                <td className="px-3 py-8 text-sm text-zera-muted" colSpan={7}>
                  Loading receipts...
                </td>
              </tr>
            ) : null}
            {!loading && sales.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-sm text-zera-muted" colSpan={7}>
                  No sales found for this view.
                </td>
              </tr>
            ) : null}
            {!loading &&
              sales.map((sale) => (
                <tr
                  className={`cursor-pointer transition hover:bg-zera-mintSoft ${selectedSaleId === sale.id ? "bg-zera-mintSoft" : ""}`}
                  key={sale.id}
                  onClick={() => onSelect(sale.id)}
                >
                  <td className="px-3 py-2.5">
                    <p className="truncate font-bold text-zera-ink">{sale.receiptNumber}</p>
                    {sale.table?.name ? <p className="mt-1 text-xs font-semibold text-zera-green">{sale.table.name}</p> : null}
                  </td>
                  <td className="px-3 py-2.5 text-zera-muted">{formatDate(sale.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <p className="truncate font-semibold">{sale.customer?.name || "Walk-in"}</p>
                    {sale.posOrder?.waiter?.name ? <p className="mt-1 text-xs text-zera-muted">Waiter: {sale.posOrder.waiter.name}</p> : null}
                  </td>
                  <td className="px-3 py-2.5 text-zera-muted">{sale.branch?.name || "Not set"}</td>
                  <td className="px-3 py-2.5 text-zera-muted">{formatPayment(sale.paymentMethod)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={sale.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-base font-extrabold tracking-tight text-zera-ink">
                    {formatMoney(sale.total, activeBusiness.currency)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesInsightPanel({ activeBusiness, sales }) {
  const completedSales = sales.filter((sale) => sale.status === "COMPLETED");
  const total = completedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const averageSale = completedSales.length ? total / completedSales.length : 0;
  const paymentRows = buildPaymentRows(completedSales, activeBusiness.currency);
  const topProduct = buildTopProducts(completedSales, activeBusiness.currency)[0] || null;
  const cashier = buildCashierRows(completedSales, activeBusiness.currency)[0] || null;
  const topPayment = paymentRows[0] || null;

  return (
    <section className="grid divide-y divide-zera-line border-t border-zera-line bg-zera-surface md:grid-cols-4 md:divide-x md:divide-y-0">
      <SalesPulseCell label="Average receipt" value={formatMoney(averageSale, activeBusiness.currency)} helper={`${completedSales.length} completed`} />
      <SalesPulseCell label="Main payment" value={topPayment ? formatPayment(topPayment.method) : "No payments"} helper={topPayment?.formattedTotal || "No completed sales"} />
      <SalesPulseCell label="Top item" value={topProduct?.name || "No item yet"} helper={topProduct ? `${topProduct.quantity} sold` : "Record sales to see this"} />
      <SalesPulseCell label="Top cashier" value={cashier?.name || "No cashier yet"} helper={cashier ? cashier.formattedTotal : "No cashier totals"} />
    </section>
  );
}

function SalesPulseCell({ helper, label, value }) {
  return (
    <div className="min-w-0 px-4 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-zera-ink">{value}</p>
      <p className="mt-0.5 truncate text-xs text-zera-muted">{helper}</p>
    </div>
  );
}

function ReceiptModal({ activeBusiness, canVoidSales, onClose, onPrint, onVoid, sale, voidingSaleId }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zera-ink/45 p-4">
      <article className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-zera-line bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-zera-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Receipt review</p>
            <h3 className="mt-1 truncate text-xl font-bold">{sale.receiptNumber}</h3>
            <p className="mt-1 text-sm text-zera-muted">{formatDate(sale.createdAt)}</p>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <div className="text-right">
              <StatusBadge status={sale.status} />
              <p className="mt-2 text-lg font-bold text-zera-ink">{formatMoney(sale.total, activeBusiness.currency)}</p>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-md border border-zera-line bg-white text-zera-muted transition hover:bg-zera-mintSoft hover:text-zera-ink"
              type="button"
              onClick={onClose}
              aria-label="Close receipt review"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <ReceiptFact label="Branch" value={sale.branch?.name || "Not set"} />
              <ReceiptFact label="Payment" value={formatPayment(sale.paymentMethod)} />
              <ReceiptFact label="Customer" value={sale.customer?.name || "Walk-in"} />
              <ReceiptFact label="Table" value={sale.table?.name || "Counter"} />
              <ReceiptFact label="Cashier" value={sale.cashier?.name || "Not set"} />
              <ReceiptFact label="Waiter" value={sale.posOrder?.waiter?.name || "Counter"} />
            </div>

            <div className="overflow-hidden rounded-md border border-zera-line bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-zera-line bg-zera-mintSoft px-4 py-3">
                <div>
                  <h4 className="font-bold">Items sold</h4>
                  <p className="mt-1 text-xs text-zera-muted">{sale.items?.length || 0} line item{sale.items?.length === 1 ? "" : "s"}</p>
                </div>
                <ReceiptText className="text-zera-green" size={19} />
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-zera-line bg-white text-xs font-bold uppercase text-zera-muted">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Unit price</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zera-line">
                    {sale.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-zera-ink">{item.product?.name || "Product"}</p>
                          {item.product?.unit ? <p className="mt-0.5 text-xs text-zera-muted">{item.product.unit}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-zera-muted">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-zera-muted">{formatMoney(item.unitPrice, activeBusiness.currency)}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatMoney(item.lineTotal, activeBusiness.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="border-t border-zera-line bg-zera-surface p-5 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold">Receipt preview</h4>
                <p className="mt-1 text-xs text-zera-muted">Customer print format</p>
              </div>
              <Printer className="text-zera-green" size={20} />
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto rounded-md border border-zera-line bg-white p-3">
              <PrintableReceipt business={activeBusiness} sale={sale} />
            </div>
          </aside>
        </div>

        <footer className="grid gap-2 border-t border-zera-line bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <p className="text-sm text-zera-muted">Close this window to return to the receipt register.</p>
          <Button type="button" variant="secondary" className="no-print gap-2" onClick={onPrint}>
            <Printer size={18} />
            Print receipt
          </Button>
          <Button
            type="button"
            variant={sale.status === "COMPLETED" ? "primary" : "secondary"}
            className="no-print"
            disabled={!canVoidSales || sale.status !== "COMPLETED" || voidingSaleId === sale.id}
            onClick={() => onVoid(sale)}
          >
            {sale.status === "VOIDED" ? "Voided" : "Void sale"}
          </Button>
        </footer>
      </article>
    </div>
  );
}

function ReceiptFact({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${status === "COMPLETED" ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
      {status === "COMPLETED" ? "Completed" : "Voided"}
    </span>
  );
}

function formatPayment(method) {
  if (!method) {
    return "not set";
  }

  return method.replace("_", " ").toLowerCase();
}

function filterSalesByQuery(sales, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return sales;
  }

  return sales.filter((sale) => {
    const searchableValues = [
      sale.receiptNumber,
      sale.customer?.name,
      sale.customer?.phone,
      sale.customer?.email,
      sale.cashier?.name,
      sale.posOrder?.waiter?.name,
      sale.branch?.name,
      sale.table?.name,
      sale.paymentMethod,
      sale.status,
      ...(sale.items || []).map((item) => item.product?.name),
      ...(sale.items || []).map((item) => item.product?.category)
    ];

    return searchableValues
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });
}

function buildPaymentRows(sales, currency) {
  const total = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const totals = sales.reduce((result, sale) => {
    result[sale.paymentMethod] = (result[sale.paymentMethod] || 0) + Number(sale.total || 0);
    return result;
  }, {});

  return Object.entries(totals)
    .map(([method, amount]) => ({
      method,
      amount,
      formattedTotal: formatMoney(amount, currency),
      percent: total ? Math.max(4, Math.round((amount / total) * 100)) : 0
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildTopProducts(sales, currency) {
  const products = new Map();

  sales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const key = item.product?.id || item.product?.name || item.id;
      const current = products.get(key) || {
        name: item.product?.name || "Product",
        quantity: 0,
        total: 0
      };

      current.quantity += Number(item.quantity || 0);
      current.total += Number(item.lineTotal || 0);
      products.set(key, current);
    });
  });

  return [...products.values()]
    .map((item) => ({
      ...item,
      formattedTotal: formatMoney(item.total, currency)
    }))
    .sort((a, b) => b.total - a.total);
}

function buildCashierRows(sales, currency) {
  const cashiers = new Map();

  sales.forEach((sale) => {
    const name = sale.cashier?.name || "Unassigned";
    const current = cashiers.get(name) || { name, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(sale.total || 0);
    cashiers.set(name, current);
  });

  return [...cashiers.values()]
    .map((cashier) => ({
      ...cashier,
      formattedTotal: formatMoney(cashier.total, currency)
    }))
    .sort((a, b) => b.total - a.total);
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
