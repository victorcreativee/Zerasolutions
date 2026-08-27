export default function Button({ className = "", variant = "primary", ...props }) {
  const variants = {
    primary: "border border-zera-green bg-zera-green text-white shadow-xs hover:bg-zera-greenDark focus:ring-zera-green/20",
    secondary: "border border-zera-line bg-white text-zera-ink shadow-xs hover:border-zera-lineStrong hover:bg-zera-mintSoft focus:ring-zera-green/10",
    ghost: "border border-transparent text-zera-muted hover:bg-zera-surface hover:text-zera-ink focus:ring-zera-green/10"
  };

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 text-sm font-semibold leading-none transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
