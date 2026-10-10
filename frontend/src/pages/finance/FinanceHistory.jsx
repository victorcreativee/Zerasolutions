import {useEffect,useRef,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,ArrowLeftRight,ReceiptText} from 'lucide-react';
import Button from '../../components/Button.jsx';
import Pagination from '../../components/Pagination.jsx';

export function FinanceBadge({children,tone='neutral'}) {
  const colors={neutral:'bg-slate-100 text-slate-600',good:'bg-emerald-50 text-emerald-800',pending:'bg-amber-50 text-amber-800',danger:'bg-red-50 text-red-700'};
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors[tone]}`}>{children}</span>;
}
const date=value=>new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
const cell='px-4 py-3 align-top';
function Empty({loading,text}) {return <div role="status" className="flex flex-col items-center gap-2 p-10 text-sm text-zera-muted"><ReceiptText size={24}/>{loading?'Loading history…':text}</div>;}

export function ExpenseHistory({rows,loading,saving,currency,page,total,onPageChange,actions}) {
  const [selected,setSelected]=useState(null);
  const current=rows.find(row=>row.id===selected);
  const detailRef=useRef(null);
  useEffect(()=>{if(current){detailRef.current?.focus({preventScroll:true});detailRef.current?.scrollIntoView({block:'nearest'});}},[selected]);
  const fmt=value=>`${currency} ${Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const approval=row=><FinanceBadge tone={row.status==='APPROVED'?'good':row.status==='REJECTED'?'danger':'pending'}>{row.status==='APPROVED'?'Approved':row.status==='REJECTED'?'Rejected':'Pending'}</FinanceBadge>;
  const payment=row=>row.status!=='APPROVED'?<span className="text-zera-muted">—</span>:<div><FinanceBadge tone={Number(row.paid)>=Number(row.amount)?'good':'neutral'}>{Number(row.paid)>=Number(row.amount)?'Paid':Number(row.paid)>0?'Part paid':'Unpaid'}</FinanceBadge>{Number(row.paid)>0&&<p className="mt-1 text-xs text-zera-muted">{fmt(row.paid)} paid</p>}</div>;
  const review=row=><button type="button" disabled={saving} aria-expanded={selected===row.id} onClick={()=>setSelected(selected===row.id?null:row.id)} className="rounded-lg border border-zera-line px-3 py-2 text-sm font-semibold text-zera-green">Review</button>;
  return <>
    {loading||!rows.length?<Empty loading={loading} text="No expenses match these filters."/>:<>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b border-zera-line text-zera-muted">{['Expense','Branch / date','Approval','Payment','Amount',''].map((label,i)=><th key={i} className={`${cell} ${label==='Amount'?'text-right':''}`}>{label||<span className="sr-only">Actions</span>}</th>)}</tr></thead><tbody className="divide-y divide-zera-line">{rows.map(row=><tr key={row.id} className={row.id===selected?'bg-zera-mintSoft':'hover:bg-zera-mintSoft/50'}><td className={cell}><p className="max-w-xs break-words font-semibold">{row.title}</p><p className="mt-1 text-xs text-zera-muted">{row.category}</p></td><td className={cell}><p>{row.branch?.name}</p><p className="mt-1 text-xs text-zera-muted">{date(row.createdAt)}</p></td><td className={cell}>{approval(row)}</td><td className={cell}>{payment(row)}</td><td className={`${cell} whitespace-nowrap text-right font-semibold tabular-nums`}>{fmt(row.amount)}</td><td className={`${cell} text-right`}>{review(row)}</td></tr>)}</tbody></table></div>
      <div className="divide-y divide-zera-line md:hidden">{rows.map(row=><article key={row.id} className="space-y-3 p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{row.title}</p><p className="mt-1 text-xs text-zera-muted">{row.category} · {row.branch?.name}</p></div><p className="shrink-0 text-sm font-semibold">{fmt(row.amount)}</p></div><div className="flex flex-wrap items-center gap-2">{approval(row)}{payment(row)}<span className="ml-auto text-xs text-zera-muted">{date(row.createdAt)}</span>{review(row)}</div></article>)}</div>
    </>}
    {current&&!loading&&<div ref={detailRef} tabIndex={-1} aria-label="Entry details" className="border-t border-zera-line bg-zera-mintSoft p-5"><div className="flex justify-between gap-4"><div><h4 className="font-semibold">{current.title}</h4><p className="mt-1 text-sm text-zera-muted">Recorded by {current.recordedBy?.name||'Staff'}{current.approvedBy?.name?` · Approved by ${current.approvedBy.name}`:''}</p>{current.note&&<p className="mt-2 whitespace-pre-wrap break-words text-sm">{current.note}</p>}{current.status==='APPROVED'&&<p className="mt-2 text-sm font-medium">Remaining: {fmt(Math.max(0,Number(current.amount)-Number(current.paid||0)))}</p>}</div><Button variant="ghost" onClick={()=>setSelected(null)}>Close</Button></div><div className="mt-4 flex flex-wrap gap-2">{actions(current)}</div></div>}
    <Pagination page={page} pageSize={10} total={total} onPageChange={onPageChange} loading={loading||saving}/>
  </>;
}

export function MoneyHistory({rows,loading,saving,format,labels,accountId,onCorrect}) {
  const [selected,setSelected]=useState(null),current=rows.find(row=>row.id===selected);
  const detailRef=useRef(null);
  useEffect(()=>{if(current){detailRef.current?.focus({preventScroll:true});detailRef.current?.scrollIntoView({block:'nearest'});}},[selected]);
  const lines=row=>row.entries.filter(entry=>entry.account.kind==='ASSET'&&(!accountId||entry.account.id===accountId));
  const status=row=><FinanceBadge tone={row.correctedById?'neutral':row.reversesId?'pending':'good'}>{row.correctedById?'Reversed':row.reversesId?'Correction':'Recorded'}</FinanceBadge>;
  const icon=row=>{const amount=lines(row).reduce((sum,line)=>sum+Number(line.amount),0);const Icon=row.kind==='TRANSFER'?ArrowLeftRight:amount<0?ArrowUpRight:ArrowDownLeft;return <Icon size={17} aria-hidden="true"/>;};
  const accounts=row=><div className="space-y-1">{lines(row).map(entry=><p key={entry.account.id} className="text-xs"><span className="text-zera-muted">{entry.account.name}</span><span className={`ml-2 tabular-nums ${Number(entry.amount)<0?'text-red-700':'text-zera-green'}`}>{Number(entry.amount)>0?'+':''}{format(entry.amount)}</span></p>)}</div>;
  const review=row=><button type="button" aria-expanded={selected===row.id} disabled={saving} className="rounded-lg border border-zera-line px-3 py-2 text-sm font-semibold text-zera-green" onClick={()=>setSelected(selected===row.id?null:row.id)}>Details</button>;
  if(loading||!rows.length)return <Empty loading={loading} text="No movements match these filters."/>;
  return <>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-zera-line text-zera-muted">{['Movement','Date / recorded by','Account movement','Status','Amount',''].map((label,i)=><th key={i} className={`${cell} ${label==='Amount'?'text-right':''}`}>{label||<span className="sr-only">Actions</span>}</th>)}</tr></thead><tbody className="divide-y divide-zera-line">{rows.map(row=><tr key={row.id} className={selected===row.id?'bg-zera-mintSoft':'hover:bg-zera-mintSoft/50'}><td className={cell}><div className="flex items-center gap-2 font-semibold">{icon(row)}{labels[row.kind]||row.kind}</div><p className="mt-1 max-w-xs truncate text-xs text-zera-muted" title={row.note}>{row.note}</p></td><td className={cell}><p>{date(row.createdAt)}</p><p className="mt-1 text-xs text-zera-muted">{row.recordedBy?.name}</p></td><td className={cell}>{accounts(row)}</td><td className={cell}>{status(row)}</td><td className={`${cell} whitespace-nowrap text-right font-semibold`}>{format(Math.abs(Number(row.amount)))}</td><td className={cell}>{review(row)}</td></tr>)}</tbody></table></div>
    <div className="divide-y divide-zera-line md:hidden">{rows.map(row=><article key={row.id} className="space-y-3 p-4"><div className="flex justify-between gap-3"><p className="flex items-center gap-2 font-semibold">{icon(row)}{labels[row.kind]||row.kind}</p><p className="shrink-0 text-sm font-semibold">{format(Math.abs(Number(row.amount)))}</p></div>{accounts(row)}<div className="flex flex-wrap items-center gap-2">{status(row)}<span className="text-xs text-zera-muted">{date(row.createdAt)}</span><span className="ml-auto">{review(row)}</span></div></article>)}</div>
    {current&&<div ref={detailRef} tabIndex={-1} aria-label="Entry details" className="border-t border-zera-line bg-zera-mintSoft p-5"><div className="flex justify-between gap-3"><h4 className="font-semibold">{labels[current.kind]} details</h4><Button variant="ghost" onClick={()=>setSelected(null)}>Close</Button></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{current.note}</p><p className="mt-2 text-xs text-zera-muted">{new Date(current.createdAt).toLocaleString()} · {current.recordedBy?.name}</p><p className="mt-1 break-all text-xs text-zera-muted">Reference: {current.id}</p>{current.kind!=='SALE'&&!current.reversesId&&!current.correctedById&&<Button className="mt-4" variant="secondary" disabled={saving} onClick={()=>onCorrect(current)}>Correct entry</Button>}</div>}
  </>;
}
