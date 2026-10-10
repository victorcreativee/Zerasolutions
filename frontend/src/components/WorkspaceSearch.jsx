import { useEffect, useRef, useState } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WorkspaceSearch({ navigation }) {
  const dialog = useRef(null);
  const [query, setQuery] = useState('');
  const open = () => { setQuery(''); dialog.current?.showModal(); };
  useEffect(() => {
    const keydown = event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); } };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  const items = navigation.flatMap(group => group.items).filter(item => item.label.toLowerCase().includes(query.toLowerCase().trim()));
  return <>
    <button type="button" onClick={open} className="flex min-h-10 w-full max-w-md items-center gap-3 text-left text-sm text-zera-muted" aria-label="Find a page">
      <Search size={18} /><span className="flex-1">Find a page…</span><kbd className="hidden rounded border border-zera-line px-1.5 py-0.5 text-xs sm:block">⌘ / Ctrl K</kbd>
    </button>
    <dialog ref={dialog} className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-xl border border-zera-line bg-white p-0 text-zera-ink shadow-xl backdrop:bg-black/25" aria-label="Find a page">
      <div className="flex items-center gap-3 border-b border-zera-line p-4"><Search size={18} /><input autoFocus aria-label="Search pages" className="min-w-0 flex-1 outline-none" placeholder="Search pages…" value={query} onChange={event => setQuery(event.target.value)} /><button type="button" aria-label="Close search" onClick={() => dialog.current.close()}><X size={18} /></button></div>
      <div className="max-h-[60vh] overflow-y-auto p-2">{items.map(item => <Link key={item.path} to={item.path} onClick={() => dialog.current.close()} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-zera-mintSoft"><item.icon size={18} /><span className="flex-1">{item.label}</span><ArrowRight size={14} /></Link>)}{!items.length && <p className="p-5 text-sm text-zera-muted">No matching pages.</p>}</div>
    </dialog>
  </>;
}
