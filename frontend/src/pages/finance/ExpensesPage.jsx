import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { api } from "../../services/api.js";
import { createFinanceExpense } from "../../services/financeService.js";
import {Link} from "react-router-dom";
import FinanceNav from "./FinanceNav.jsx";
import {ExpenseHistory} from "./FinanceHistory.jsx";
import Button from "../../components/Button.jsx";

export default function ExpensesPage() {
  const { activeBusiness, activeBusinessId, activeBranchId, activeRoleName, branches } = useWorkspace();
  const [rows, setRows] = useState([]), [total, setTotal] = useState(0), [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [open, setOpen] = useState(false), [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", amount: "", category: "General", note: "", branchId: "" });
  const busy = useRef(false);
  const generation=useRef(0),historyRef=useRef(null);
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState(''),[history,setHistory]=useState(null);
  useEffect(()=>{if(history)historyRef.current?.scrollIntoView({block:'nearest'});},[history]);
  const allowed = activeRoleName === "Owner" || (activeRoleName === "Store Keeper" && activeBusiness?.features?.typeKey === "RETAIL_SHOP");
  const currency = activeBusiness?.currency || "UGX";
  async function load(targetPage = page) {
    const ticket=++generation.current;setLoading(true); setError("");
    try { const { data } = await api.get(`/finance/business/${activeBusinessId}/expenses`, { params: { page: targetPage, status, search } }); if(ticket===generation.current){setRows(data.expenses); setTotal(data.total);} }
    catch (e) { if(ticket===generation.current)setError(e.response?.data?.message || "Unable to load expenses."); }
    finally { if(ticket===generation.current)setLoading(false); }
  }
  useEffect(() => { setPage(1); setRows([]); setTotal(0); setOpen(false); setHistory(null); setMessage(''); }, [activeBusinessId]);
  useEffect(() => { if (activeBusinessId && allowed) load(); return()=>{generation.current++;}; }, [activeBusinessId, page, allowed, status, search]);
  async function submit(event) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setSaving(true); setError(""); setMessage("");
    try {
      if(form.id)await api.patch(`/finance/business/${activeBusinessId}/expenses/${form.id}`,form);
      else await createFinanceExpense(activeBusinessId, form);
      setOpen(false); setMessage("Expense submitted for approval.");
      if (page === 1) await load(1); else setPage(1);
    } catch (e) { setError(e.response?.data?.message || "Unable to confirm the expense. Check the list before retrying."); }
    finally { busy.current = false; setSaving(false); }
  }
  async function approve(row,status){if(busy.current)return;busy.current=true;setSaving(true);setError('');try{await api.patch(`/finance/business/${activeBusinessId}/expenses/${row.id}/status`,{status});await load();setMessage('Expense updated.');}catch(e){setError(e.response?.data?.message||'Unable to update expense.');}finally{busy.current=false;setSaving(false);}}
  async function viewHistory(row){const ticket=generation.current;try{const {data}=await api.get(`/finance/business/${activeBusinessId}/expenses/${row.id}/history`);if(ticket===generation.current)setHistory({title:row.title,events:data.events});}catch(e){setError(e.response?.data?.message||'Unable to load history.');}}
  if (!allowed) return <p className="p-5">Expenses are not available for this account.</p>;
  return <div className="mx-auto max-w-[1500px] space-y-4">
    <FinanceNav/><header className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">Expenses</h2><Button disabled={saving} onClick={() => { setForm({title:"",amount:"",category:"General",note:"",branchId:activeBranchId,requestKey:crypto.randomUUID()}); setMessage(""); setOpen(true); }}>New expense</Button></header>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-md bg-zera-mintSoft p-3 text-zera-green">{message}</p>}
    {open && <form onSubmit={submit} className="rounded-md border border-zera-line bg-white p-5 space-y-4">
      <h3 className="font-bold">{form.id?'Edit expense':'New expense'}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {[['title','Title','text'],['amount',`Amount (${currency})`,'number'],['category','Category','text']].map(([key,label,type]) => <label key={key} className="text-sm">{label}<input required type={type} min={type==='number'?'0.01':undefined} max={type==='number'?'9999999999.99':undefined} step={type==='number'?'0.01':undefined} maxLength={200} disabled={saving} className="mt-1 w-full rounded-md border border-zera-line p-2" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
        <label className="text-sm">Branch<select required disabled={saving||Boolean(form.id)} className="mt-1 w-full rounded-md border border-zera-line p-2" value={form.branchId} onChange={e=>setForm({...form,branchId:e.target.value})}><option value="">Select branch</option>{branches.filter(b=>b.status==='ACTIVE').map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      </div>
      <label className="block text-sm">Note<textarea maxLength={2000} disabled={saving} className="mt-1 w-full rounded-md border border-zera-line p-2" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>
      <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving?'Saving…':form.id?'Save changes':'Submit expense'}</Button><Button type="button" variant="secondary" disabled={saving} onClick={()=>setOpen(false)}>Cancel</Button></div>
    </form>}
    {history&&<section ref={historyRef} className="rounded border bg-white p-4"><div className="flex justify-between"><h3 className="font-bold">{history.title} · History</h3><Button variant="secondary" onClick={()=>setHistory(null)}>Close</Button></div>{history.events.length?history.events.map(event=><div key={event.id} className="border-t py-3 text-sm"><p>{({EXPENSE_CREATED:'Expense submitted',EXPENSE_EDITED:'Expense edited',EXPENSE_STATUS:'Approval updated',PAYROLL_CREATED:'Salary prepared'})[event.action]||'Updated'} · {event.actorName} · {new Date(event.createdAt).toLocaleString()}</p><p className="mt-1 text-xs text-zera-muted">{event.action==='EXPENSE_STATUS'?`${event.details.before} → ${event.details.after}`:event.action==='EXPENSE_EDITED'?`${event.details.before.title}: ${currency} ${event.details.before.amount} → ${event.details.after.title}: ${currency} ${event.details.after.amount}`:`${currency} ${event.details.amount||''}`}</p></div>):<p className="mt-3 text-sm text-zera-muted">No recorded changes. Older expenses retain their existing approval details.</p>}</section>}
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zera-line p-4"><div><h3 className="font-semibold">{activeRoleName==='Store Keeper'?'My expenses':'Expense history'}</h3><p className="mt-1 text-xs text-zera-muted">{total} matching records</p></div><div className="flex flex-wrap gap-2"><input aria-label="Search expenses" type="search" className="w-full rounded-lg border border-zera-line p-2.5 text-sm sm:w-60" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search title or category"/><select aria-label="Expense status" className="rounded-lg border border-zera-line p-2.5 text-sm" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option>{['PENDING','APPROVED','REJECTED'].map(s=><option key={s} value={s}>{s.charAt(0)+s.slice(1).toLowerCase()}</option>)}</select>{(search||status)&&<Button variant="ghost" onClick={()=>{setSearch('');setStatus('');setPage(1);}}>Clear</Button>}</div></div>
      <ExpenseHistory rows={rows} loading={loading} saving={saving} currency={currency} page={page} total={total} onPageChange={setPage} actions={row=><>
        {row.status==='PENDING'&&<Button variant="secondary" disabled={saving} onClick={()=>{setForm({...row,note:row.note||''});setOpen(true);window.scrollTo({top:0,behavior:'smooth'});}}>Edit</Button>}
        {activeRoleName==='Owner'&&<>{row.status==='PENDING'&&<><Button disabled={saving} onClick={()=>approve(row,'APPROVED')}>Approve</Button><Button variant="secondary" disabled={saving} onClick={()=>approve(row,'REJECTED')}>Reject</Button></>}{row.status!=='PENDING'&&Number(row.paid||0)===0&&<Button variant="secondary" disabled={saving} onClick={()=>approve(row,'PENDING')}>Reopen</Button>}{row.status==='APPROVED'&&Number(row.paid||0)<Number(row.amount)&&<Link className="rounded-lg bg-zera-green px-3 py-2 text-sm font-semibold text-white" to="/finance/payments">Record payment</Link>}</>}
        <Button variant="secondary" onClick={()=>viewHistory(row)}>View history</Button>
      </>}/>
    </section>
  </div>;
}
