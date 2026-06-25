export default function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <article className="flex min-h-20 min-w-0 items-center gap-3 rounded-md border border-zera-line bg-white p-3 sm:min-h-24 sm:p-4">
      {Icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green sm:h-10 sm:w-10">
          <Icon size={19} />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase text-zera-muted">{label}</p>
        <p className="mt-1 truncate text-xl font-bold text-zera-ink">{value}</p>
        {helper ? <p className="mt-1 hidden truncate text-xs text-zera-muted sm:block">{helper}</p> : null}
      </div>
    </article>
  );
}
