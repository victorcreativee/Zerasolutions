import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock3, CreditCard, Printer, ReceiptText, RefreshCcw, Smartphone, Table2, UserRound } from "lucide-react";
import Button from "../../components/Button.jsx";
import PrintableBill from "../../components/PrintableBill.jsx";
import PrintableReceipt from "../../components/PrintableReceipt.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getActivePOSOrders, markPOSOrderBillPrinted, payPOSOrder } from "../../services/posService.js";

const queueFilters = [
  { label: "All", value: "ALL" },
  { label: "Ready to pay", value: "READY" },
  { label: "Needs bill", value: "NEEDS_BILL" }
];

export default function OpenBillsPage() {
  const { activeBranch, activeBranchId, activeBusiness, activeBusinessId } = useWorkspace();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [billFilter, setBillFilter] = useState("ALL");
  const [billToPrint, setBillToPrint] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const billStats = useMemo(() => buildBillQueueStats(orders), [orders]);
  const sortedOrders = useMemo(() => sortBillsForCashier(orders), [orders]);
  const visibleOrders = useMemo(() => filterBillsForCashier(sortedOrders, billFilter), [billFilter, sortedOrders]);
  const selectedOrder = visibleOrders.find((order) => order.id === selectedOrderId) || visibleOrders[0] || null;
  const totalDue = orders.reduce((total, order) => total + Number(order.total), 0);
  const selectedItemsTotal = useMemo(
    () => selectedOrder?.items?.reduce((total, item) => total + Number(item.lineTotal), 0) || Number(selectedOrder?.total || 0),
    [selectedOrder]
  );
  const waiterQueue = useMemo(() => buildWaiterQueue(orders), [orders]);

  useEffect(() => {
    if (!activeBusinessId || !activeBranchId || activeBusiness?.posMode !== "TABLE_SERVICE") {
      setOrders([]);
      setSelectedOrderId("");
      return;
    }

    loadOpenBills();
  }, [activeBranchId, activeBusiness?.posMode, activeBusinessId]);

  async function loadOpenBills() {
    try {
      setLoading(true);
      setError("");
      const data = await getActivePOSOrders(activeBusinessId, activeBranchId);
      setOrders(data);
      const sortedData = sortBillsForCashier(data);
      setSelectedOrderId((current) => (sortedData.some((order) => order.id === current) ? current : sortedData[0]?.id || ""));
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load open bills.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePrintBill(order = selectedOrder) {
    if (!order) {
      return;
    }

    try {
      setPrintingBill(true);
      setError("");
      const updatedOrder = await markPOSOrderBillPrinted(order.id);
      setOrders((current) => current.map((item) => (item.id === updatedOrder.id ? updatedOrder : item)));
      setBillToPrint(updatedOrder);
      window.setTimeout(() => {
        window.print();
        setBillToPrint(null);
      }, 180);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to print customer bill.");
    } finally {
      setPrintingBill(false);
    }
  }

  async function handleReceivePayment() {
    if (!selectedOrder) {
      return;
    }

    try {
      setSavingPayment(true);
      setError("");
      setMessage("");
      const sale = await payPOSOrder(selectedOrder.id, { paymentMethod });
      setLastSale(sale);
      setOrders((current) => current.filter((order) => order.id !== selectedOrder.id));
      setSelectedOrderId((current) => (current === selectedOrder.id ? "" : current));
      setMessage(`${sale.receiptNumber} paid. ${selectedOrder.table?.name || "Table"} is available again.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to receive payment.");
    } finally {
      setSavingPayment(false);
    }
  }

  if (!activeBusiness) {
    return <EmptyState title="No business selected" message="Select a table-service business before reviewing open bills." />;
  }

  if (activeBusiness.posMode !== "TABLE_SERVICE") {
    return <EmptyState title="Open bills are for table service" message="Retail checkout businesses record payment directly from POS." />;
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
        <div className="flex flex-col gap-4 border-b border-zera-line px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Cashier workspace</p>
            <h2 className="mt-1 text-2xl font-bold">Settle table bills</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
              Receive payment, close table bills, free tables, and print final receipts from one cashier queue.
            </p>
          </div>
          <Button type="button" variant="secondary" className="h-10 gap-2 px-3" onClick={loadOpenBills}>
            <RefreshCcw size={16} />
            Refresh
          </Button>
        </div>
        <div className="grid divide-y divide-zera-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <OpenBillsMetric label="Total waiting" value={formatMoney(totalDue, activeBusiness.currency)} />
          <OpenBillsMetric label="Open bills" value={loading ? "..." : orders.length} />
          <OpenBillsMetric label="Ready to pay" value={billStats.ready} />
          <OpenBillsMetric label="Needs bill" value={billStats.needsBill} />
        </div>
      </header>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-zera-line p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <div className="flex min-w-max flex-nowrap items-center gap-2">
                {queueFilters.map((filter) => {
                  const count = getFilterCount(filter.value, billStats);
                  const active = billFilter === filter.value;

                  return (
                    <button
                      key={filter.value}
                      type="button"
                      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold transition ${
                        active ? "border-zera-green bg-zera-mintSoft text-zera-green" : "border-zera-line bg-white text-zera-muted hover:border-zera-green hover:bg-zera-mintSoft hover:text-zera-green"
                      }`}
                      onClick={() => setBillFilter(filter.value)}
                    >
                      {filter.label}
                      <span className={`rounded px-1.5 py-0.5 text-xs ${active ? "bg-white text-zera-green" : "bg-zera-mintSoft text-zera-muted"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-sm text-zera-muted">
              {loading ? "Loading bills..." : `${visibleOrders.length} visible at ${activeBranch?.name || "selected branch"}`}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zera-line bg-zera-mintSoft text-xs uppercase text-zera-muted">
                  <th className="px-4 py-3 font-bold">Table</th>
                  <th className="px-4 py-3 font-bold">Bill</th>
                  <th className="px-4 py-3 font-bold">Waiter</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Updated</th>
                  <th className="px-4 py-3 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {!loading && visibleOrders.length ? (
                  visibleOrders.map((order) => {
                    const isSelected = selectedOrder?.id === order.id;

                    return (
                      <tr
                        key={order.id}
                        className={`cursor-pointer border-b border-zera-line last:border-0 ${isSelected ? "bg-zera-mintSoft" : "hover:bg-zera-mintSoft"}`}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-zera-ink">{order.table?.name || "Table bill"}</p>
                          <p className="mt-0.5 text-xs text-zera-muted">{order.customer?.name || "Walk-in customer"}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zera-muted">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-zera-muted">{order.waiter?.name || "Staff"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-zera-muted">{formatTime(order.updatedAt || order.createdAt)}</td>
                        <td className="px-4 py-3 text-right font-bold text-zera-ink">{formatMoney(order.total, activeBusiness.currency)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-zera-muted" colSpan="6">
                      {loading ? "Loading open bills..." : "No bills in this queue."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
            <div className="border-b border-zera-line p-4">
              <p className="text-xs font-bold uppercase text-zera-green">Settle bill</p>
              <h3 className="mt-1 text-xl font-bold">{selectedOrder?.table?.name || "Select a bill"}</h3>
              {selectedOrder ? <p className="mt-1 text-sm text-zera-muted">{selectedOrder.orderNumber}</p> : null}
            </div>

            {!selectedOrder ? (
              <div className="p-4 text-sm text-zera-muted">Choose a bill from the queue to receive payment.</div>
            ) : (
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-3 gap-2">
                  <InfoChip icon={Table2} label="Table" value={selectedOrder.table?.name || "Not set"} />
                  <InfoChip icon={UserRound} label="Customer" value={selectedOrder.customer?.name || "Walk-in"} />
                  <InfoChip icon={ReceiptText} label="Items" value={selectedOrder.items?.length || 0} />
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border border-zera-line">
                  {selectedOrder.items?.map((item) => (
                    <div className="flex items-start justify-between gap-3 border-b border-zera-line px-3 py-3 last:border-0" key={item.id}>
                      <div>
                        <p className="font-bold">{item.product?.name || "Product"}</p>
                        <p className="mt-0.5 text-sm text-zera-muted">
                          {item.quantity} x {formatMoney(item.unitPrice, activeBusiness.currency)}
                        </p>
                      </div>
                      <p className="font-bold">{formatMoney(item.lineTotal, activeBusiness.currency)}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-md bg-zera-mintSoft p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-bold text-zera-muted">Amount due</span>
                    <span className="text-2xl font-bold">{formatMoney(selectedItemsTotal, activeBusiness.currency)}</span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold">Payment method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      const selected = paymentMethod === method.value;

                      return (
                        <button
                          key={method.value}
                          type="button"
                          className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-bold transition ${
                            selected ? "border-zera-green bg-zera-mintSoft text-zera-green" : "border-zera-line bg-white text-zera-muted hover:bg-zera-mintSoft"
                          }`}
                          onClick={() => setPaymentMethod(method.value)}
                        >
                          <Icon size={15} />
                          {method.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button type="button" variant="secondary" className="h-11 gap-2" disabled={printingBill} onClick={() => handlePrintBill(selectedOrder)}>
                    <Printer size={17} />
                    Print customer bill
                  </Button>
                  <Button type="button" className="h-11 gap-2" disabled={savingPayment} onClick={handleReceivePayment}>
                    <ReceiptText size={17} />
                    {savingPayment ? "Receiving..." : "Receive payment"}
                  </Button>
                </div>
              </div>
            )}
          </section>

          {waiterQueue.length ? <WaiterQueuePanel currency={activeBusiness.currency} waiterQueue={waiterQueue} /> : null}

          {lastSale ? (
            <section className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-zera-green">Last receipt</p>
                  <h3 className="mt-1 font-bold">{lastSale.receiptNumber}</h3>
                  <p className="mt-1 text-sm text-zera-muted">{formatMoney(lastSale.total, activeBusiness.currency)}</p>
                </div>
                <ReceiptText className="text-zera-green" size={22} />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-zera-line bg-zera-mintSoft p-3">
                <PrintableReceipt business={activeBusiness} sale={lastSale} />
              </div>
              <Button type="button" className="no-print mt-3 w-full gap-2" onClick={() => window.print()}>
                <Printer size={17} />
                Print receipt
              </Button>
            </section>
          ) : null}
        </aside>
      </section>

      {billToPrint ? (
        <div className="print-host">
          <PrintableBill business={activeBusiness} order={billToPrint} />
        </div>
      ) : null}
    </div>
  );
}

const paymentMethods = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "MOBILE_MONEY", label: "Mobile", icon: Smartphone },
  { value: "CARD", label: "Card", icon: CreditCard }
];

