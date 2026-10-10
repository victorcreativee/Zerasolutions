export default function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="flex min-h-24 min-w-0 items-center gap-4 rounded-xl border border-zera-line bg-white p-5">
      {Icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
          <Icon size={18} />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-medium text-zera-muted">{label}</p>
        <p className="mt-1 break-words text-2xl font-bold tracking-tight text-zera-ink">{value}</p>
        {helper ? <p className="mt-1 hidden truncate text-xs text-zera-muted sm:block">{helper}</p> : null}
      </div>
    </article>
  );
}
