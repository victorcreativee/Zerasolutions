export default function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="flex min-h-16 min-w-0 items-center gap-3 rounded-md border border-zera-line bg-white p-3 shadow-xs">
      {Icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
          <Icon size={18} />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-zera-muted">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-zera-ink">{value}</p>
        {helper ? <p className="mt-1 hidden truncate text-xs text-zera-muted sm:block">{helper}</p> : null}
      </div>
    </article>
  );
}
