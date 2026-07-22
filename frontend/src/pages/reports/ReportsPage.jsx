import { useEffect, useMemo, useState } from "react";
import { BarChart3, Banknote, Boxes, CreditCard, MapPin, ReceiptText, Smartphone, UserRound, Users } from "lucide-react";
import Button from "../../components/Button.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getRecentSales } from "../../services/posService.js";

const periodOptions = [
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" }
];

export default function ReportsPage() {
  const { activeBusiness, activeBusinessId, branches } = useWorkspace();
  const [sales, setSales] = useState([]);
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [activePeriod, setActivePeriod] = useState("today");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const completedSales = sales.filter((sale) => sale.status === "COMPLETED");
  const voidedSales = sales.filter((sale) => sale.status === "VOIDED");
  const totalSales = completedSales.reduce((total, sale) => total + Number(sale.total), 0);
  const averageSale = completedSales.length ? totalSales / completedSales.length : 0;
  const paymentRows = useMemo(() => buildPaymentRows(completedSales), [completedSales]);
  const branchRows = useMemo(() => buildBranchRows(completedSales), [completedSales]);
  const productRows = useMemo(() => buildProductRows(completedSales), [completedSales]);
  const waiterRows = useMemo(() => buildWaiterRows(completedSales), [completedSales]);
  const cashierRows = useMemo(() => buildCashierRows(completedSales), [completedSales]);
  const staffRows = useMemo(() => buildStaffPerformanceRows(waiterRows, cashierRows), [cashierRows, waiterRows]);

  useEffect(() => {
    if (!activeBusinessId) {
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
      const data = await getRecentSales(activeBusinessId, params);
      setSales(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load reports.");
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

  function applyPeriod(period) {
    setActivePeriod(period);
    setFilters((current) => ({ ...current, ...getPeriodRange(period) }));
  }

  function resetFilters() {
    setActivePeriod("today");
    setFilters(createDefaultFilters());
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">Reports</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Sales performance</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              Simple POS reporting for owners and managers. Finance, inventory valuation, and tax reporting come later.
            </p>
          </div>
          <div className="flex min-h-14 min-w-14 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
            <BarChart3 size={30} />
          </div>
        </div>
      </section>

      {!activeBusiness ? (
        <section className="rounded-lg border border-zera-line bg-white p-6">
          <h3 className="text-lg font-bold">No business selected</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">Select a business before viewing reports.</p>
        </section>
      ) : (
        <>
          {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <section className="rounded-lg border border-zera-line bg-white p-5">
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

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="block">
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
              <FilterInput label="From" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
              <FilterInput label="To" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
              <div className="flex items-end">
                <Button type="button" variant="ghost" className="w-full px-3" onClick={resetFilters}>
                  Reset today
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <Metric icon={Banknote} label="Net sales" value={loading ? "..." : formatMoney(totalSales, activeBusiness.currency)} compact />
            <Metric icon={ReceiptText} label="Receipts" value={loading ? "..." : completedSales.length} />
            <Metric icon={Boxes} label="Items sold" value={loading ? "..." : countItems(completedSales)} />
            <Metric icon={BarChart3} label="Average sale" value={loading ? "..." : formatMoney(averageSale, activeBusiness.currency)} compact />
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <ReportPanel title="Payment mix" rows={paymentRows} currency={activeBusiness.currency} iconMap={paymentIcons} unitLabel="receipt" />
            <ReportPanel title="Branch sales" rows={branchRows} currency={activeBusiness.currency} fallbackIcon={MapPin} unitLabel="receipt" />
            <ReportPanel title="Top products" rows={productRows} currency={activeBusiness.currency} fallbackIcon={Boxes} unitLabel="item" />
            <ReportPanel title="Waiter service" rows={waiterRows} currency={activeBusiness.currency} fallbackIcon={Users} unitLabel="bill" />
            <ReportPanel title="Cashier collection" rows={cashierRows} currency={activeBusiness.currency} fallbackIcon={UserRound} unitLabel="receipt" />
          </section>

          <StaffPerformanceTable currency={activeBusiness.currency} rows={staffRows} />

          <section className="rounded-lg border border-zera-line bg-white p-5">
            <h3 className="text-lg font-bold">Report notes</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Note label="Voided receipts" value={`${voidedSales.length}`} />
              <Note label="Data source" value="POS sales only" />
              <Note label="Accounting status" value="Not posted to finance" />
            </div>
          </section>
        </>
      )}
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

function ReportPanel({ currency, fallbackIcon: FallbackIcon = BarChart3, iconMap = {}, rows, title, unitLabel = "item" }) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <section className="rounded-lg border border-zera-line bg-white p-5">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">No sales data for this filter.</div>
        ) : null}

        {rows.map((row) => {
          const Icon = iconMap[row.key] || FallbackIcon;
          const width = `${Math.max((row.total / maxTotal) * 100, 8)}%`;

          return (
            <article key={row.key} className="rounded-md bg-[#f7faf8] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-zera-green">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-bold">{row.label}</p>
                    <p className="mt-1 text-xs text-zera-muted">
                      {row.quantity} {unitLabel}
                      {row.quantity === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <p className="font-bold">{formatMoney(row.total, currency)}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div className="h-2 rounded-full bg-zera-green" style={{ width }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StaffPerformanceTable({ currency, rows }) {
  return (
    <section className="rounded-lg border border-zera-line bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">Staff performance</h3>
          <p className="mt-1 text-sm text-zera-muted">Waiter service and cashier collections for the selected period.</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zera-line text-xs uppercase text-zera-muted">
              <th className="py-3 pr-4 font-bold">Staff</th>
              <th className="py-3 pr-4 font-bold">Role</th>
              <th className="py-3 pr-4 font-bold">Activity</th>
              <th className="py-3 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr className="border-b border-zera-line last:border-0" key={row.key}>
                  <td className="py-3 pr-4 font-bold text-zera-ink">{row.label}</td>
                  <td className="py-3 pr-4 text-zera-muted">{row.role}</td>
                  <td className="py-3 pr-4 text-zera-muted">
                    {row.quantity} {row.unitLabel}
                    {row.quantity === 1 ? "" : "s"}
                  </td>
                  <td className="py-3 text-right font-bold text-zera-ink">{formatMoney(row.total, currency)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-6 text-center text-zera-muted" colSpan="4">
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

function FilterInput({ label, onChange, value }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zera-ink">{label}</span>
      <input
        className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Note({ label, value }) {
  return (
    <div className="rounded-md bg-[#f7faf8] px-3 py-3">
      <p className="text-xs font-semibold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function countItems(sales) {
  return sales.reduce((total, sale) => total + (sale.items?.reduce((itemTotal, item) => itemTotal + item.quantity, 0) || 0), 0);
}

function createDefaultFilters() {
  return {
    branchId: "",
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

function formatPayment(method) {
  return method.replace("_", " ").toLowerCase();
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}