function EmptyState({ message, title }) {
  return (
    <div className="mx-auto max-w-[1500px] rounded-md border border-zera-line bg-white p-5 shadow-xs">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-zera-muted">{message}</p>
    </div>
  );
}

function OpenBillsMetric({ label, value }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-zera-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-zera-ink">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const ready = status === "BILL_PRINTED";

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${ready ? "bg-zera-mintSoft text-zera-green" : "bg-amber-50 text-amber-700"}`}>{ready ? "Ready to pay" : "Needs bill"}</span>;
}

function InfoChip({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-zera-mintSoft px-3 py-2">
      <Icon className="text-zera-green" size={16} />
      <p className="mt-1 text-[11px] font-bold uppercase text-zera-muted">{label}</p>
      <p className="truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function WaiterQueuePanel({ currency, waiterQueue }) {
  return (
    <section className="overflow-hidden rounded-md border border-zera-line bg-white shadow-xs">
      <div className="border-b border-zera-line p-4">
        <p className="text-xs font-bold uppercase text-zera-green">Waiter queue</p>
        <h3 className="mt-1 font-bold">Open bills by waiter</h3>
      </div>
      <div className="divide-y divide-zera-line">
        {waiterQueue.slice(0, 5).map((waiter) => (
          <div className="flex items-center justify-between gap-3 px-4 py-3" key={waiter.name}>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{waiter.name}</p>
              <p className="mt-0.5 text-xs text-zera-muted">
                {waiter.count} open bill{waiter.count === 1 ? "" : "s"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold">{formatMoney(waiter.total, currency)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function getFilterCount(filter, stats) {
  if (filter === "READY") {
    return stats.ready;
  }

  if (filter === "NEEDS_BILL") {
    return stats.needsBill;
  }

  return stats.all;
}

function sortBillsForCashier(orders) {
  return [...orders].sort((first, second) => {
    const firstPriority = first.status === "BILL_PRINTED" ? 0 : 1;
    const secondPriority = second.status === "BILL_PRINTED" ? 0 : 1;

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority;
    }

    return new Date(second.updatedAt || second.createdAt) - new Date(first.updatedAt || first.createdAt);
  });
}

function buildBillQueueStats(orders) {
  return orders.reduce(
    (stats, order) => {
      stats.all += 1;

      if (order.status === "BILL_PRINTED") {
        stats.ready += 1;
      } else {
        stats.needsBill += 1;
      }

      return stats;
    },
    { all: 0, needsBill: 0, ready: 0 }
  );
}

function buildWaiterQueue(orders) {
  const queue = orders.reduce((summary, order) => {
    const name = order.waiter?.name || "Unassigned staff";
    const current = summary.get(name) || { count: 0, name, total: 0 };

    current.count += 1;
    current.total += Number(order.total || 0);
    summary.set(name, current);

    return summary;
  }, new Map());

  return [...queue.values()].sort((first, second) => second.total - first.total);
}

function filterBillsForCashier(orders, billFilter) {
  if (billFilter === "READY") {
    return orders.filter((order) => order.status === "BILL_PRINTED");
  }

  if (billFilter === "NEEDS_BILL") {
    return orders.filter((order) => order.status !== "BILL_PRINTED");
  }

  return orders;
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatTime(value) {
  if (!value) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
