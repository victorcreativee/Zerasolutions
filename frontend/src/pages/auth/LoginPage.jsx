import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import Input from "../../components/Input.jsx";
import Button from "../../components/Button.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const user = await login(form.email, form.password);
      const requestedPath = location.state?.from?.pathname;
      const defaultPath = user.systemRole === "SYSTEM_ADMIN" ? "/system-admin" : "/dashboard";
      const nextPath = requestedPath === "/system-admin" && user.systemRole !== "SYSTEM_ADMIN" ? "/dashboard" : requestedPath || defaultPath;
      navigate(nextPath, { replace: true });
    } catch (apiError) {
      const message =
        apiError.response?.data?.message ||
        (apiError.request ? "Cannot reach the API. Make sure the backend is running." : "Unable to log in.");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Access your shop workspace and continue from where your team left off.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <Input label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        <Button className="w-full" disabled={submitting}>
          {submitting ? "Logging in..." : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zera-muted">
        New to Zera? Ask your Zera system admin or business owner for a login.
      </p>
    </AuthLayout>
  );
}
