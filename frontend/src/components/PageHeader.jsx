export default function PageHeader({ action, description, eyebrow, title }) {
  return (
    <header className="flex flex-col gap-4 border-b border-zera-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-zera-green">{eyebrow}</p> : null}
        <h2 className="mt-1 text-2xl font-bold text-zera-ink">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">{description}</p> : null}
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </header>
  );
}
