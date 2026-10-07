import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, CheckCircle2, CreditCard, FileText, Plus, ReceiptText, RefreshCcw, Search, Smartphone, TrendingUp, X, XCircle } from "lucide-react";
import Button from "../../components/Button.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createFinanceExpense, getFinanceSummary, updateFinanceExpenseStatus } from "../../services/financeService.js";

const periodOptions = [
  { label: "Today", value: "today" },
  { label: "Weekly", value: "week" },
  { label: "Monthly", value: "month" }
];

const paymentIcons = {
  CASH: Banknote,
  CARD: CreditCard,
  MOBILE_MONEY: Smartphone
};

export default function FinancePage() {
  const { activeBusiness, activeBusinessId, branches } = useWorkspace();
  const [financeData, setFinanceData] = useState(null);
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [expenseForm, setExpenseForm] = useState(() => createDefaultExpenseForm());
  const [activePeriod, setActivePeriod] = useState("today");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState("ALL");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseStatusSavingId, setExpenseStatusSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!activeBusinessId) {
      setFinanceData(null);
      return;
    }

    loadFinance();
  }, [activeBusinessId, filters]);

  async function loadFinance() {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const data = await getFinanceSummary(activeBusinessId, params);
      setFinanceData(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load finance collections.");
    } finally {
      setLoading(false);
    }
  }

  function applyPeriod(period) {
    setActivePeriod(period);
    setFilters((current) => ({ ...current, ...getPeriodRange(period) }));
  }

  function updateFilter(key, value) {
    setActivePeriod("custom");
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setActivePeriod("today");
    setFilters(createDefaultFilters());
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();

    const branchId = expenseForm.branchId || filters.branchId || branches.find((branch) => branch.status === "ACTIVE")?.id || branches[0]?.id || "";

    try {
      setExpenseSaving(true);
      setError("");
      setMessage("");
      await createFinanceExpense(activeBusinessId, {
        ...expenseForm,
        branchId
      });
      setExpenseForm(createDefaultExpenseForm());
      await loadFinance();
      setMessage("Expense recorded for review.");
      setExpenseModalOpen(false);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to record expense.");
    } finally {
      setExpenseSaving(false);
    }
  }

  async function handleExpenseStatusChange(expense, status) {
    try {
      setExpenseStatusSavingId(expense.id);
      setError("");
      setMessage("");
      const updatedExpense = await updateFinanceExpenseStatus(activeBusinessId, expense.id, status);
      setFinanceData((current) =>
        current
          ? {
              ...current,
              recentExpenses: (current.recentExpenses || []).map((item) => (item.id === updatedExpense.id ? updatedExpense : item))
            }
          : current
      );
      await loadFinance();
      setMessage(`${updatedExpense.title} marked ${formatExpenseStatus(updatedExpense.status).toLowerCase()}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update expense status.");
    } finally {
      setExpenseStatusSavingId("");
    }
  }

  const summary = financeData?.summary || {
    averageReceipt: 0,
    approvedExpenseTotal: 0,
    collectedTotal: 0,
    netCash: 0,
    pendingExpenseCount: 0,
    receiptCount: 0,
    taxCollected: 0,
    voidedCount: 0
  };
  const paymentRows = useMemo(() => withPercent(financeData?.paymentRows || [], summary.collectedTotal), [financeData?.paymentRows, summary.collectedTotal]);
  const branchRows = useMemo(() => withPercent(financeData?.branchRows || [], summary.collectedTotal), [financeData?.branchRows, summary.collectedTotal]);
  const receiptRows = (financeData?.recentReceipts || []).filter((sale) => {
    const normalizedSearch = receiptSearch.trim().toLowerCase();
    return (
      !normalizedSearch ||
      [sale.receiptNumber, sale.customer?.name, sale.branch?.name, sale.cashier?.name, sale.paymentMethod]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );
  });
  const expenseRows = (financeData?.recentExpenses || []).filter((expense) => {
    const normalizedSearch = expenseSearch.trim().toLowerCase();
    const matchesStatus = expenseStatusFilter === "ALL" || expense.status === expenseStatusFilter;
    const matchesSearch =
      !normalizedSearch ||
      [expense.title, expense.category, expense.branch?.name, expense.recordedBy?.name, expense.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));

    return matchesStatus && matchesSearch;
  });

  if (!activeBusiness) {
    return (
      <section className="rounded-md border border-zera-line bg-white p-5 shadow-xs">
        <h2 className="text-xl font-bold">Finance</h2>
        <p className="mt-2 text-sm text-zera-muted">Select a business before reviewing collections.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="grid gap-3 border-b border-zera-line px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">

              <span className="h-1 w-1 rounded-full bg-zera-line" />
              <p className="text-xs font-semibold text-zera-muted">{activeBusiness.name}</p>
            </div>
            <h2 className="mt-0.5 text-xl font-bold text-zera-ink">Finance control</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/sales"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink shadow-xs transition hover:bg-zera-mintSoft"
            >
              <ReceiptText size={16} />
              Receipts
            </Link>
            <Button type="button" variant="secondary" className="h-9 gap-2 px-3" disabled={loading} onClick={loadFinance}>
              <RefreshCcw size={16} />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button type="button" className="h-9 gap-2 px-3" onClick={() => setExpenseModalOpen(true)}>
              <Plus size={16} />
              Expense
            </Button>
          </div>
        </div>

        <FinanceToolbar
          activePeriod={activePeriod}
          branches={branches}
          filters={filters}
          onFilterChange={updateFilter}
          onPeriodChange={applyPeriod}
          onReset={resetFilters}
        />

        <section className="grid divide-y divide-zera-line md:grid-cols-4 md:divide-x md:divide-y-0">
          <Metric icon={Banknote} label="Collected" loading={loading} value={formatMoney(summary.collectedTotal, activeBusiness.currency)} />
          <Metric icon={FileText} label="Approved expenses" loading={loading} value={formatMoney(summary.approvedExpenseTotal, activeBusiness.currency)} />
          <Metric icon={TrendingUp} label="Net cash" loading={loading} value={formatMoney(summary.netCash, activeBusiness.currency)} />
          <Metric icon={ReceiptText} label="Pending review" loading={loading} value={summary.pendingExpenseCount} />
        </section>
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_390px]">
        <article className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
          <PanelHeader
            eyebrow="Daily reconciliation"
            title="Payment channels"
            description={`${summary.voidedCount} voided receipt${summary.voidedCount === 1 ? "" : "s"} excluded from totals.`}
          />
          <DataTable
            columns={["Payment", "Receipts", "Share", "Collected"]}
            empty="No completed receipts for this filter."
            rows={paymentRows}
            renderRow={(row) => {
              const Icon = paymentIcons[row.key] || Banknote;
              return (
                <tr className="border-b border-zera-line last:border-0" key={row.key}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
                        <Icon size={16} />
                      </span>
                      <span className="font-bold capitalize text-zera-ink">{row.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zera-muted">{row.count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-24 rounded-full bg-zera-surface">
                        <span className="block h-2 rounded-full bg-zera-green" style={{ width: `${row.percent}%` }} />
                      </span>
                      <span className="text-sm font-semibold text-zera-muted">{row.percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-base font-extrabold text-zera-ink">{formatMoney(row.total, activeBusiness.currency)}</td>
                </tr>
              );
            }}
          />
        </article>

        <aside className="space-y-3">
          <FinanceSnapshot activeBusiness={activeBusiness} loading={loading} summary={summary} />

          <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
            <PanelHeader eyebrow="Branches" title="Collection split"  />
            <div className="divide-y divide-zera-line">
              {branchRows.length ? (
                branchRows.map((row) => (
                  <div className="px-4 py-3" key={row.key}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{row.label}</p>
                        <p className="mt-0.5 text-xs text-zera-muted">{row.count} receipt{row.count === 1 ? "" : "s"}</p>
                      </div>
                      <p className="shrink-0 font-bold">{formatMoney(row.total, activeBusiness.currency)}</p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-zera-surface">
                      <div className="h-1.5 rounded-full bg-zera-green" style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-4 py-8 text-sm text-zera-muted">No branch collections yet.</p>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-zera-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">Expenses</p>
            <h3 className="mt-0.5 text-base font-bold text-zera-ink">Expense review</h3>
            <p className="mt-0.5 text-sm text-zera-muted">{expenseRows.length} expense{expenseRows.length === 1 ? "" : "s"} in this view</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchField placeholder="Search expense, category, branch" value={expenseSearch} onChange={setExpenseSearch} />
            <StatusFilter activeValue={expenseStatusFilter} onChange={setExpenseStatusFilter} />
          </div>
        </div>
        <DataTable
          columns={["Expense", "Branch", "Recorded by", "Status", "Amount", "Actions"]}
          empty="No expenses recorded for this period."
          minWidth="980px"
          rows={expenseRows}
          renderRow={(expense) => (
            <tr className="border-b border-zera-line last:border-0" key={expense.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-zera-ink">{expense.title}</p>
                <p className="mt-0.5 text-xs text-zera-muted">{expense.category}</p>
              </td>
              <td className="px-4 py-3 text-zera-muted">{expense.branch?.name || "Branch"}</td>
              <td className="px-4 py-3 text-zera-muted">{expense.recordedBy?.name || "User"}</td>
              <td className="px-4 py-3">
                <ExpenseStatusBadge status={expense.status} />
              </td>
              <td className="px-4 py-3 text-right text-base font-extrabold text-zera-ink">{formatMoney(expense.amount, activeBusiness.currency)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <ExpenseAction
                    icon={CheckCircle2}
                    label="Approve"
                    disabled={expense.status === "APPROVED" || expenseStatusSavingId === expense.id}
                    onClick={() => handleExpenseStatusChange(expense, "APPROVED")}
                  />
                  <ExpenseAction
                    icon={XCircle}
                    label="Reject"
                    danger
                    disabled={expense.status === "REJECTED" || expenseStatusSavingId === expense.id}
                    onClick={() => handleExpenseStatusChange(expense, "REJECTED")}
                  />
                </div>
              </td>
            </tr>
          )}
        />
      </section>

      <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-zera-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">Receipts</p>
            <h3 className="mt-0.5 text-base font-bold text-zera-ink">Latest collections</h3>

          </div>
          <SearchField placeholder="Search receipt, customer, cashier" value={receiptSearch} onChange={setReceiptSearch} />
        </div>
        <DataTable
          columns={["Receipt", "Customer", "Branch", "Payment", "Time", "Total"]}
          empty="No receipts to show."
          minWidth="980px"
          rows={receiptRows}
          renderRow={(sale) => (
            <tr className="cursor-pointer border-b border-zera-line transition last:border-0 hover:bg-zera-mintSoft" key={sale.id} onClick={() => setSelectedReceipt(sale)}>
              <td className="px-4 py-3 font-bold text-zera-ink">{sale.receiptNumber}</td>
              <td className="px-4 py-3 text-zera-muted">{sale.customer?.name || "Walk-in"}</td>
              <td className="px-4 py-3 text-zera-muted">{sale.branch?.name || "Not set"}</td>
              <td className="px-4 py-3 text-zera-muted">{formatPayment(sale.paymentMethod)}</td>
              <td className="px-4 py-3 text-zera-muted">{formatDate(sale.createdAt)}</td>
              <td className="px-4 py-3 text-right text-base font-extrabold text-zera-ink">{formatMoney(sale.total, activeBusiness.currency)}</td>
            </tr>
          )}
        />
      </section>

      {expenseModalOpen ? (
        <ExpenseModal
          branches={branches}
          form={expenseForm}
          onChange={setExpenseForm}
          onClose={() => setExpenseModalOpen(false)}
          onSubmit={handleExpenseSubmit}
          saving={expenseSaving}
        />
      ) : null}

      {selectedReceipt ? (
        <ReceiptDetailModal
          currency={activeBusiness.currency}
          onClose={() => setSelectedReceipt(null)}
          sale={selectedReceipt}
        />
      ) : null}
    </div>
  );
}

function FinanceToolbar({ activePeriod, branches, filters, onFilterChange, onPeriodChange, onReset }) {
  return (
    <div className="overflow-x-auto border-b border-zera-line px-3 py-2">
      <div className="flex min-w-max flex-nowrap items-center gap-2">
        <div className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-zera-line bg-zera-surface p-1">
          {periodOptions.map((period) => (
            <button
              className={`h-7 min-w-[66px] rounded px-2 text-sm font-bold transition ${
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
        <CompactSelect className="w-[142px]" label="Branch" value={filters.branchId} onChange={(value) => onFilterChange("branchId", value)}>
          <option value="">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </CompactSelect>
        <CompactInput className="w-[136px]" label="From" value={filters.dateFrom} onChange={(value) => onFilterChange("dateFrom", value)} />
        <CompactInput className="w-[136px]" label="To" value={filters.dateTo} onChange={(value) => onFilterChange("dateTo", value)} />
        <CompactSelect className="w-[138px]" label="Payment" value={filters.paymentMethod} onChange={(value) => onFilterChange("paymentMethod", value)}>
          <option value="">All payments</option>
          <option value="CASH">Cash</option>
          <option value="MOBILE_MONEY">Mobile money</option>
          <option value="CARD">Card</option>
        </CompactSelect>
        <button className="h-9 w-[64px] shrink-0 rounded-md border border-zera-line bg-white px-2 text-sm font-bold text-zera-muted hover:bg-zera-surface hover:text-zera-ink" type="button" onClick={onReset}>
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

function CompactInput({ className = "", label, onChange, value }) {
  return (
    <label className={`min-w-[136px] shrink-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <input
        className="h-9 w-full rounded-md border border-zera-line bg-white px-2.5 text-sm font-semibold tabular-nums text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({ icon: Icon, label, loading, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-white px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mintSoft text-zera-green">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
        <p className="mt-0.5 truncate text-lg font-extrabold text-zera-ink">{loading ? "..." : value}</p>
      </div>
    </div>
  );
}

function FinanceSnapshot({ activeBusiness, loading, summary }) {
  const rows = [
    { label: "Completed receipts", value: summary.receiptCount },
    { label: activeBusiness.taxEnabled ? `${activeBusiness.taxName || "Tax"} collected` : "Tax", value: activeBusiness.taxEnabled ? formatMoney(summary.taxCollected, activeBusiness.currency) : "Off" },
    { label: "Average receipt", value: formatMoney(summary.averageReceipt, activeBusiness.currency) },
    { label: "Voided receipts", value: summary.voidedCount }
  ];

  return (
    <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
      <div className="border-b border-zera-line px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">Reconciliation</p>
        <h3 className="mt-0.5 text-base font-bold text-zera-ink">Finance checks</h3>
      </div>
      <div className="divide-y divide-zera-line">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-3 px-4 py-3" key={row.label}>
            <span className="text-sm font-semibold text-zera-muted">{row.label}</span>
            <span className="text-right text-sm font-extrabold text-zera-ink">{loading ? "..." : row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelHeader({ description, eyebrow, title }) {
  return (
    <div className="border-b border-zera-line px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zera-green">{eyebrow}</p>
      <h3 className="mt-0.5 text-base font-bold text-zera-ink">{title}</h3>
      {description ? <p className="mt-0.5 text-sm text-zera-muted">{description}</p> : null}
    </div>
  );
}

function SearchField({ onChange, placeholder, value }) {
  return (
    <label className="flex h-9 w-full items-center gap-2 rounded-md border border-zera-line bg-white px-2.5 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10 sm:w-[290px]">
      <Search size={15} className="shrink-0 text-zera-muted" />
      <input
        className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-zera-muted/60"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function StatusFilter({ activeValue, onChange }) {
  const options = [
    ["ALL", "All"],
    ["PENDING", "Pending"],
    ["APPROVED", "Approved"],
    ["REJECTED", "Rejected"]
  ];

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-zera-line bg-zera-surface p-1">
      {options.map(([value, label]) => (
        <button
          className={`h-7 whitespace-nowrap rounded px-2 text-xs font-bold transition ${
            activeValue === value ? "bg-white text-zera-green shadow-xs" : "text-zera-muted hover:bg-white hover:text-zera-ink"
          }`}
          key={value}
          type="button"
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DataTable({ columns, empty, minWidth = "760px", renderRow, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        <thead className="border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
          <tr>
            {columns.map((column, index) => (
              <th className={`px-4 py-2.5 ${index === columns.length - 1 ? "text-right" : ""}`} key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => renderRow(row))
          ) : (
            <tr>
              <td className="px-4 py-8 text-sm text-zera-muted" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ExpenseModal({ branches, form, onChange, onClose, onSubmit, saving }) {
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
      <section className="w-full max-w-xl overflow-hidden rounded-lg border border-zera-line bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-zera-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Money out</p>
            <h3 className="mt-1 text-xl font-bold text-zera-ink">Record expense</h3>

          </div>
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zera-line bg-white text-zera-muted transition hover:bg-zera-surface hover:text-zera-ink"
            type="button"
            onClick={onClose}
            aria-label="Close expense form"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-5">
          <ExpenseForm branches={branches} form={form} onChange={onChange} onSubmit={onSubmit} saving={saving} />
        </div>
      </section>
    </div>
  );
}

function ReceiptDetailModal({ currency, onClose, sale }) {
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
      <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zera-line bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-zera-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Receipt detail</p>
            <h3 className="mt-1 truncate text-xl font-bold text-zera-ink">{sale.receiptNumber}</h3>
            <p className="mt-1 text-sm text-zera-muted">
              {sale.branch?.name || "Branch"} - {formatDate(sale.createdAt)}
            </p>
          </div>
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zera-line bg-white text-zera-muted transition hover:bg-zera-surface hover:text-zera-ink"
            type="button"
            onClick={onClose}
            aria-label="Close receipt detail"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-5">
          <div className="grid gap-2 sm:grid-cols-4">
            <ReceiptFact label="Customer" value={sale.customer?.name || "Walk-in"} />
            <ReceiptFact label="Payment" value={formatPayment(sale.paymentMethod)} />
            <ReceiptFact label="Cashier" value={sale.cashier?.name || sale.posOrder?.waiter?.name || "User"} />
            <ReceiptFact label="Total" value={formatMoney(sale.total, currency)} strong />
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-zera-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
                <tr>
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zera-line">
                {(sale.items || []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-zera-ink">{item.product?.name || "Item"}</p>
                      <p className="mt-0.5 text-xs text-zera-muted">{item.product?.category || item.product?.type || ""}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-zera-muted">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-zera-muted">{formatMoney(item.unitPrice, currency)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-zera-ink">{formatMoney(item.lineTotal, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 ml-auto max-w-sm rounded-md border border-zera-line bg-white">
            <MoneyLine label="Subtotal" value={sale.subtotal} currency={currency} />
            <MoneyLine label="Discount" value={sale.discountAmount} currency={currency} />
            <MoneyLine label="Tax" value={sale.taxAmount} currency={currency} />
            <MoneyLine label="Total" value={sale.total} currency={currency} strong />
          </div>
        </div>
      </section>
    </div>
  );
}

function ReceiptFact({ label, strong = false, value }) {
  return (
    <div className="min-w-0 rounded-md border border-zera-line bg-white px-3 py-2.5">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? "font-extrabold text-zera-ink" : "font-bold text-zera-ink"}`}>{value}</p>
    </div>
  );
}

function MoneyLine({ currency, label, strong = false, value }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-zera-line px-3 py-2.5 last:border-b-0 ${strong ? "bg-zera-mintSoft" : ""}`}>
      <span className="text-sm font-semibold text-zera-muted">{label}</span>
      <span className={`text-right ${strong ? "text-base font-extrabold text-zera-ink" : "text-sm font-bold text-zera-ink"}`}>{formatMoney(value, currency)}</span>
    </div>
  );
}

function ExpenseForm({ branches, form, onChange, onSubmit, saving }) {
  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-2">
        <FinanceInput label="Title" value={form.title} onChange={(value) => onChange({ ...form, title: value })} placeholder="Delivery fuel" required />
        <div className="grid gap-2 sm:grid-cols-2">
          <FinanceInput label="Amount" value={form.amount} onChange={(value) => onChange({ ...form, amount: value })} placeholder="0" type="number" required />
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase text-zera-muted">Branch</span>
            <select
              className="h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
              value={form.branchId}
              onChange={(event) => onChange({ ...form, branchId: event.target.value })}
            >
              <option value="">Current branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FinanceInput label="Category" value={form.category} onChange={(value) => onChange({ ...form, category: value })} placeholder="General" />
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-zera-muted">Note</span>
          <textarea
            className="min-h-20 w-full rounded-md border border-zera-line bg-white px-3 py-2 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
            value={form.note}
            onChange={(event) => onChange({ ...form, note: event.target.value })}
            placeholder="Optional details"
          />
        </label>
      </div>

      <Button className="mt-3 w-full gap-2" disabled={saving}>
        <Plus size={16} />
        {saving ? "Recording..." : "Record expense"}
      </Button>
    </form>
  );
}

function FinanceInput({ label, onChange, placeholder, required = false, type = "text", value }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-zera-muted">{label}</span>
      <input
        className="h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        min={type === "number" ? "0" : undefined}
        placeholder={placeholder}
        required={required}
        step={type === "number" ? "0.01" : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ExpenseStatusBadge({ status }) {
  const styles = {
    APPROVED: "bg-zera-mintSoft text-zera-green",
    PENDING: "bg-amber-50 text-amber-700",
    REJECTED: "bg-red-50 text-red-700"
  };

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${styles[status] || styles.PENDING}`}>{formatExpenseStatus(status)}</span>;
}

function ExpenseAction({ danger = false, disabled, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        danger
          ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
          : "border-zera-line bg-white text-zera-green hover:bg-zera-mintSoft"
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function withPercent(rows, total) {
  return rows.map((row) => ({
    ...row,
    percent: total ? Math.max(4, Math.round((Number(row.total || 0) / total) * 100)) : 0
  }));
}

function createDefaultFilters() {
  return {
    branchId: "",
    dateFrom: toDateInput(new Date()),
    dateTo: toDateInput(new Date()),
    paymentMethod: ""
  };
}

function createDefaultExpenseForm() {
  return {
    amount: "",
    branchId: "",
    category: "General",
    note: "",
    title: ""
  };
}

function getPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  }

  if (period === "month") {
    start.setDate(1);
  }

  return {
    dateFrom: toDateInput(start),
    dateTo: toDateInput(end)
  };
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatPayment(method = "") {
  return method ? method.replace("_", " ").toLowerCase() : "not set";
}

function formatExpenseStatus(status = "PENDING") {
  return status
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
