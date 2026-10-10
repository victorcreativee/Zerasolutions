import SupplierDirectory from './SupplierDirectory.jsx';
import { Link } from 'react-router-dom';
import Pagination from '../../components/Pagination.jsx';
import DeliveryProgress from './DeliveryProgress.jsx';
import { printPurchaseOrder } from '../../utils/purchaseOrderPrint.js';
import { useEffect, useRef, useState } from 'react';
import { Plus, Truck, PackageCheck, RefreshCcw, X } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import { getProducts } from '../../services/productService.js';
import { downloadPurchaseOrders, getSuppliers, saveSupplier, getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, actOnPurchaseOrder } from '../../services/purchasingService.js';

const statusLabels = { DRAFT: 'Draft', ORDERED: 'Awaiting delivery', PARTIALLY_RECEIVED: 'Partially received', RECEIVED: 'Received', CANCELLED: 'Cancelled' };
const statusColors = { DRAFT: 'bg-slate-100 text-slate-700', ORDERED: 'bg-blue-50 text-blue-800', PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-800', RECEIVED: 'bg-green-50 text-green-800', CANCELLED: 'bg-slate-100 text-slate-600' };
function OrderStatus({ status }) { return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[status] || ''}`}>{statusLabels[status] || status}</span>; }
const emptySupplier = { name: '', email: '', phone: '', address: '', notes: '', active: true };
const newLine = () => ({ productId: '', quantity: '1', unitCost: '0' });
const money = (value, currency) => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function PurchasingPage() {
  const { activeBusiness, activeBusinessId, activeBranchId, activeRoleName, branches } = useWorkspace();
  // Remount on business changes so an old draft or response cannot move into another tenant.
  return activeBusiness ? <PurchasingWorkspace key={activeBusinessId} business={activeBusiness} branchId={activeBranchId} role={activeRoleName} branches={branches} /> : <p>Select a business to manage purchases.</p>;
}
function PurchasingWorkspace({ business, branchId, role, branches }) {
  const [suppliers, setSuppliers] = useState([]), [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]), [total, setTotal] = useState(0);
  const [page, setPage] = useState(1), [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState(''), [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(''), [branchFilter, setBranchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(''), [dateTo, setDateTo] = useState('');
  const [dateInputs, setDateInputs] = useState({ from: '', to: '' });
  const [tab, setTab] = useState('orders'), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [supplierForm, setSupplierForm] = useState(null), [draft, setDraft] = useState(null), [selected, setSelected] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const generation = useRef(0);
  const canApprove = ['Owner','Manager'].includes(role);
  useEffect(() => { load(); return () => { generation.current += 1; }; }, [page, status, search, supplierFilter, branchFilter, dateFrom, dateTo]);
  async function load() {
    const version = ++generation.current;
    setLoading(true); setLoadError('');
    try {
      const [supplierRows, productRows, result] = await Promise.all([getSuppliers(business.id), getProducts(business.id), getPurchaseOrders(business.id, { page, status, search, supplierId: supplierFilter, branchId: branchFilter, dateFrom, dateTo })]);
      if (version !== generation.current) return;
      setSuppliers(supplierRows); setProducts(productRows.filter(item => item.type === 'PHYSICAL' && item.status === 'ACTIVE'));
      setOrders(result.orders); setTotal(result.total);
    } catch (e) { if (version === generation.current) setLoadError(e.response?.data?.message || 'Unable to load purchasing.'); }
    finally { if (version === generation.current) setLoading(false); }
  }
  async function perform(action, success) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await load(); setMessage(success); }
    catch (e) { setError(e.response?.data?.message || 'Unable to save. Please try again.'); }
    finally { setBusy(false); }
  }
  async function exportOrders() {
    setExporting(true); setError('');
    try {
      const blob = await downloadPurchaseOrders(business.id, { status, search, supplierId: supplierFilter, branchId: branchFilter, dateFrom, dateTo });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'zera-purchase-orders.csv';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      setMessage('Purchase orders exported using the current filters across all pages.');
    } catch(e) {
      let message = e.response?.data?.message;
      if (e.response?.data instanceof Blob) { try { message = JSON.parse(await e.response.data.text()).message; } catch {} }
      setError(message || 'Unable to export purchases. Please try again.');
    } finally { setExporting(false); }
  }
  function clearDates() {
    setDateFrom(''); setDateTo(''); setDateInputs({ from: '', to: '' }); setPage(1);
  }
  function orderAgain(order) {
    setError(''); setMessage(''); setConfirmAction(null);
    setDraft({
      sourceNumber: order.number, sourceCurrency: order.currency,
      supplierId: order.supplierId, branchId: order.branchId,
      note: '', items: order.items.map(item => ({ productId: item.productId, productName: item.productName, quantity: item.quantity, unitCost: String(item.unitCost) }))
    });
    setSelected(null);
  }
  const unavailableDraft = draft && (
    !suppliers.some(s => s.active && s.id === draft.supplierId) ||
    !branches.some(b => b.status === 'ACTIVE' && b.id === draft.branchId) ||
    !draft.items.length || draft.items.some(line => !products.some(p => p.id === line.productId))
  );
  function updateLine(index, key, value) { setDraft(current => ({ ...current, items: current.items.map((line, i) => i === index ? { ...line, [key]: value } : line) })); }
  const draftTotal = draft?.items.reduce((sum, line) => sum + (Number(line.quantity) || 0) * Math.round((Number(line.unitCost) || 0)*100), 0)/100;
  return <div className="mx-auto max-w-[1500px] space-y-4">
    <section className="rounded-md border border-zera-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="mt-1 text-2xl font-bold">Purchasing</h2></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setError(''); setSupplierForm({ ...emptySupplier }); }} disabled={busy}><Truck size={16} />Add supplier</Button><Button disabled={busy || loading || !suppliers.some(s => s.active) || !products.length || !branches.some(b => b.status === 'ACTIVE')} onClick={() => { setError(''); setDraft({ supplierId: suppliers.find(s => s.active)?.id || '', branchId: branches.find(b => b.id === branchId && b.status === 'ACTIVE')?.id || branches.find(b => b.status === 'ACTIVE')?.id || '', note: '', items: [newLine()] }); }}><Plus size={16} />New order</Button></div>
      </div>
      <p className="mt-3 text-xs text-zera-muted">Receive stock here. {activeRoleName === 'Owner' ? <Link to="/money" className="font-semibold text-zera-green underline">Record supplier payments in Money accounts.</Link> : 'The owner records supplier payments separately.'}</p>
    </section>
    {loadError && <div role="alert" className="rounded-md bg-red-50 p-3 text-red-700"><p>{loadError}</p><Button className="mt-2" variant="secondary" onClick={load}>Try again</Button></div>}
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-md bg-zera-mintSoft p-3 text-zera-green">{message}</p>}
    <div className="flex flex-wrap gap-2"><Button variant={tab === 'orders' ? 'primary' : 'secondary'} onClick={() => setTab('orders')}>Purchase orders</Button><Button variant={tab === 'suppliers' ? 'primary' : 'secondary'} onClick={() => setTab('suppliers')}>Suppliers ({suppliers.length})</Button></div>
    {tab === 'orders' && <form className="flex flex-wrap items-end gap-3 rounded-md border border-zera-line bg-white p-4" onSubmit={event => {
      event.preventDefault();
      if (dateInputs.from && dateInputs.to && dateInputs.from > dateInputs.to) { setError('Start date must not follow end date.'); return; }
      setError(''); setDateFrom(dateInputs.from); setDateTo(dateInputs.to); setPage(1);
    }}>
      <Input label="Created from (UTC)" type="date" value={dateInputs.from} max={dateInputs.to || undefined} onChange={event => setDateInputs({ ...dateInputs, from: event.target.value })} />
      <Input label="Created through (UTC)" type="date" value={dateInputs.to} min={dateInputs.from || undefined} onChange={event => setDateInputs({ ...dateInputs, to: event.target.value })} />
      <Button type="submit" variant="secondary" disabled={loading}>Apply dates</Button>
      <Button type="button" variant="secondary" onClick={clearDates}>Clear dates</Button>
      <p className="w-full text-xs text-zera-muted" role="status">{dateFrom || dateTo ? `${dateFrom || 'Any date'} – ${dateTo || 'Any date'} · UTC, inclusive · also applies to exports` : 'All dates'}</p>
    </form>}
    {loading ? <p role="status" className="rounded-md border border-zera-line bg-white p-8 text-center text-zera-muted">Loading purchasing…</p> : loadError ? <p className="p-5 text-zera-muted">Purchasing data could not be loaded. Try again to see current orders and suppliers.</p> : tab === 'suppliers' ? <SupplierDirectory suppliers={suppliers} busy={busy} onEdit={supplier => { setError(''); setSupplierForm({ ...supplier }); }} onOrders={supplier => { clearDates(); setSupplierFilter(supplier.id); setSearch(''); setSearchInput(''); setStatus(''); setBranchFilter(''); setPage(1); setTab('orders'); }} /> : <section className="overflow-hidden rounded-md border border-zera-line bg-white">
      <div className="flex flex-wrap items-end gap-3 border-b border-zera-line p-4"><form className="flex w-full flex-wrap items-end gap-2 sm:w-auto" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}><Input label="Search orders" placeholder="Order, supplier or product" maxLength={150} value={searchInput} onChange={event => setSearchInput(event.target.value)} /><Button type="submit" variant="secondary">Search</Button></form><Select label="Supplier" value={supplierFilter} onChange={value => { setSupplierFilter(value); setPage(1); }}><option value="">All suppliers</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (inactive)"}</option>)}</Select><Select label="Branch" value={branchFilter} onChange={value => { setBranchFilter(value); setPage(1); }}><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select><Select label="Order status" value={status} onChange={value => { setStatus(value); setPage(1); }}><option value="">All orders</option>{['DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'].map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</Select><Button variant="secondary" onClick={() => { clearDates(); setSearchInput(''); setSearch(''); setSupplierFilter(''); setBranchFilter(''); setStatus(''); setPage(1); }}>Clear filters</Button><Button variant="secondary" disabled={exporting || loading || busy} onClick={exportOrders}>{exporting ? 'Exporting…' : 'Export CSV'}</Button><span className="text-sm text-zera-muted">{total} orders</span></div>
      <div className="divide-y divide-zera-line md:hidden">{orders.map(order => <article className="space-y-3 p-4" key={order.id}>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-sm font-bold">{order.number}</p><OrderStatus status={order.status} /></div><DeliveryProgress order={order} compact />
        <p className="break-words font-semibold">{order.supplier.name}</p>
        <p className="text-sm text-zera-muted">{order.branch.name} · {new Date(order.createdAt).toLocaleDateString()}</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><strong>{money(order.total,order.currency)}</strong><Button variant="secondary" aria-label={`View order ${order.number}`} onClick={() => { setError(''); setConfirmAction(null); setSelected(order); }}>View order</Button></div>
      </article>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-zera-mintSoft text-zera-muted"><tr>{['Order','Supplier / branch','Status','Total',''].map((label,i) => <th className="p-3" key={i}>{label}</th>)}</tr></thead><tbody>{orders.map(order => <tr className="border-t border-zera-line" key={order.id}><td className="p-3 font-semibold">{order.number}<div className="text-xs font-normal text-zera-muted">{new Date(order.createdAt).toLocaleDateString()}</div></td><td className="p-3">{order.supplier.name}<div className="text-xs text-zera-muted">{order.branch.name}</div></td><td className="p-3"><OrderStatus status={order.status} /><DeliveryProgress order={order} compact /></td><td className="p-3 font-semibold">{money(order.total, order.currency)}</td><td className="p-3"><Button variant="secondary" aria-label={`View order ${order.number}`} onClick={() => { setError(''); setConfirmAction(null); setSelected(order); }}>View</Button></td></tr>)}</tbody></table></div>{!orders.length && <p className="p-8 text-center text-zera-muted">{loading ? 'Loading purchases…' : 'No matching orders.'}</p>}
      <Pagination page={page} pageSize={25} total={total} onPageChange={setPage} loading={loading} />
    </section>}
    {supplierForm && <Modal title={supplierForm.id ? 'Edit supplier' : 'New supplier'} onClose={() => !busy && setSupplierForm(null)} error={error}><form className="space-y-3" onSubmit={event => { event.preventDefault(); perform(async () => { await saveSupplier(business.id, supplierForm, supplierForm.id); setSupplierForm(null); }, 'Supplier saved.'); }}><fieldset disabled={busy} className="space-y-3">{[['name','Name'],['email','Email'],['phone','Phone'],['address','Address'],['notes','Notes']].map(([key,label]) => <Input key={key} label={label} type={key === 'email' ? 'email' : 'text'} required={key === 'name'} value={supplierForm[key] || ''} onChange={e => setSupplierForm({ ...supplierForm, [key]: e.target.value })} />)}<label className="flex gap-2 text-sm"><input type="checkbox" checked={supplierForm.active} onChange={e => setSupplierForm({ ...supplierForm, active: e.target.checked })} />Active supplier</label><Button type="submit">{busy ? 'Saving…' : 'Save supplier'}</Button></fieldset></form></Modal>}
    {draft && <Modal title={draft.id ? "Edit purchase draft" : draft.sourceNumber ? "Order again" : "New purchase order"} onClose={() => !busy && setDraft(null)} error={error}><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (unavailableDraft) { setError('Choose an active supplier, branch and available products before saving.'); return; } perform(async () => { if (draft.id) await updatePurchaseOrder(business.id, draft.id, draft); else { const created = await createPurchaseOrder(business.id, draft); setSelected(created); setConfirmAction(null); } setDraft(null); }, 'Purchase draft saved. An owner or manager can approve it.'); }}><fieldset disabled={busy} className="space-y-4">{draft.sourceNumber && <div className="rounded-md bg-zera-mintSoft p-3 text-sm"><p>New draft based on <strong>{draft.sourceNumber}</strong>. Review the original quantities and unit costs before saving. Delivery history and approval are not copied.</p>{draft.sourceCurrency !== business.currency && <p className="mt-2 font-semibold text-amber-800">The original currency was {draft.sourceCurrency}; this draft uses {business.currency}. Enter the correct costs—no currency conversion has been applied.</p>}</div>}{unavailableDraft && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Choose an active supplier and branch, and replace or remove unavailable products before saving.</p>}<div className="grid gap-3 sm:grid-cols-2"><Select label="Supplier" value={draft.supplierId} onChange={supplierId => setDraft({ ...draft, supplierId })}><option value="">Choose an active supplier</option>{!suppliers.some(s => s.active && s.id === draft.supplierId) && draft.supplierId && <option value={draft.supplierId} disabled>Supplier unavailable — choose another</option>}{suppliers.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select><Select label="Receiving branch" value={draft.branchId} onChange={branchId => setDraft({ ...draft, branchId })}><option value="">Choose an active branch</option>{!branches.some(b => b.status === 'ACTIVE' && b.id === draft.branchId) && draft.branchId && <option value={draft.branchId} disabled>Branch unavailable — choose another</option>}{branches.filter(b => b.status === 'ACTIVE').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></div>
      {draft.items.map((line,index) => <div className="grid items-end gap-2 rounded-md border border-zera-line p-3 sm:grid-cols-[2fr_1fr_1fr_auto]" key={index}><Select label="Product" value={line.productId} onChange={value => updateLine(index,'productId',value)}><option value="">Choose a product</option>{line.productId && !products.some(p => p.id === line.productId) && <option value={line.productId} disabled>{line.productName || 'Product unavailable'} — choose another</option>}{products.map(p => <option key={p.id} value={p.id} disabled={draft.items.some((other,i) => i !== index && other.productId === p.id)}>{p.name}</option>)}</Select><Input label="Quantity" type="number" min="1" max="2147483647" step="1" required value={line.quantity} onChange={e => updateLine(index,'quantity',e.target.value)} /><Input label={`Unit cost (${business.currency})`} type="number" min="0" step="0.01" required value={line.unitCost} onChange={e => updateLine(index,'unitCost',e.target.value)} /><Button type="button" variant="ghost" aria-label={`Remove product ${index+1}`} disabled={draft.items.length === 1} onClick={() => setDraft({ ...draft, items: draft.items.filter((_,i) => i !== index) })}><X size={16} /></Button></div>)}
      <Button type="button" variant="secondary" disabled={draft.items.length >= 100} onClick={() => setDraft({ ...draft, items: [...draft.items,newLine()] })}>Add product</Button><Input label="Note" value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} /><div className="flex items-center justify-between"><strong>{money(draftTotal,business.currency)}</strong><Button type="submit" disabled={unavailableDraft}>{busy ? 'Saving…' : 'Save draft'}</Button></div></fieldset></form></Modal>}
    {selected && <Modal title={selected.number} onClose={() => !busy && (setSelected(null), setConfirmAction(null))} error={error}>
      <div className="space-y-4">
        <p><strong>{selected.supplier.name}</strong> · {selected.branch.name}<br /><span className="text-sm text-zera-muted"><OrderStatus status={selected.status} /> · Created by {selected.createdBy.name}</span></p>
        <DeliveryProgress order={selected} />
        <div className="space-y-3 sm:hidden">{selected.items.map(item => <article key={item.id} className="rounded-md border border-zera-line p-3">
          <h4 className="break-words font-semibold">{item.productName}</h4>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zera-muted">Ordered</dt><dd className="text-right">{item.quantity}</dd>
            <dt className="text-zera-muted">Received</dt><dd className="text-right">{item.receivedQuantity}</dd>
            <dt className="text-zera-muted">{selected.status === 'CANCELLED' ? 'Cancelled quantity' : 'Outstanding'}</dt><dd className="text-right">{item.quantity-item.receivedQuantity}</dd>
            <dt className="text-zera-muted">Unit cost</dt><dd className="text-right">{money(item.unitCost,selected.currency)}</dd>
            <dt className="font-semibold">Line total</dt><dd className="text-right font-semibold">{money(item.lineTotal,selected.currency)}</dd>
          </dl>
        </article>)}</div>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr>{['Product','Ordered','Received',selected.status === 'CANCELLED' ? 'Cancelled quantity' : 'Outstanding','Line total'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>
          {selected.items.map(item => <tr className="border-t border-zera-line" key={item.id}><td className="p-2">{item.productName}</td><td className="p-2">{item.quantity}</td><td className="p-2">{item.receivedQuantity}</td><td className="p-2">{item.quantity-item.receivedQuantity}</td><td className="p-2">{money(item.lineTotal,selected.currency)}</td></tr>)}
        </tbody></table></div>
        <p className="text-right text-lg font-bold">Order total {money(selected.total,selected.currency)}</p>
        {selected.note && <p className="text-sm">{selected.note}</p>}
        {selected.approvedBy && <p className="text-sm text-zera-muted">Approved by {selected.approvedBy.name}</p>}
        {selected.status === 'CANCELLED' && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">The unreceived remainder is cancelled. Previously received goods remain in stock.</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => orderAgain(selected)}>Order again</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { try { printPurchaseOrder(selected,business); } catch(e) { setError(e.message); } }}>Print order / PDF</Button>
          {selected.status === 'DRAFT' && <Button variant="secondary" disabled={busy} onClick={() => { setDraft({ id: selected.id, updatedAt: selected.updatedAt, supplierId: selected.supplierId, branchId: selected.branchId, note: selected.note || '', items: selected.items.map(item => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost })) }); setSelected(null); }}>Edit draft</Button>}
          {canApprove && selected.status === 'DRAFT' && <Button disabled={busy} onClick={() => setConfirmAction('approve')}>Approve order</Button>}
          {['ORDERED','PARTIALLY_RECEIVED'].includes(selected.status) && <Button disabled={busy} onClick={() => setConfirmAction('receive')}><PackageCheck size={16} />Receive delivery</Button>}
          {canApprove && ['DRAFT','ORDERED','PARTIALLY_RECEIVED'].includes(selected.status) && <Button variant="secondary" disabled={busy} onClick={() => setConfirmAction('cancel')}>{selected.status === 'PARTIALLY_RECEIVED' ? 'Cancel remainder' : 'Cancel order'}</Button>}
        </div>
        {confirmAction === 'receive' ? <ReceiptForm order={selected} busy={busy} onBack={() => setConfirmAction(null)} onSave={payload => perform(async () => {
          const updated = await actOnPurchaseOrder(business.id, selected.id, 'receive', payload);
          setSelected(updated); setConfirmAction(null);
        }, 'Delivery received and stock updated.')} /> : confirmAction && <div className="rounded-md border border-zera-line bg-zera-mintSoft p-4">
          <p className="mb-3 text-sm">{confirmAction === 'approve' ? 'Approve this order for receiving? No message is sent to the supplier.' : 'Cancel the unreceived remainder? Previously received goods and delivery history will be kept.'}</p>
          <div className="flex gap-2"><Button disabled={busy} onClick={() => perform(async () => { const updated = await actOnPurchaseOrder(business.id,selected.id,confirmAction); setSelected(updated); setConfirmAction(null); }, 'Purchase order updated.')}>{busy ? 'Saving…' : 'Confirm'}</Button><Button variant="secondary" disabled={busy} onClick={() => setConfirmAction(null)}>Back</Button></div>
        </div>}
        <section className="border-t border-zera-line pt-4"><h4 className="font-bold">Delivery history</h4>
          {selected.receipts?.length ? selected.receipts.map(receipt => <article className="mt-3 rounded-md border border-zera-line p-3" key={receipt.id}>
            <p className="break-all text-xs font-semibold">{receipt.reference}</p><p className="mt-1 text-sm text-zera-muted">{new Date(receipt.createdAt).toLocaleString()} · {receipt.receivedBy?.name || 'Receiver not recorded'}</p>
            <ul className="mt-2 space-y-1 text-sm">{receipt.items.map(item => <li key={item.orderItemId}>{item.quantity} × {item.productName}</li>)}</ul>
            {receipt.note && <p className="mt-2 text-sm text-zera-muted">{receipt.note}</p>}
          </article>) : <p className="mt-2 text-sm text-zera-muted">No deliveries recorded yet.</p>}
        </section>
      </div>
    </Modal>}

  </div>;
}
function ReceiptForm({ order, busy, onBack, onSave }) {
  const outstanding = order.items.filter(item => item.receivedQuantity < item.quantity);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(outstanding.map(item => [item.id, '0'])));
  const [note, setNote] = useState('');
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const units = outstanding.reduce((sum,item) => sum + (Number(quantities[item.id]) || 0), 0);
  function changeQuantity(id, quantity) { setQuantities(current => ({ ...current, [id]: quantity })); setRequestKey(crypto.randomUUID()); }
  return <form className="space-y-3 rounded-md border border-zera-line bg-zera-mintSoft p-4" onSubmit={event => {
    event.preventDefault();
    onSave({ requestKey, note, items: outstanding.filter(item => Number(quantities[item.id]) > 0).map(item => ({ orderItemId: item.id, quantity: Number(quantities[item.id]) })) });
  }}><fieldset disabled={busy} className="space-y-3">
    <h4 className="font-bold">Record this delivery</h4><p className="text-sm text-zera-muted">Enter only the quantities that arrived at {order.branch.name}. Leave other products at zero.</p>
    {outstanding.map(item => <Input key={item.id} label={`${item.productName} — received now`} helper={`${item.quantity-item.receivedQuantity} outstanding`} type="number" min="0" max={item.quantity-item.receivedQuantity} step="1" required value={quantities[item.id]} onChange={event => changeQuantity(item.id,event.target.value)} />)}
    <Button type="button" variant="secondary" onClick={() => { setQuantities(Object.fromEntries(outstanding.map(item => [item.id,String(item.quantity-item.receivedQuantity)]))); setRequestKey(crypto.randomUUID()); }}>Fill all outstanding</Button>
    <Input label="Delivery note or reference" maxLength={2000} value={note} onChange={event => { setNote(event.target.value); setRequestKey(crypto.randomUUID()); }} />
    <p className="text-sm">This delivery adds <strong>{units}</strong> units to stock.</p>
    <div className="flex gap-2"><Button type="submit" disabled={busy || units <= 0}>{busy ? 'Receiving…' : 'Confirm delivery'}</Button><Button type="button" variant="secondary" onClick={onBack}>Back</Button></div>
  </fieldset></form>;
}
function Select({ label, value, onChange, children }) { return <label className="block text-sm font-semibold">{label}<select required className="mt-1 block min-h-10 w-full rounded-md border border-zera-line bg-white px-2" value={value} onChange={event => onChange(event.target.value)}>{children}</select></label>; }
function Modal({ title, children, onClose, error }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialogRef} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-lg bg-white p-5 text-zera-ink shadow-xl backdrop:bg-black/40"><header className="mb-4 flex items-center justify-between gap-3"><h3 className="break-all text-xl font-bold">{title}</h3><Button variant="ghost" aria-label="Close dialog" onClick={onClose}><X size={18} /></Button></header>{error && <p role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-red-700">{error}</p>}{children}</dialog>;
}
