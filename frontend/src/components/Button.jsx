export default function Button({ className = "", variant = "primary", ...props }) {
  const variants = {
    primary: "bg-zera-green text-white hover:bg-green-700",
    secondary: "border border-zera-line bg-white text-zera-ink hover:bg-zera-mint",
    ghost: "text-zera-muted hover:bg-zera-mint hover:text-zera-ink"
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
