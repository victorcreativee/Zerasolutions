import { useEffect, useMemo, useState } from "react";
import Pagination, { usePagination } from "../../components/Pagination.jsx";
import { BarChart3, Banknote, Boxes, CreditCard, Download, MapPin, ReceiptText, RefreshCcw, Smartphone } from "lucide-react";
import Button from "../../components/Button.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { downloadReportCsv, getReportSummary } from "../../services/reportsService.js";

const periodOptions = [
  { label: "Today", value: "today" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" }
];

export default function ReportsPage() {
  const { activeBusiness, activeBusinessId, branches } = useWorkspace();
  const [report, setReport] = useState(null);
  const [sales, setSales] = useState([]);
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [activePeriod, setActivePeriod] = useState("today");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const completedSales = useMemo(() => sales.filter((sale) => sale.status === "COMPLETED"), [sales]);
  const fallbackVoidedSales = useMemo(() => sales.filter((sale) => sale.status === "VOIDED"), [sales]);
  const fallbackTotalSales = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const fallbackItemCount = countItems(completedSales);
  const fallbackPaymentRows = useMemo(() => buildPaymentRows(completedSales), [completedSales]);
  const fallbackBranchRows = useMemo(() => buildBranchRows(completedSales), [completedSales]);
  const fallbackProductRows = useMemo(() => buildProductRows(completedSales), [completedSales]);
  const fallbackWaiterRows = useMemo(() => buildWaiterRows(completedSales), [completedSales]);
  const fallbackCashierRows = useMemo(() => buildCashierRows(completedSales), [completedSales]);
  const fallbackStaffRows = useMemo(() => buildStaffPerformanceRows(fallbackWaiterRows, fallbackCashierRows), [fallbackCashierRows, fallbackWaiterRows]);
  const reportSummary = report?.summary || {};
  const totalSales = reportSummary.totalSales ?? fallbackTotalSales;
  const discountTotal = reportSummary.discountTotal ?? completedSales.reduce((total, sale) => total + Number(sale.discountAmount || 0), 0);
  const taxCollected = reportSummary.taxCollected ?? completedSales.reduce((total, sale) => total + Number(sale.taxAmount || 0), 0);
  const receiptCount = reportSummary.receiptCount ?? completedSales.length;
  const voidedCount = reportSummary.voidedCount ?? fallbackVoidedSales.length;
  const averageSale = reportSummary.averageSale ?? (completedSales.length ? totalSales / completedSales.length : 0);
  const itemCount = reportSummary.itemCount ?? fallbackItemCount;
  const paymentRows = report?.paymentRows || fallbackPaymentRows;
  const branchRows = report?.branchRows || fallbackBranchRows;
  const productRows = report?.productRows || fallbackProductRows;
  const staffRows = report?.staffRows || fallbackStaffRows;

  useEffect(() => {
    if (!activeBusinessId) {
      setReport(null);
      setSales([]);
      return;
    }

    loadReport();
  }, [activeBusinessId, filters]);

  async function loadReport() {
    try {
      setLoading(true);
      setError("");
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const data = await getReportSummary(activeBusinessId, params);
      setReport(data);
      setSales(data.recentReceipts || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const blob = await downloadReportCsv(activeBusinessId, params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(activeBusiness.name)}-sales-report.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      const data = error.response?.data;
      let message = data?.message;
      if (data instanceof Blob) {
        try { message = JSON.parse(await data.text()).message; } catch { /* Use the fallback message. */ }
      }
      setError(message || "Unable to export the report. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function updateFilter(key, value) {
    setActivePeriod("custom");
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
  }

  function applyPeriod(period) {
    setActivePeriod(period);
    setFilters((current) => ({ ...current, ...getPeriodRange(period) }));
  }

  function resetFilters() {
    setActivePeriod("today");
    setFilters(createDefaultFilters());
  }

  if (!activeBusiness) {
    return (
      <div className="mx-auto max-w-[1500px] rounded-md border border-zera-line bg-white p-5">
        <h2 className="text-xl font-bold">No business selected</h2>
        <p className="mt-2 text-sm text-zera-muted">Select a business before viewing reports.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="grid gap-4 border-b border-zera-line px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>

            <h2 className="mt-1 text-xl font-bold">Sales report</h2>
            <p className="mt-1 text-sm text-zera-muted">{activeBusiness.name} · {formatDateLabel(filters.dateFrom)} – {formatDateLabel(filters.dateTo)}</p>

          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" className="h-10 gap-2 px-3 shadow-xs" onClick={handleExport} disabled={exporting || loading}>
              <Download size={16} />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>

        <div className="grid divide-y divide-zera-line md:grid-cols-4 md:divide-x md:divide-y-0">
          <ReportMetricCell icon={Banknote} label="Sales collected" value={loading ? "..." : formatMoney(totalSales, activeBusiness.currency)} helper="Including tax" />
          <ReportMetricCell icon={ReceiptText} label="Receipts" value={loading ? "..." : receiptCount} helper={`Average ${formatMoney(averageSale, activeBusiness.currency)}`} />
          <ReportMetricCell icon={Boxes} label="Discounts" value={loading ? "..." : formatMoney(discountTotal, activeBusiness.currency)} />
          <ReportMetricCell icon={BarChart3} label="Tax collected" value={loading ? "..." : formatMoney(taxCollected, activeBusiness.currency)} helper={`${voidedCount} voided receipts excluded`} />
        </div>
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-md border border-zera-line bg-white p-3 shadow-xs">
        <div className="grid gap-3 xl:grid-cols-[auto_1fr_auto] xl:items-end">
          <div className="flex rounded-md border border-zera-line bg-zera-mintSoft p-1">
            {periodOptions.map((period) => (
              <button
                key={period.value}
                type="button"
                className={`h-9 rounded-[6px] px-3 text-sm font-bold transition ${
                  activePeriod === period.value
                    ? "bg-white text-zera-green shadow-xs"
                    : "text-zera-muted hover:bg-white/70 hover:text-zera-ink"
                }`}
                onClick={() => applyPeriod(period.value)}
              >
                {period.label}
              </button>
            ))}
            {activePeriod === "custom" ? <span className="inline-flex h-9 items-center rounded-[6px] bg-white px-3 text-sm font-bold text-zera-muted shadow-xs">Custom</span> : null}
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-zera-muted">Branch</span>
              <select
                className="h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
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
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-zera-muted">Payment</span>
              <select
                className="h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                value={filters.paymentMethod}
                onChange={(event) => updateFilter("paymentMethod", event.target.value)}
              >
                <option value="">All payments</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE_MONEY">Mobile money</option>
              </select>
            </label>
            <FilterInput label="From" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
            <FilterInput label="To" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
          </div>

          <Button type="button" variant="ghost" className="h-10 px-3" onClick={resetFilters}>
            Reset
          </Button>
        </div>

      </section>

      <section className="rounded-md border border-zera-line bg-white p-5">
        <h3 className="font-bold">Period summary</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-sm text-zera-muted">Net sales, excluding tax</p><p className="text-xl font-bold">{loading ? '…' : formatMoney(reportSummary.netSales ?? totalSales - taxCollected, activeBusiness.currency)}</p></div>
          <div><p className="text-sm text-zera-muted">Items sold</p><p className="text-xl font-bold">{loading ? '…' : itemCount}</p></div>
          {report?.expenses && <><div><p className="text-sm text-zera-muted">Approved expenses</p><p className="text-xl font-bold">{loading ? '…' : formatMoney(report.expenses.APPROVED.amount, activeBusiness.currency)}</p></div><div><p className="text-sm text-zera-muted">Pending expenses</p><p className="text-xl font-bold">{loading ? '…' : formatMoney(report.expenses.PENDING.amount, activeBusiness.currency)}</p><p className="text-xs text-zera-muted">{report.expenses.PENDING.count} awaiting approval</p></div></>}
        </div>
        {report?.expenses && <p className="mt-4 text-xs text-zera-muted">Expenses use the selected dates and branch, across all payment methods. Product costs are not deducted from net sales.</p>}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <SalesTable currency={activeBusiness.currency} loading={loading} rows={completedSales} />
          <StaffPerformanceTable currency={activeBusiness.currency} rows={staffRows} />
        </div>

        <aside className="space-y-4">
          <CompactPanel title="Payment mix" rows={paymentRows} currency={activeBusiness.currency} iconMap={paymentIcons} unitLabel="receipt" />
          <CompactPanel title="Branch sales" rows={branchRows} currency={activeBusiness.currency} fallbackIcon={MapPin} unitLabel="receipt" />
          <CompactPanel title="Top products" rows={productRows} currency={activeBusiness.currency} fallbackIcon={Boxes} unitLabel="item" />
        </aside>
      </section>
    </div>
  );
}

function SalesTable({ currency, loading, rows }) {
  const pagination = usePagination(rows);
  return (
    <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-zera-line p-4">
        <div>
          <h3 className="font-bold">Recent receipts</h3>

        </div>
        <span className="rounded-md bg-zera-mintSoft px-2.5 py-1 text-xs font-bold text-zera-muted">{rows.length} receipts</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zera-line bg-zera-mintSoft text-xs uppercase text-zera-muted">
              <th className="px-4 py-3 font-bold">Receipt</th>
              <th className="px-4 py-3 font-bold">Branch</th>
              <th className="px-4 py-3 font-bold">Customer</th>
              <th className="px-4 py-3 font-bold">Payment</th>
              <th className="px-4 py-3 font-bold">Cashier</th>
              <th className="px-4 py-3 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length ? (
              pagination.rows.map((sale) => (
                <tr className="border-b border-zera-line last:border-0 hover:bg-zera-mintSoft/70" key={sale.id}>
                  <td className="px-4 py-3 font-bold text-zera-ink">{sale.receiptNumber}</td>
                  <td className="px-4 py-3 text-zera-muted">{sale.branch?.name || "Branch"}</td>
                  <td className="px-4 py-3 text-zera-muted">{sale.customer?.name || "Walk-in"}</td>
                  <td className="px-4 py-3 text-zera-muted">{formatPayment(sale.paymentMethod)}</td>
                  <td className="px-4 py-3 text-zera-muted">{sale.cashier?.name || "Cashier"}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMoney(sale.total, currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zera-muted" colSpan="6">
                  {loading ? "Loading sales..." : "No receipts for this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} loading={loading} />
    </section>
  );
}

function StaffPerformanceTable({ currency, rows }) {
  return (
    <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
      <div className="border-b border-zera-line p-4">
        <h3 className="font-bold">Staff performance</h3>

      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[680px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zera-line bg-zera-mintSoft text-xs uppercase text-zera-muted">
              <th className="px-4 py-3 font-bold">Staff</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">Activity</th>
              <th className="px-4 py-3 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr className="border-b border-zera-line last:border-0 hover:bg-zera-mintSoft/70" key={row.key}>
                  <td className="px-4 py-3 font-bold text-zera-ink">{row.label}</td>
                  <td className="px-4 py-3 text-zera-muted">{row.role}</td>
                  <td className="px-4 py-3 text-zera-muted">
                    {row.quantity} {row.unitLabel}
                    {row.quantity === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-zera-ink">{formatMoney(row.total, currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-zera-muted" colSpan="4">
                  No staff activity for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompactPanel({ currency, fallbackIcon: FallbackIcon = BarChart3, iconMap = {}, rows, title, unitLabel = "item" }) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <section className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? <div className="rounded-md border border-dashed border-zera-line p-4 text-sm text-zera-muted">No sales data for this filter.</div> : null}
        {rows.map((row) => {
          const Icon = iconMap[row.key] || FallbackIcon;
          const width = `${Math.max((row.total / maxTotal) * 100, 8)}%`;

          return (
            <article key={row.key} className="rounded-md bg-zera-mintSoft p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-zera-green">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{row.label}</p>
                    <p className="mt-0.5 text-xs text-zera-muted">
                      {row.quantity} {unitLabel}
                      {row.quantity === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-right text-sm font-bold">{formatMoney(row.total, currency)}</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white">
                <div className="h-1.5 rounded-full bg-zera-green" style={{ width }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReportMetricCell({ helper, icon: Icon, label, value }) {
  return (
    <article className="bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
          <p className="mt-1 break-words text-lg font-bold text-zera-ink">{value}</p>
          {helper ? <p className="mt-0.5 text-xs text-zera-muted">{helper}</p> : null}
        </div>
      </div>
    </article>
  );
}

function ReportNote({ label, value }) {
  return (
    <div className="min-w-0 rounded-md bg-zera-mintSoft px-3 py-2">
      <p className="text-[11px] font-bold uppercase text-zera-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-zera-ink">{value}</p>
    </div>
  );
}

function FilterInput({ label, onChange, value }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-zera-muted">{label}</span>
      <input
        className="h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Note({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-zera-mintSoft px-3 py-2 text-sm">
      <span className="font-semibold text-zera-muted">{label}</span>
      <span className="font-bold text-zera-ink">{value}</span>
    </div>
  );
}

function buildPaymentRows(sales) {
  return Object.values(
    sales.reduce((rows, sale) => {
      const key = sale.paymentMethod;
      const current = rows[key] || { key, label: formatPayment(key), quantity: 0, total: 0 };
      rows[key] = {
        ...current,
        quantity: current.quantity + 1,
        total: current.total + Number(sale.total)
      };
      return rows;
    }, {})
  ).sort((a, b) => b.total - a.total);
}

function buildBranchRows(sales) {
  return Object.values(
    sales.reduce((rows, sale) => {
      const key = sale.branch?.id || "unknown";
      const current = rows[key] || { key, label: sale.branch?.name || "Unknown branch", quantity: 0, total: 0 };
      rows[key] = {
        ...current,
        quantity: current.quantity + 1,
        total: current.total + Number(sale.total)
      };
      return rows;
    }, {})
  ).sort((a, b) => b.total - a.total);
}

function buildProductRows(sales) {
  return Object.values(
    sales.reduce((rows, sale) => {
      sale.items?.forEach((item) => {
        const key = item.product?.id || item.id;
        const current = rows[key] || { key, label: item.product?.name || "Product", quantity: 0, total: 0 };
        rows[key] = {
          ...current,
          quantity: current.quantity + item.quantity,
          total: current.total + Number(item.lineTotal)
        };
      });
      return rows;
    }, {})
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

function buildWaiterRows(sales) {
  return Object.values(
    sales.reduce((rows, sale) => {
      const waiter = sale.posOrder?.waiter;
      if (!waiter) return rows;
      const key = waiter?.id || "no-waiter";
      const current = rows[key] || { key, label: waiter?.name || "Counter sale", quantity: 0, total: 0 };
      rows[key] = {
        ...current,
        quantity: current.quantity + 1,
        total: current.total + Number(sale.total)
      };
      return rows;
    }, {})
  ).sort((a, b) => b.total - a.total);
}

function buildCashierRows(sales) {
  return Object.values(
    sales.reduce((rows, sale) => {
      const key = sale.cashier?.id || "unknown-cashier";
      const current = rows[key] || { key, label: sale.cashier?.name || "Unknown cashier", quantity: 0, total: 0 };
      rows[key] = {
        ...current,
        quantity: current.quantity + 1,
        total: current.total + Number(sale.total)
      };
      return rows;
    }, {})
  ).sort((a, b) => b.total - a.total);
}

function buildStaffPerformanceRows(waiterRows, cashierRows) {
  return [
    ...waiterRows.map((row) => ({
      ...row,
      key: `waiter-${row.key}`,
      role: "Waiter",
      unitLabel: "bill"
    })),
    ...cashierRows.map((row) => ({
      ...row,
      key: `cashier-${row.key}`,
      role: "Cashier",
      unitLabel: "receipt"
    }))
  ].sort((first, second) => second.total - first.total);
}

const paymentIcons = {
  CASH: Banknote,
  CARD: CreditCard,
  MOBILE_MONEY: Smartphone
};

function countItems(sales) {
  return sales.reduce((total, sale) => total + (sale.items?.reduce((itemTotal, item) => itemTotal + item.quantity, 0) || 0), 0);
}

function createDefaultFilters() {
  return {
    branchId: "",
    paymentMethod: "",
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

function formatPayment(method = "") {
  return method
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatDateLabel(value) {
  if (!value) {
    return "Any date";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
