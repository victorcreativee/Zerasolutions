export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="grid min-h-screen overflow-x-hidden bg-[#f7faf8] lg:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.05fr)]">
      <section className="hidden min-w-0 overflow-hidden bg-zera-ink px-8 py-10 text-white xl:px-12 lg:flex lg:flex-col lg:justify-between">
        <div className="min-w-0">
          <div className="text-xl font-bold tracking-wide">Zera Solutions</div>
          <div className="mt-14 max-w-xl">
            <p className="text-sm font-semibold uppercase text-emerald-200">Business management for African SMEs</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight xl:text-5xl">Enterprise power with a simple human experience.</h1>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-3 text-sm text-emerald-50/90 xl:gap-4">
          <div className="min-w-0 rounded-md border border-white/10 bg-white/5 p-4">Fast retail workflows</div>
          <div className="min-w-0 rounded-md border border-white/10 bg-white/5 p-4">Secure team access</div>
          <div className="min-w-0 rounded-md border border-white/10 bg-white/5 p-4">Built for growth</div>
        </div>
      </section>

      <section className="flex min-w-0 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="text-xl font-bold text-zera-ink">Zera Solutions</div>
          </div>
          <div className="rounded-lg border border-zera-line bg-white p-6 shadow-soft sm:p-8">
            <h1 className="text-2xl font-bold text-zera-ink">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-zera-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
