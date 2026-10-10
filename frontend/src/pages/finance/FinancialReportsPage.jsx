import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDownLeft,ArrowUpRight,Wallet,ReceiptText,Download,ArrowRight,Info} from 'lucide-react';
import {api} from '../../services/api.js';
import {useWorkspace} from '../../context/WorkspaceContext.jsx';
import Button from '../../components/Button.jsx';
import FinanceNav from './FinanceNav.jsx';

const panel='overflow-hidden rounded-xl border border-zera-line bg-white';
const input='mt-1 block w-full rounded-lg border border-zera-line bg-white px-3 py-2.5 text-sm text-zera-ink';
function periodRange(period){
  const today=new Date(),end=today.toISOString().slice(0,10),start=new Date(today);
  if(period==='month')start.setUTCDate(1);
  if(period==='week')start.setUTCDate(start.getUTCDate()-6);
  return period==='all'?{dateFrom:'',dateTo:''}:{dateFrom:start.toISOString().slice(0,10),dateTo:end};
}
const incoming=[['SALE','Sales receipts'],['OTHER_INCOME','Other income'],['CAPITAL','Owner funding'],['LOAN','Loans received']];
const outgoing=[['EXPENSE','Expenses & salaries'],['PURCHASE','Supplier payments'],['WITHDRAWAL','Owner withdrawals']];
const number=value=>Number(value||0);
const sum=values=>values.reduce((total,value)=>total+Math.round(number(value)*100),0)/100;
function Metric({label,value,detail,icon:Icon}){
  return <div className="min-w-0 p-5"><div className="flex items-center gap-2 text-sm text-zera-muted"><Icon size={16}/>{label}</div><p className="mt-3 break-words text-2xl font-bold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-zera-muted">{detail}</p></div>;
}
function Breakdown({title,rows,format,tone='green',empty}){
  const largest=Math.max(...rows.map(row=>Math.abs(row.amount)),1);
  return <section className={panel}><h3 className="border-b border-zera-line px-5 py-4 font-semibold">{title}</h3><div className="space-y-5 p-5">{rows.some(row=>row.amount!==0)?rows.map(row=><div key={row.label}><div className="flex justify-between gap-4 text-sm"><span className="text-zera-muted">{row.label}</span><span className="font-semibold tabular-nums">{format(row.amount)}</span></div><div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-zera-surface"><div className={`h-full rounded-full ${tone==='green'?'bg-zera-green':'bg-slate-500'}`} style={{width:`${Math.abs(row.amount)/largest*100}%`}}/></div></div>):<p className="text-sm text-zera-muted">{empty}</p>}</div></section>;
}
export default function FinancialReportsPage(){
  const {activeBusinessId,activeBusiness,branches}=useWorkspace();
  const [filters,setFilters]=useState(()=>({branchId:'',...periodRange('month')}));
  const [draft,setDraft]=useState(filters),[period,setPeriod]=useState('month');
  const [report,setReport]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let cancelled=false;setReport(null);setError('');setLoading(true);
    if(!activeBusinessId){setLoading(false);return;}
    const params=Object.fromEntries(Object.entries(filters).filter(([,value])=>value));
    Promise.all([api.get(`/finance/business/${activeBusinessId}/summary`,{params}),api.get(`/finance/business/${activeBusinessId}/cashflow`,{params})])
      .then(([summary,cashflow])=>{if(!cancelled)setReport({finance:summary.data.finance,cashflow:cashflow.data,generatedAt:new Date()});})
      .catch(e=>{if(!cancelled)setError(e.response?.data?.message||'Unable to load the financial report.');})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[activeBusinessId,filters]);
  useEffect(()=>{setFilters(current=>({...current,branchId:''}));setDraft(current=>({...current,branchId:''}));},[activeBusinessId]);
  const format=value=>`${activeBusiness?.currency||'UGX'} ${number(value).toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const branchName=branches.find(branch=>branch.id===filters.branchId)?.name||'All branches';
  const rangeLabel=filters.dateFrom||filters.dateTo?`${filters.dateFrom||'Beginning'} — ${filters.dateTo||'Today'} · UTC`:'All time';
  const summary=report?.finance.summary;
  const accounts=report?.cashflow.accounts||[];
  const movement=kind=>number(report?.cashflow.movements.find(row=>row.kind===kind)?.amount);
  const inRows=incoming.map(([kind,label])=>({label,amount:movement(kind)}));
  const outRows=outgoing.map(([kind,label])=>({label,amount:movement(kind)}));
  const moneyIn=sum(inRows.map(row=>row.amount)),moneyOut=sum(outRows.map(row=>row.amount));
  const cardFunds=sum(accounts.filter(a=>a.code==='CARD_CLEARING').map(a=>a.balance));
  const available=sum(accounts.filter(a=>a.code!=='CARD_CLEARING').map(a=>a.balance));
  const netMovement=sum([moneyIn,-moneyOut]);
  const negativeAccounts=accounts.filter(a=>number(a.balance)<0);
  const tracking=report?.cashflow.tracking;
  function selectPeriod(value){setPeriod(value);if(value==='custom')return;const next={branchId:draft.branchId,...periodRange(value)};setDraft(next);setFilters(next);}
  function exportReport(){
    if(!report)return;
    const rows=[['Zera financial report',activeBusiness?.name],['Branch',branchName],['Period',rangeLabel],['Generated',report.generatedAt.toISOString()],['Currency',activeBusiness?.currency],[],['Section','Item','Amount'],['Sales','Collected',summary.collectedTotal],['Sales','Tax included',summary.taxCollected],['Sales','Excluding tax',sum([summary.collectedTotal,-summary.taxCollected])],['Expenses','Approved (not necessarily paid)',summary.approvedExpenseTotal],['Review','Pending expenses (count)',summary.pendingExpenseCount],...inRows.map(row=>['Recorded inflows',row.label,row.amount]),...outRows.map(row=>['Recorded outflows',row.label,row.amount]),['Cash movement','Net movement (not profit)',netMovement],...accounts.map(a=>['Current balance',`${a.branch} · ${a.name}`,a.balance]),...report.finance.paymentRows.map(row=>['Sales payment method',row.label,row.total]),[],['Basis','Date filters use UTC. Expenses use their recorded date. Balances are current. Journal movements begin when tracking starts; opening entries and transfers are excluded from inflows/outflows. This is not a profit-and-loss statement.']];
    const cell=value=>{let text=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;};
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`zera-financial-report-${filters.dateFrom||'all-time'}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="mx-auto max-w-[1500px] space-y-5">
    <FinanceNav/>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zera-muted">Financial overview</p><h2 className="text-2xl font-bold">Financial reports</h2><p className="mt-2 text-sm text-zera-muted">{branchName} · {rangeLabel}</p></div><Button variant="secondary" disabled={!report||loading} onClick={exportReport}><Download size={16}/>Export report</Button></header>
    <form className="flex flex-wrap items-end gap-3 rounded-xl border border-zera-line bg-white p-4" onSubmit={e=>{e.preventDefault();setFilters({...draft});setPeriod('custom');}}>
      <label className="text-xs font-medium text-zera-muted">Period<select className={input} value={period} onChange={e=>selectPeriod(e.target.value)}><option value="month">This month</option><option value="week">Last 7 days</option><option value="today">Today</option><option value="all">All time</option><option value="custom">Custom dates</option></select></label>
      <label className="text-xs font-medium text-zera-muted">Branch<select className={input} value={draft.branchId} onChange={e=>setDraft({...draft,branchId:e.target.value})}><option value="">All branches</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      {['dateFrom','dateTo'].map(key=><label key={key} className="text-xs font-medium text-zera-muted">{key==='dateFrom'?'From':'To'}<input type="date" className={input} value={draft[key]} onChange={e=>{setPeriod('custom');setDraft({...draft,[key]:e.target.value});}}/></label>)}
      <Button type="submit" disabled={loading}>Apply</Button>
    </form>
    {error&&<div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {loading&&<div role="status" className="rounded-xl border border-zera-line bg-white p-10 text-center text-sm text-zera-muted">Preparing your financial report…</div>}
    {report&&<>
      <section className={`${panel} grid divide-y divide-zera-line sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4`}>
        <Metric icon={ReceiptText} label="Sales excluding tax" value={format(sum([summary.collectedTotal,-summary.taxCollected]))} detail={`${summary.receiptCount||0} completed receipts in this period`}/>
        <Metric icon={ArrowDownLeft} label="Recorded inflows" value={accounts.length?format(moneyIn):'—'} detail="Receipts, other income and funding"/>
        <Metric icon={ArrowUpRight} label="Recorded outflows" value={accounts.length?format(moneyOut):'—'} detail="Expense, supplier and owner payments"/>
        <Metric icon={Wallet} label="Available in tracked accounts" value={accounts.length?format(available):'—'} detail="Current Cash, Bank and MoMo; excludes cards"/>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-zera-line px-5 py-4"><h3 className="font-semibold">Money movement</h3><span className="text-xs text-zera-muted">Selected period · net of corrections</span></div><div className="grid gap-6 p-5 sm:grid-cols-2">{[[inRows,'Money in'],[outRows,'Money out']].map(([rows,title])=><div key={title}><p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zera-muted">{title}</p>{rows.map(row=><div key={row.label} className="flex justify-between gap-4 py-2 text-sm"><span className="text-zera-muted">{row.label}</span><span className="text-right font-medium tabular-nums">{format(row.amount)}</span></div>)}</div>)}</div><div className="flex flex-wrap justify-between gap-3 border-t border-zera-line bg-zera-mintSoft px-5 py-4"><div><p className="font-semibold">Net recorded movement</p><p className="mt-1 text-xs text-zera-muted">Inflows minus outflows. Not profit.</p></div><p className={`text-xl font-bold tabular-nums ${netMovement<0?'text-red-700':'text-zera-green'}`}>{accounts.length?format(netMovement):'—'}</p></div></section>
        <section className={panel}><h3 className="border-b border-zera-line px-5 py-4 font-semibold">Needs attention</h3><div className="divide-y divide-zera-line">
          {!accounts.length&&<Insight title="Set up money tracking" text="Enter opening balances to start a cashbook for this selection." to="/finance/accounts"/>}
          {tracking&&tracking.tracked<tracking.branches&&accounts.length>0&&<Insight title={`${tracking.tracked} of ${tracking.branches} branches tracked`} text="Account totals cover only branches with money tracking enabled." to="/finance/accounts"/>}
          {number(summary.pendingExpenseCount)>0&&<Insight title={`${summary.pendingExpenseCount} expenses awaiting approval`} text="Recorded within the selected period." to="/finance/expenses"/>}
          {negativeAccounts.length>0&&<Insight title={`${negativeAccounts.length} accounts below zero`} text="Review their movements and reconcile the recorded balances." to="/finance/accounts"/>}
          {cardFunds>0&&<Insight title={`${format(cardFunds)} awaiting card settlement`} text="Record the transfer to Bank when the payment provider settles." to="/finance/accounts"/>}
          {accounts.length>0&&!number(summary.pendingExpenseCount)&&!negativeAccounts.length&&cardFunds<=0&&(!tracking||tracking.tracked===tracking.branches)&&<p className="p-5 text-sm text-zera-muted">No pending approvals or account balance alerts in this view.</p>}
        </div></section>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Breakdown title="Sales by payment method" rows={report.finance.paymentRows.map(row=>({label:row.label,amount:number(row.total)}))} format={format} empty="No completed sales in this period."/>
        <section className={panel}><div className="flex items-center justify-between border-b border-zera-line px-5 py-4"><h3 className="font-semibold">Sales & expenses</h3><span className="text-xs text-zera-muted">Selected period</span></div><dl className="divide-y divide-zera-line px-5">{[['Sales collected',summary.collectedTotal],['Tax included',summary.taxCollected],['Sales excluding tax',sum([summary.collectedTotal,-summary.taxCollected])],['Approved expenses & salaries',summary.approvedExpenseTotal]].map(([label,value])=><div className="flex justify-between gap-4 py-4 text-sm" key={label}><dt className="text-zera-muted">{label}</dt><dd className="text-right font-semibold tabular-nums">{format(value)}</dd></div>)}</dl><p className="px-5 pb-5 text-xs text-zera-muted">Approved expenses are commitments, not proof of payment.</p></section>
      </div>
      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-zera-line px-5 py-4"><div><h3 className="font-semibold">Current account balances</h3><p className="mt-1 text-xs text-zera-muted">All recorded history; not limited by the report dates.</p></div><Link className="text-sm font-semibold text-zera-green" to="/finance/accounts">Open cashbook →</Link></div>{accounts.length?<div className="grid divide-y divide-zera-line sm:grid-cols-2 xl:grid-cols-3">{accounts.map(account=><div key={account.id} className="flex items-start justify-between gap-3 p-5"><div><p className="font-medium">{account.name}</p><p className="mt-1 text-xs text-zera-muted">{account.branch}</p>{account.code==='CARD_CLEARING'&&<p className="mt-1 text-xs text-zera-muted">Awaiting settlement</p>}</div><span className={`text-right font-semibold tabular-nums ${number(account.balance)<0?'text-red-700':''}`}>{format(account.balance)}</span></div>)}</div>:<p className="p-5 text-sm text-zera-muted">No tracked accounts.</p>}</section>
      <details className="rounded-lg border border-zera-line px-4 py-3 text-sm text-zera-muted"><summary className="cursor-pointer font-medium">Report basis</summary><p className="mt-3 leading-relaxed">Date ranges use UTC. Expenses use their recorded date. Money movements include only entries recorded since tracking began, with corrections deducted. Opening balances and internal transfers are excluded from inflows and outflows. Owner funding and loans are not sales revenue. This report is not a profit-and-loss statement.</p><p className="mt-2 text-xs">Generated {report.generatedAt.toLocaleString()}</p></details>
    </>}
  </div>;
}
function Insight({title,text,to}){return <Link to={to} className="flex items-start gap-3 p-5 hover:bg-zera-mintSoft"><Info size={17} className="mt-0.5 shrink-0 text-zera-green"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-zera-muted">{text}</p></div><ArrowRight size={15} className="mt-1 shrink-0 text-zera-muted"/></Link>;}
