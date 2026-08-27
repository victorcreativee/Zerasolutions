export default function Input({ label, error, helper, ...props }) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-sm font-semibold text-zera-ink">{label}</span> : null}
      <input
        className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition placeholder:text-zera-muted/60 hover:border-zera-lineStrong focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        {...props}
      />
      {error ? <span className="mt-2 block text-sm text-red-600">{error}</span> : null}
      {!error && helper ? <span className="mt-1.5 block text-xs text-zera-muted">{helper}</span> : null}
    </label>
  );
}
