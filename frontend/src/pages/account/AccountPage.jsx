import { useState } from "react";
import { KeyRound, UserRound } from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { changePassword } from "../../services/accountService.js";

const defaultForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export default function AccountPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);

    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setForm(defaultForm);
      setMessage("Password updated.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-zera-line pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Account</p>
          <h2 className="mt-1 text-2xl font-bold">Login and security</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
            Keep your account secure after receiving a temporary password from Zera or your business owner.
          </p>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <article className="rounded-md border border-zera-line bg-white p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <UserRound size={22} />
            </div>
            <div>
              <h3 className="font-bold">Profile</h3>
              <p className="text-sm text-zera-muted">Signed-in account</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-[#f7faf8] px-3 py-3">
              <p className="font-semibold text-zera-ink">{user?.name}</p>
              <p className="mt-1 text-zera-muted">{user?.email}</p>
            </div>
            <div className="rounded-md bg-[#f7faf8] px-3 py-3">
              <p className="font-semibold text-zera-ink">Access type</p>
              <p className="mt-1 text-zera-muted">{user?.systemRole === "SYSTEM_ADMIN" ? "System admin" : "Business user"}</p>
            </div>
          </div>
        </article>

        <form className="rounded-md border border-zera-line bg-white p-4" onSubmit={handleSubmit}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="font-bold">Change password</h3>
              <p className="text-sm text-zera-muted">Use a private password only you know.</p>
            </div>
          </div>

          {error ? <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mb-4 rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

          <div className="space-y-4">
            <Input
              label="Current password"
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
              required
            />
            <Input
              label="New password"
              type="password"
              minLength={8}
              value={form.newPassword}
              onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              minLength={8}
              value={form.confirmPassword}
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              required
            />
            <Button className="h-10 w-full" disabled={saving}>
              {saving ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
