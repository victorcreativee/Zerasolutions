export default function PrintableReceipt({ business, sale }) {
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
          <span>Customer</span>
          <span className="text-right">{sale.customer?.name || "Walk-in"}</span>
        </div>
        {sale.table?.name ? (
          <div className="mt-1 flex justify-between gap-3">
            <span>Table</span>
            <span className="text-right">{sale.table.name}</span>
          </div>
        ) : null}
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

function formatPayment(method = "CASH") {
  return method.replace("_", " ").toLowerCase();
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
