export default function Input({ label, error, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zera-ink">{label}</span>
      <input
        className="min-h-12 w-full rounded-md border border-zera-line bg-white px-4 text-base text-zera-ink outline-none transition placeholder:text-zera-muted/70 focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        {...props}
      />
      {error ? <span className="mt-2 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}
