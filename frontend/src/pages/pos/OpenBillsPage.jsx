import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock3, CreditCard, Printer, ReceiptText, RefreshCcw, Smartphone, Table2, UserRound } from "lucide-react";
import Button from "../../components/Button.jsx";
import PrintableBill from "../../components/PrintableBill.jsx";
import PrintableReceipt from "../../components/PrintableReceipt.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { getActivePOSOrders, markPOSOrderBillPrinted, payPOSOrder } from "../../services/posService.js";

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
  const printedBills = orders.filter((order) => order.status === "BILL_PRINTED");
  const freshOrders = orders.filter((order) => order.status === "OPEN");
  const paymentMethods = [
    { value: "CASH", label: "Cash", icon: Banknote },
    { value: "MOBILE_MONEY", label: "Mobile money", icon: Smartphone },
    { value: "CARD", label: "Card", icon: CreditCard }
  ];

  useEffect(() => {
    if (!activeBusinessId || !activeBranchId || activeBusiness?.posMode !== "TABLE_SERVICE") {
      setOrders([]);
      setSelectedOrderId("");
      return;
    }

    loadOpenBills();
  }, [activeBranchId, activeBusiness?.posMode, activeBusinessId]);

  const selectedItemsTotal = useMemo(
    () => selectedOrder?.items?.reduce((total, item) => total + Number(item.lineTotal), 0) || Number(selectedOrder?.total || 0),
    [selectedOrder]
  );

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
    return (
      <div className="mx-auto max-w-7xl rounded-lg border border-zera-line bg-white p-6">
        <h2 className="text-xl font-bold">No business selected</h2>
        <p className="mt-2 text-sm text-zera-muted">Select a table-service business before reviewing open bills.</p>
      </div>
    );
  }

  if (activeBusiness.posMode !== "TABLE_SERVICE") {
    return (
      <div className="mx-auto max-w-7xl rounded-lg border border-zera-line bg-white p-6">
        <h2 className="text-xl font-bold">Open bills are for table service</h2>
        <p className="mt-2 text-sm text-zera-muted">Retail checkout businesses record payment directly from POS.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-zera-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">Cashier workspace</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Payment queue</h2>
            <p className="mt-3 max-w-3xl leading-7 text-zera-muted">
              Settle customer bills from table service. Print a customer bill when needed, receive payment, free the table, and issue the final receipt.
            </p>
          </div>
          <Button type="button" variant="secondary" className="gap-2" onClick={loadOpenBills}>
            <RefreshCcw size={17} />
            Refresh
          </Button>
        </div>
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={ReceiptText} label="Open bills" value={loading ? "..." : orders.length} />
        <Metric icon={CheckCircle2} label="Printed bills" value={loading ? "..." : printedBills.length} />
        <Metric icon={Clock3} label="New orders" value={loading ? "..." : freshOrders.length} />
        <Metric icon={Table2} label="Branch" value={activeBranch?.name || "No branch"} />
      </section>

      <section className="rounded-lg border border-zera-line bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-zera-green">Amount waiting</p>
            <h3 className="mt-1 text-2xl font-bold">{loading ? "Loading..." : formatMoney(totalDue, activeBusiness.currency)}</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-zera-muted">
            Use <span className="font-semibold text-zera-ink">Print customer bill</span> for a guest copy before payment. Use{" "}
            <span className="font-semibold text-zera-ink">Receive payment</span> only when the cashier has collected money.
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-lg border border-zera-line bg-white p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Waiting bills</h3>
              <p className="mt-1 text-sm text-zera-muted">
                {loading ? "Loading..." : `${visibleOrders.length} of ${orders.length} bill${orders.length === 1 ? "" : "s"} shown`}
              </p>
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {[
              { label: "All bills", value: "ALL", count: billStats.all },
              { label: "Ready to pay", value: "READY", count: billStats.ready },
              { label: "Needs bill", value: "NEEDS_BILL", count: billStats.needsBill }
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`min-h-10 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition ${
                  billFilter === filter.value
                    ? "border-zera-green bg-zera-green text-white"
                    : "border-zera-line bg-white text-zera-ink hover:border-zera-green hover:bg-zera-mint hover:text-zera-green"
                }`}
                onClick={() => setBillFilter(filter.value)}
              >
                {filter.label}
                <span className={`ml-2 rounded-md px-2 py-0.5 text-xs ${billFilter === filter.value ? "bg-white/20 text-white" : "bg-[#f7faf8] text-zera-muted"}`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {!loading && !orders.length ? (
              <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-6 text-center">
                <ReceiptText className="mx-auto text-zera-green" size={28} />
                <h4 className="mt-3 font-bold">No open bills</h4>
                <p className="mt-1 text-sm text-zera-muted">Bills sent by waiters will appear here for cashier payment.</p>
              </div>
            ) : null}

            {!loading && orders.length > 0 && visibleOrders.length === 0 ? (
              <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-6 text-center">
                <ReceiptText className="mx-auto text-zera-green" size={28} />
                <h4 className="mt-3 font-bold">No bills in this view</h4>
                <p className="mt-1 text-sm text-zera-muted">Choose another queue filter to see more bills.</p>
              </div>
            ) : null}

            {visibleOrders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;

              return (
                <button
                  key={order.id}
                  type="button"
                  className={`w-full rounded-md border p-4 text-left transition ${
                    isSelected ? "border-zera-green bg-zera-mint/60" : "border-zera-line hover:bg-[#f7faf8]"
                  }`}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate font-bold">{order.table?.name || "Table bill"}</h4>
                      <p className="mt-1 text-sm text-zera-muted">{order.orderNumber}</p>
                      <p className="mt-1 truncate text-xs text-zera-muted">
                        {order.customer?.name || "Walk-in customer"} · served by {order.waiter?.name || "staff"}
                      </p>
                      <p className="mt-1 text-xs text-zera-muted">Updated {formatTime(order.updatedAt || order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatMoney(order.total, activeBusiness.currency)}</p>
                      <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-bold ${order.status === "BILL_PRINTED" ? "bg-zera-mint text-zera-green" : "bg-amber-50 text-amber-700"}`}>
                        {formatOrderStatus(order.status)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="space-y-5">
          <section className="rounded-lg border border-zera-line bg-white p-5">
            {!selectedOrder ? (
              <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">
                Select an open bill to receive payment.
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zera-green">Selected bill</p>
                    <h3 className="mt-1 text-2xl font-bold">{selectedOrder.table?.name || "Table bill"}</h3>
                    <p className="mt-2 text-sm text-zera-muted">{selectedOrder.orderNumber}</p>
                  </div>
                  <span className={`rounded-md px-3 py-2 text-xs font-bold ${selectedOrder.status === "BILL_PRINTED" ? "bg-zera-mint text-zera-green" : "bg-amber-50 text-amber-700"}`}>
                    {formatOrderStatus(selectedOrder.status)}
                  </span>
                </div>

                <div className="mt-4 rounded-md bg-[#f7faf8] px-3 py-3 text-sm text-zera-muted">
                  {selectedOrder.status === "BILL_PRINTED"
                    ? "Customer bill has been printed. Receive payment when the guest pays, then print the final receipt."
                    : "This order is open. Print a customer bill first if the guest needs to review the bill before paying."}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <InfoBlock icon={Table2} label="Table" value={selectedOrder.table?.name || "Not set"} />
                  <InfoBlock icon={UserRound} label="Customer" value={selectedOrder.customer?.name || "Walk-in"} />
                  <InfoBlock icon={ReceiptText} label="Items" value={selectedOrder.items?.length || 0} />
                </div>

                <div className="mt-5 divide-y divide-zera-line rounded-md border border-zera-line">
                  {selectedOrder.items?.map((item) => (
                    <div className="flex items-start justify-between gap-3 px-3 py-3" key={item.id}>
                      <div>
                        <p className="font-bold">{item.product?.name || "Product"}</p>
                        <p className="mt-1 text-sm text-zera-muted">
                          {item.quantity} x {formatMoney(item.unitPrice, activeBusiness.currency)}
                        </p>
                      </div>
                      <p className="font-bold">{formatMoney(item.lineTotal, activeBusiness.currency)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-md border border-zera-line p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Amount due</span>
                    <span className="text-2xl font-bold">{formatMoney(selectedItemsTotal, activeBusiness.currency)}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const selected = paymentMethod === method.value;

                    return (
                      <button
                        key={method.value}
                        type="button"
                        className={`flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold transition ${
                          selected ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line bg-white text-zera-muted hover:bg-[#f7faf8]"
                        }`}
                        onClick={() => setPaymentMethod(method.value)}
                      >
                        <Icon size={17} />
                        {method.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button type="button" variant="secondary" className="gap-2" disabled={printingBill} onClick={() => handlePrintBill(selectedOrder)}>
                    <Printer size={18} />
                    Print customer bill
                  </Button>
                  <Button type="button" className="gap-2" disabled={savingPayment} onClick={handleReceivePayment}>
                    <ReceiptText size={18} />
                    {savingPayment ? "Receiving..." : "Receive payment & close table"}
                  </Button>
                </div>
              </>
            )}
          </section>

          {lastSale ? (
            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zera-green">Payment complete</p>
                  <h3 className="mt-1 text-lg font-bold">{lastSale.receiptNumber}</h3>
                  <p className="mt-1 text-sm text-zera-muted">{formatMoney(lastSale.total, activeBusiness.currency)}</p>
                </div>
                <ReceiptText className="text-zera-green" size={24} />
              </div>

              <div className="max-h-80 overflow-y-auto rounded-md border border-zera-line bg-[#f7faf8] p-3">
                <PrintableReceipt business={activeBusiness} sale={lastSale} />
              </div>

              <Button type="button" className="no-print mt-4 w-full gap-2" onClick={() => window.print()}>
                <Printer size={18} />
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

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-zera-line bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
          <p className="mt-1 truncate text-xl font-bold">{value}</p>
        </div>
      </div>
    </article>
  );
}

function InfoBlock({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-[#f7faf8] px-3 py-3">
      <Icon className="text-zera-green" size={18} />
      <p className="mt-2 text-xs font-bold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
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

function formatOrderStatus(status = "OPEN") {
  return status
    .toLowerCase()
    .replace("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
