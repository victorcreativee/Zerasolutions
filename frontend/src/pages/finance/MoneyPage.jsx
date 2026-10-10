import { useEffect, useRef, useState } from 'react';
import {MoneyHistory} from './FinanceHistory.jsx';
import FinanceNav from './FinanceNav.jsx';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { api } from '../../services/api.js';
import Button from '../../components/Button.jsx';
import Pagination from '../../components/Pagination.jsx';

const labels={TRANSFER:'Transfer',CAPITAL:'Owner investment',LOAN:'Loan received',OTHER_INCOME:'Other income',WITHDRAWAL:'Owner withdrawal',EXPENSE:'Expense payment',PURCHASE:'Purchase payment',SALE:'Sale',OPENING:'Opening balance'};
const codes={CASH:'Cash',BANK:'Bank',MOMO:'Mobile Money',CARD_CLEARING:'Card payments awaiting settlement'};
const emptyOpening=()=>Object.fromEntries(Object.keys(codes).map(key=>[key,'0']));
const inputClass='mt-1 w-full rounded-md border border-zera-line bg-white p-2.5 text-sm';

export default function MoneyPage({view='accounts'}){
  const {activeBusinessId,activeBusiness,activeBranchId,branches}=useWorkspace();
  const [branchId,setBranchId]=useState(activeBranchId),[data,setData]=useState(null),[page,setPage]=useState(1);
  const [accountId,setAccountId]=useState('');
  const [historyFilters,setHistoryFilters]=useState({search:'',dateFrom:'',dateTo:''});
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
  const [opening,setOpening]=useState(emptyOpening),[confirmed,setConfirmed]=useState(false),[form,setForm]=useState(null),[correction,setCorrection]=useState(null);
  const busy=useRef(false),generation=useRef(0);
  const format=value=>`${activeBusiness?.currency||'UGX'} ${Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  useEffect(()=>{setBranchId(activeBranchId);setAccountId('');setPage(1);setData(null);setForm(null);setCorrection(null);setOpening(emptyOpening());setConfirmed(false);},[activeBusinessId,activeBranchId]);
  useEffect(()=>{if(branchId&&activeBusinessId)load();return()=>{generation.current+=1;};},[activeBusinessId,branchId,page,accountId,view,historyFilters]);
  useEffect(()=>{setPage(1);setForm(null);setCorrection(null);},[view]);
  async function load(){
    const ticket=++generation.current;setLoading(true);setError('');
    try{const result=await api.get(`/money/business/${activeBusinessId}`,{params:{branchId,page,accountId,view,...historyFilters}});if(ticket===generation.current)setData(result.data);}
    catch(e){if(ticket===generation.current){setData(current=>current?{...current,postings:[],total:0}:null);setError(e.response?.data?.message||'Unable to load money accounts.');}}
    finally{if(ticket===generation.current)setLoading(false);}
  }
  async function exportHistory(){
    setExporting(true);setError('');
    try {
      const response=await api.get(`/money/business/${activeBusinessId}/export`,{params:{branchId,accountId,view,...historyFilters},responseType:'blob'});
      const url=URL.createObjectURL(response.data),link=document.createElement('a');
      link.href=url;link.download='zera-money-history.csv';document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){let message='Unable to export money history.';try{message=JSON.parse(await e.response.data.text()).message||message;}catch{}setError(message);}
    finally{setExporting(false);}
  }
  async function save(path,body,success){
    if(busy.current)return;busy.current=true;setSaving(true);setError('');setMessage('');
    try{await api.post(`/money/business/${activeBusinessId}${path}`,body);setForm(null);setCorrection(null);setMessage(success);if(page===1)await load();else setPage(1);}
    catch(e){setError(e.response?.data?.message||'The result could not be confirmed. Retry the same entry; its reference prevents a duplicate.');}
    finally{busy.current=false;setSaving(false);}
  }
  function newMovement(kind){setCorrection(null);setError('');setMessage('');setForm({kind,fromAccountId:'',toAccountId:'',sourceId:'',amount:'',note:'',requestKey:crypto.randomUUID()});}
  const accounts=data?.accounts||[],documents=data?.documents||[],started=accounts.length>0;
  const funding=form&&['CAPITAL','LOAN','OTHER_INCOME'].includes(form.kind);
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const accountSelect=(key,label,list)=><label className="block text-sm font-medium">{label}<select required disabled={saving} className={inputClass} value={form[key]} onChange={event=>update(key,event.target.value)}><option value="">Choose account</option>{list.map(account=><option key={account.id} value={account.id}>{account.name} · {format(account.balance)}</option>)}</select></label>;
  return <div className="mx-auto max-w-[1500px] space-y-5">
    <FinanceNav/><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{view==='income'?'Income':view==='payments'?'Payments':'Money accounts'}</h2><p className="mt-1 text-sm text-zera-muted">{view==='income'?'Sales receipts and additional income.':view==='payments'?'Pay approved expenses, salaries and suppliers.':'Where your business money is held and used.'}</p></div><label className="text-sm">Branch<select aria-label="Money account branch" disabled={saving} className={inputClass} value={branchId||''} onChange={e=>{setBranchId(e.target.value);setAccountId('');setPage(1);setData(null);setForm(null);setCorrection(null);setOpening(emptyOpening());setConfirmed(false);}}>{branches.filter(branch=>branch.status==='ACTIVE').map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></header>
    {error&&<div role="alert" className="rounded-md bg-red-50 p-3 text-red-700">{error}</div>}
    {message&&<div role="status" className="rounded-md bg-zera-mintSoft p-3 text-zera-green">{message}</div>}
    {loading&&<p role="status" className="text-sm text-zera-muted">Loading accounts…</p>}
    {!loading&&data&&!started&&<form className="rounded-md border border-zera-line bg-white p-5 space-y-4" onSubmit={e=>{e.preventDefault();if(confirmed)save('/start',{branchId,opening},'Money tracking started. New receipts will now update these accounts.');}}>
      <h3 className="font-bold">Start money tracking</h3><p className="text-sm text-zera-muted">Enter the money actually available now. Past receipts and payments will not be imported. Start while checkout is paused.</p>
      <div className="grid gap-4 sm:grid-cols-2">{Object.entries(codes).map(([code,label])=><label key={code} className="text-sm">{label}<input required disabled={saving} type="number" min="0" max="9999999999.99" step="0.01" className={inputClass} value={opening[code]} onChange={e=>setOpening({...opening,[code]:e.target.value})}/></label>)}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" required disabled={saving} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>These are the actual balances for this branch.</label><Button type="submit" disabled={saving||!confirmed}>{saving?'Starting…':'Start tracking'}</Button>
    </form>}
    {started&&<>
      {view==='accounts'&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{accounts.map(account=><section key={account.id} className="rounded-md border border-zera-line bg-white p-5"><p className="text-sm text-zera-muted">{account.name}</p><p className={`mt-2 text-xl font-bold ${Number(account.balance)<0?'text-red-700':''}`}>{format(account.balance)}</p>{account.code==='CARD_CLEARING'&&<p className="mt-2 text-xs text-zera-muted">Transfer to Bank once settled.</p>}{Number(account.balance)<0&&<p className="mt-2 text-xs text-red-700">Reconcile this account before making payments.</p>}</section>)}</div>}
      <div className="flex flex-wrap items-center gap-2">{view!=='payments'&&<Button disabled={saving} onClick={()=>newMovement(view==='income'?'OTHER_INCOME':'CAPITAL')}>{view==='income'?'Record income':'Add money'}</Button>}{view==='accounts'&&<><Button variant="secondary" disabled={saving} onClick={()=>newMovement('TRANSFER')}>Transfer</Button><Button variant="secondary" disabled={saving} onClick={()=>newMovement('WITHDRAWAL')}>Owner withdrawal</Button></>}{view==='payments'&&<><Button disabled={saving} onClick={()=>newMovement('EXPENSE')}>Pay expense or salary</Button><Button variant="secondary" disabled={saving} onClick={()=>newMovement('PURCHASE')}>Pay supplier</Button></>}<Link className="ml-auto text-sm font-semibold text-zera-green underline" to="/finance/expenses">Review expenses</Link></div>
      {form&&<form className="rounded-md border border-zera-line bg-white p-5 space-y-4" onSubmit={e=>{e.preventDefault();save('/movements',{...form,branchId},'Money movement recorded.');}}>
        <h3 className="font-bold">{labels[form.kind]}</h3>{documents.find(item=>item.id===form.sourceId)?.predatesTracking&&<p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">This document predates money tracking. Check earlier payments and record only the amount paid now; earlier payments are already included in opening balances.</p>}<div className="grid gap-4 sm:grid-cols-2">
          {funding&&<label className="text-sm">Source of additional money<select disabled={saving} className={inputClass} value={form.kind} onChange={e=>update('kind',e.target.value)}>{['CAPITAL','LOAN','OTHER_INCOME'].map(kind=><option key={kind} value={kind}>{labels[kind]}</option>)}</select></label>}
          {!funding&&accountSelect('fromAccountId','Pay from',accounts.filter(account=>form.kind==='TRANSFER'||account.code!=='CARD_CLEARING'))}
          {(funding||form.kind==='TRANSFER')&&accountSelect('toAccountId','Receive into',accounts.filter(account=>account.id!==form.fromAccountId&&(!funding||account.code!=='CARD_CLEARING')))}
          {['EXPENSE','PURCHASE'].includes(form.kind)&&<label className="text-sm">{form.kind==='EXPENSE'?'Approved expense':'Approved purchase'}<select required disabled={saving} className={inputClass} value={form.sourceId} onChange={e=>{const document=documents.find(item=>item.id===e.target.value&&item.kind===form.kind);setForm({...form,sourceId:e.target.value,amount:document?.predatesTracking?'':document?.outstanding||''});}}><option value="">Choose unpaid document</option>{documents.filter(item=>item.kind===form.kind).map(item=><option key={item.id} value={item.id}>{item.label} · {item.predatesTracking?'Verify amount due':format(item.outstanding)+' due'}</option>)}</select></label>}
          <label className="text-sm">Amount ({activeBusiness?.currency})<input required disabled={saving} type="number" min="0.01" max="9999999999.99" step="0.01" className={inputClass} value={form.amount} onChange={e=>update('amount',e.target.value)}/></label>
          <label className="text-sm sm:col-span-2">Reference or reason<input required disabled={saving} maxLength={1000} className={inputClass} value={form.note} onChange={e=>update('note',e.target.value)}/></label>
        </div><div className="flex gap-2"><Button type="submit" disabled={saving}>{saving?'Recording…':'Record movement'}</Button><Button type="button" variant="secondary" disabled={saving} onClick={()=>setForm(null)}>Cancel</Button></div>
      </form>}
      {correction&&<form className="rounded-md border border-amber-200 bg-amber-50 p-5 space-y-3" onSubmit={e=>{e.preventDefault();save(`/postings/${correction.id}/reverse`,{note:correction.note},'Correction recorded. The original entry remains in history.');}}><h3 className="font-bold">Reverse incorrect entry</h3><p className="text-sm">This reverses the account movement. Use this only to correct a recording mistake.</p><label className="block text-sm">Reason<input required disabled={saving} maxLength={1000} className={inputClass} value={correction.note} onChange={e=>setCorrection({...correction,note:e.target.value})}/></label><div className="flex gap-2"><Button disabled={saving} type="submit">Confirm correction</Button><Button disabled={saving} type="button" variant="secondary" onClick={()=>setCorrection(null)}>Cancel</Button></div></form>}
      <section className="overflow-hidden rounded-xl border border-zera-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zera-line p-4"><div><h3 className="font-semibold">{view==='income'?'Income history':view==='payments'?'Payment history':'Money history'}</h3><p className="mt-1 text-xs text-zera-muted">{data.total} matching movements</p></div><Button variant="secondary" disabled={exporting||loading||saving} onClick={exportHistory}>{exporting?'Exporting…':'Export CSV'}</Button></div>
        <div className="flex flex-wrap items-end gap-3 border-b border-zera-line p-4"><label className="min-w-0 flex-1 text-xs text-zera-muted">Search<input type="search" className={inputClass} placeholder="Reference or note" value={historyFilters.search} onChange={e=>{setHistoryFilters({...historyFilters,search:e.target.value});setPage(1);}}/></label><label className="text-xs text-zera-muted">Account<select className={inputClass} value={accountId} disabled={saving} onChange={e=>{setAccountId(e.target.value);setPage(1);}}><option value="">All accounts</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label><details className="text-sm"><summary className="cursor-pointer rounded-lg border border-zera-line px-3 py-2.5">Dates (UTC)</summary><div className="mt-2 flex flex-wrap gap-2">{['dateFrom','dateTo'].map(key=><label key={key} className="text-xs text-zera-muted">{key==='dateFrom'?'From':'To'}<input type="date" className={inputClass} value={historyFilters[key]} onChange={e=>{setHistoryFilters({...historyFilters,[key]:e.target.value});setPage(1);}}/></label>)}</div></details>{(accountId||Object.values(historyFilters).some(Boolean))&&<Button variant="ghost" onClick={()=>{setAccountId('');setHistoryFilters({search:'',dateFrom:'',dateTo:''});setPage(1);}}>Clear</Button>}</div>
        <MoneyHistory rows={data.postings} loading={loading} saving={saving} format={format} labels={labels} accountId={accountId} onCorrect={posting=>{setForm(null);setCorrection({id:posting.id,note:''});window.scrollTo({top:0,behavior:'smooth'});}}/>
        <Pagination page={page} pageSize={10} total={data.total} onPageChange={setPage} loading={loading||saving}/>
      </section>
      <p className="text-xs text-zera-muted">Tracked since {new Date(accounts[0].createdAt).toLocaleString()}. Balances include all recorded movements, not just today’s sales.</p>
    </>}
  </div>;
}
