import { Link } from "react-router-dom";
import AuthLayout from "../../layouts/AuthLayout.jsx";

export default function RegisterPage() {
  return (
    <AuthLayout title="Account setup" subtitle="Zera accounts are created by a system admin or by the owner of your business workspace.">
      <div className="rounded-md bg-zera-mint px-4 py-4 text-sm leading-6 text-zera-ink">
        Ask your Zera system admin or business owner for your email and temporary password.
      </div>
      <Link
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-zera-green px-4 text-sm font-semibold text-white transition hover:bg-green-700"
        to="/login"
      >
        Go to login
      </Link>
    </AuthLayout>
  );
}
