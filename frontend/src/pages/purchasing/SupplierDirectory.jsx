import { useState } from 'react';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';

export default function SupplierDirectory({ suppliers, onEdit, onOrders, busy }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const query = search.trim().toLocaleLowerCase();
  const visible = suppliers.filter(supplier =>
    (status === 'all' || supplier.active === (status === 'active')) &&
    [supplier.name, supplier.email, supplier.phone, supplier.address].some(value => String(value || '').toLocaleLowerCase().includes(query))
  );
  return <section className="space-y-4" aria-label="Supplier directory">
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-zera-line bg-white p-4">
      <div className="min-w-0 flex-1"><Input label="Search suppliers" placeholder="Name, email, phone or address" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <label className="block text-sm font-semibold">Supplier status<select className="mt-1 block min-h-10 w-full rounded-md border border-zera-line bg-white px-3" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All suppliers</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <Button variant="secondary" onClick={() => { setSearch(''); setStatus('all'); }} disabled={!search && status === 'all'}>Clear filters</Button>
      <p role="status" className="w-full text-sm text-zera-muted">Showing {visible.length} of {suppliers.length} suppliers</p>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(supplier => <article className="flex min-w-0 flex-col rounded-md border border-zera-line bg-white p-4" key={supplier.id}>
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words font-bold">{supplier.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${supplier.active ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{supplier.active ? 'Active' : 'Inactive'}</span></div>
      <dl className="mt-3 space-y-2 text-sm">
        <div><dt className="text-xs text-zera-muted">Email</dt><dd className="break-all">{supplier.email || 'Not provided'}</dd></div>
        <div><dt className="text-xs text-zera-muted">Phone</dt><dd className="break-words">{supplier.phone || 'Not provided'}</dd></div>
        <div><dt className="text-xs text-zera-muted">Address</dt><dd className="whitespace-pre-wrap break-words">{supplier.address || 'Not provided'}</dd></div>
      </dl>
      {supplier.notes && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Supplier notes</summary><p className="mt-2 whitespace-pre-wrap break-words text-zera-muted">{supplier.notes}</p></details>}
      {!supplier.active && <p className="mt-3 text-xs text-zera-muted">Inactive suppliers cannot be selected for new orders. Existing orders remain available.</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-4"><Button variant="secondary" disabled={busy} aria-label={`Edit supplier ${supplier.name}`} onClick={() => onEdit(supplier)}>Edit supplier</Button><Button variant="secondary" disabled={busy} aria-label={`View orders for ${supplier.name}`} onClick={() => onOrders(supplier)}>View orders</Button></div>
    </article>)}</div>
    {!visible.length && <div className="rounded-md border border-zera-line bg-white p-8 text-center"><h3 className="font-semibold">{suppliers.length ? 'No matching suppliers' : 'No suppliers yet'}</h3><p className="mt-2 text-sm text-zera-muted">{suppliers.length ? 'Try another search or clear the filters.' : 'Choose Add supplier above to start creating purchase orders.'}</p></div>}
  </section>;
}
