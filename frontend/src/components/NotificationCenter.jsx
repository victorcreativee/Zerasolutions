import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { api } from '../services/api.js';
export default function NotificationCenter({businessId,branchId,userId,collapsed}) {
  const location=useLocation();
  const key=`zera-alerts:${userId}:${businessId}:${branchId}`;
  const [alerts,setAlerts]=useState([]),[read,setRead]=useState([]),[open,setOpen]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const panel=useRef(null),button=useRef(null);
  useEffect(()=>{
    setOpen(false);setAlerts([]);setError('');setLoading(true);
    try{const value=JSON.parse(localStorage.getItem(key)||'[]');setRead(Array.isArray(value)?value.filter(item=>typeof item==='string').slice(-200):[]);}catch{setRead([]);}
    let cancelled=false,busy=false;
    async function load(){
      if(busy||document.hidden)return;busy=true;
      try{const {data}=await api.get(`/notifications/business/${businessId}`,{params:{branchId}});if(!cancelled){setAlerts(data.alerts);setError('');}}
      catch{if(!cancelled)setError('Unable to check notifications.');}
      finally{busy=false;if(!cancelled)setLoading(false);}
    }
    load();const timer=setInterval(load,60000);window.addEventListener('focus',load);
    return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',load);};
  },[key,businessId,branchId,location.pathname]);
  useEffect(()=>{
    if(!open)return;
    function close(event){if(event.type==='keydown'&&event.key==='Escape'){setOpen(false);button.current?.focus();}else if(event.type==='mousedown'&&!panel.current?.contains(event.target)&&!button.current?.contains(event.target))setOpen(false);}
    document.addEventListener('mousedown',close);document.addEventListener('keydown',close);
    return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};
  },[open]);
  function markRead(ids){
    const next=[...new Set([...read,...ids])].slice(-200);
    try{localStorage.setItem(key,JSON.stringify(next));setRead(next);}catch{setError('Read status could not be saved on this device.');}
  }
  const unread=alerts.filter(alert=>!read.includes(alert.id)).length;
  return <div className="relative border-t border-zera-line p-3">
    <button ref={button} type="button" aria-expanded={open} aria-controls="zera-notification-panel" aria-label={`Notifications${error?', unavailable':`, ${unread} unread`}`} onClick={()=>setOpen(!open)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-semibold hover:bg-zera-mintSoft"><Bell size={18}/><span className={collapsed?'lg:sr-only':''}>Notifications</span>{unread>0&&<span className="ml-auto rounded-full bg-zera-green px-2 text-xs text-white">{unread}</span>}{error&&<span className="ml-auto text-amber-700" aria-hidden="true">!</span>}</button>
    {open&&<section ref={panel} id="zera-notification-panel" aria-label="Notifications" className="absolute bottom-full left-3 z-50 mb-2 max-h-[65vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-zera-line bg-white p-4 shadow-panel">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Notifications</h2><button type="button" aria-label="Close notifications" onClick={()=>{setOpen(false);button.current?.focus();}}><X size={18}/></button></div>
      {error?<p role="status" className="text-sm text-amber-700">{error}</p>:loading?<p className="text-sm text-zera-muted">Checking…</p>:!alerts.length?<p className="text-sm text-zera-muted">No active alerts.</p>:null}
      <div className="divide-y divide-zera-line">{alerts.map(alert=><Link key={alert.id} to={alert.path} onClick={()=>{markRead([alert.id]);setOpen(false);}} className={`block py-3 text-sm ${read.includes(alert.id)?'text-zera-muted':'font-semibold text-zera-ink'}`}>{!read.includes(alert.id)&&<span aria-label="Unread" className="mr-2 inline-block h-2 w-2 rounded-full bg-zera-green"/>}{alert.title}</Link>)}</div>
      {unread>0&&<button type="button" className="mt-2 text-sm font-semibold text-zera-green" onClick={()=>markRead(alerts.map(alert=>alert.id))}>Mark all read</button>}
    </section>}
  </div>;
}
