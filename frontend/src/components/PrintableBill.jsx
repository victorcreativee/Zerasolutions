export default function PrintableBill({ business, order }) {
  const currency = business?.currency || "UGX";
  const billDate = new Date(order?.updatedAt || order?.createdAt || Date.now());
  const subtotal = order?.items?.reduce((total, item) => total + Number(item.lineTotal), 0) || Number(order?.total || 0);

  return (
    <article className="receipt-print-root mx-auto w-full max-w-[360px] bg-white p-5 font-mono text-[12px] leading-tight text-black shadow-soft">
      <header className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-black text-lg font-black">
          {business?.name?.charAt(0)?.toUpperCase() || "Z"}
        </div>
        <h3 className="mt-3 text-base font-black uppercase tracking-normal">{business?.name || "Zera Business"}</h3>
        <p className="mt-1">{order?.branch?.name || "Main Branch"}</p>
        {business?.country ? <p>{business.country}</p> : null}
        <p>Powered by Zera Solutions</p>
      </header>

      <div className="my-4 border-y-2 border-black py-2">
        <div className="flex justify-between gap-3">
          <span className="font-black">CUSTOMER BILL</span>
          <span>{order?.orderNumber}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Status</span>
          <span className="font-black">NOT PAID</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Date</span>
          <span>{formatReceiptDate(billDate)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Time</span>
          <span>{formatReceiptTime(billDate)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Table</span>
          <span className="text-right">{order?.table?.name || "Table"}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Served by</span>
          <span className="text-right">{order?.waiter?.name || "Staff"}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>Customer</span>
          <span className="text-right">{order?.customer?.name || "Walk-in"}</span>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-[1fr_42px_76px] gap-2 border-b-2 border-black pb-2 font-black uppercase">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Total</span>
        </div>
        <div className="divide-y divide-dashed divide-black">
          {order?.items?.map((item) => (
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
          <p className="text-xs font-black uppercase">Amount due</p>
          <p className="mt-1 text-xl font-black">{formatMoney(order?.total || subtotal, currency)}</p>
        </div>
      </div>

      <footer className="mt-5 text-center">
        <p className="font-black">Please pay at cashier</p>
        <p className="mt-1 text-[11px]">This is a customer bill, not a payment receipt.</p>
      </footer>
    </article>
  );
}

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value).toLocaleString()}`;
}

function formatReceiptAmount(value) {
  return Number(value).toLocaleString();
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
