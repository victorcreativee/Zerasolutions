export default function PageHeader({ action, description, eyebrow, title }) {
  return (
    <header className="flex flex-col gap-3 border-b border-zera-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zera-green">{eyebrow}</p> : null}
        <h2 className="mt-0.5 text-xl font-bold tracking-tight text-zera-ink sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">{description}</p> : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </header>
  );
}
