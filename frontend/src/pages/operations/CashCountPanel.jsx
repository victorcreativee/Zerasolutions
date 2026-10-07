import { useRef, useState } from 'react';
import Button from '../../components/Button.jsx';
import { recordCashCount } from '../../services/operationsService.js';
const format=(value,currency)=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format(Number(value));
export default function CashCountPanel({businessId,branchId,date,currency,cashSales,records,onSaved}) {
  const [form,setForm]=useState({opening:'0',cashIn:'0',cashOut:'0',counted:'',note:''});
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const busy=useRef(false),attempt=useRef(null);
  const expected=Math.round((Number(form.opening)+Number(cashSales)+Number(form.cashIn)-Number(form.cashOut))*100)/100;
  const difference=form.counted===''?null:Math.round((Number(form.counted)-expected)*100)/100;
  async function save(event){
    event.preventDefault();if(busy.current)return;
    busy.current=true;setSaving(true);setError('');
    try{
      const start=new Date(`${date}T00:00:00`),end=new Date(start);end.setDate(end.getDate()+1);
      const body={...form,branchId,date,startOffset:start.getTimezoneOffset(),endOffset:end.getTimezoneOffset(),previewCashSales:Number(cashSales).toFixed(2)};
      const fingerprint=JSON.stringify(body);
      if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()};
      await recordCashCount(businessId,{...body,requestKey:attempt.current.key});
      onSaved();
    }catch(error){setError(error.response?.data?.message || 'Unable to save cash count. Retry with the same values.');}
    finally{busy.current=false;setSaving(false);}
  }
  return <section className="rounded-md border border-zera-line bg-white p-4 shadow-xs">
    <details>
      <summary className="cursor-pointer font-bold">Cash count</summary>
      <form onSubmit={save} className="mt-4 space-y-3">
        <p className="text-xs text-zera-muted">Opening cash + cash sales + other cash in − cash out. Enter drawer movements manually, including expenses; this record does not change Finance or close a shift.</p>
        <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-4">
          {[['opening','Opening cash'],['cashIn','Other cash in'],['cashOut','Cash out'],['counted','Counted cash']].map(([key,label])=><label className="text-sm" key={key}>{label}<input required type="number" min="0" max="9999999999.99" step="0.01" value={form[key]} onChange={event=>setForm({...form,[key]:event.target.value})} className="mt-1 w-full rounded-md border border-zera-line px-3 py-2" /></label>)}
        </fieldset>
        <div className="flex flex-wrap gap-4 text-sm"><span>Cash sales <strong>{format(cashSales,currency)}</strong></span><span>Expected <strong>{format(expected,currency)}</strong></span><span>Difference <strong>{difference===null?'—':format(difference,currency)}</strong></span></div>
        <label className="block text-sm">Note{difference ? ' (required for a difference)' : ''}<input disabled={saving} required={Boolean(difference)} maxLength={1000} value={form.note} onChange={event=>setForm({...form,note:event.target.value})} className="mt-1 w-full rounded-md border border-zera-line px-3 py-2" /></label>
        {error && <div role="alert" className="text-sm text-red-700">{error} <button type="button" className="underline" onClick={onSaved}>Reload summary</button></div>}
        <Button disabled={saving || !branchId || expected<0} type="submit">{saving?'Saving…':'Save cash count'}</Button>
      </form>
    </details>
    {records.length>0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left text-xs text-zera-muted">Latest 20 counts for this date · saved totals do not change after later sales or voids</caption><thead><tr>{['Recorded','Expected','Counted','Difference','Note'].map(label=><th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{records.map(record=><tr key={record.id} className="border-t border-zera-line"><td className="p-2">{new Date(record.createdAt).toLocaleString()}<span className="block text-xs text-zera-muted">{record.recordedBy.name}</span></td>{['expected','counted','difference'].map(key=><td key={key} className="p-2 whitespace-nowrap">{format(record[key],record.currency)}</td>)}<td className="max-w-xs break-words p-2">{record.note || '—'}</td></tr>)}</tbody></table></div>}
  </section>;
}
