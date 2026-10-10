import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function usePagination(rows, pageSize = 10) {
  const identity = rows.map(row => row.id ?? JSON.stringify(row)).join('|');
  const [selection, setSelection] = useState({ identity, page: 1 });
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = selection.identity === identity ? Math.min(selection.page, pages) : 1;
  const onPageChange = next => setSelection({ identity, page: Math.max(1, Math.min(next, pages)) });
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length, onPageChange };
}

export default function Pagination({ page, pageSize, total, onPageChange, loading = false }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  return <nav aria-label="Table pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-zera-line px-4 py-3 text-sm">
    <span className="text-zera-muted" aria-live="polite">{loading ? 'Loading…' : total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : '0 results'}</span>
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Previous page" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} className="pagination-button"><ChevronLeft size={16} /></button>
      {numbers.map(number => <button type="button" key={number} aria-label={`Page ${number}`} aria-current={number === page ? 'page' : undefined} disabled={loading} onClick={() => onPageChange(number)} className={`pagination-button ${number === page ? 'bg-zera-mint text-zera-green font-bold' : ''}`}>{number}</button>)}
      <button type="button" aria-label="Next page" disabled={loading || page >= pages} onClick={() => onPageChange(page + 1)} className="pagination-button"><ChevronRight size={16} /></button>
    </div>
  </nav>;
}
