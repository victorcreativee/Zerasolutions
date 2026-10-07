const count = value => Number(value).toLocaleString();

export default function DeliveryProgress({ order, compact = false }) {
  const ordered = order.items.reduce((total, item) => total + item.quantity, 0);
  const received = order.items.reduce((total, item) => total + item.receivedQuantity, 0);
  const remaining = ordered - received;
  const cancelled = order.status === 'CANCELLED';
  const draft = order.status === 'DRAFT';
  const progressLabel = `${count(received)} of ${count(ordered)} ordered units received`;

  if (compact) return <p className="mt-1 text-xs text-zera-muted">
    {draft ? `${count(ordered)} units planned` : cancelled ? `${count(received)} received · ${count(remaining)} cancelled` : `${count(received)} / ${count(ordered)} units received`}
  </p>;

  return <section aria-label="Delivery progress" className="rounded-md border border-zera-line bg-zera-mintSoft p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-bold">Delivery progress</h4>
      <span className="text-sm text-zera-muted">{cancelled ? 'Closed' : draft ? 'Awaiting approval' : received === ordered && ordered > 0 ? 'Delivery complete' : 'Awaiting goods'}</span>
    </div>
    <p className="mt-2 text-sm">{progressLabel}</p>
    <progress aria-label={progressLabel} className="mt-2 h-3 w-full accent-zera-green" max={Math.max(1,ordered)} value={received} />
    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div><dt className="text-xs text-zera-muted">{draft ? 'Planned units' : 'Ordered units'}</dt><dd className="text-lg font-bold">{count(ordered)}</dd></div>
      <div><dt className="text-xs text-zera-muted">Received units</dt><dd className="text-lg font-bold">{count(received)}</dd></div>
      <div><dt className="text-xs text-zera-muted">{cancelled ? 'Cancelled units' : draft ? 'Not yet ordered' : 'Outstanding units'}</dt><dd className="text-lg font-bold">{count(remaining)}</dd></div>
    </dl>
    <p className="mt-3 text-xs text-zera-muted">{cancelled ? 'No further deliveries are expected. Received quantities are retained in the history.' : draft ? 'Approve the order before recording deliveries.' : 'Progress counts units across all products; it does not represent payment or current stock.'}</p>
  </section>;
}
