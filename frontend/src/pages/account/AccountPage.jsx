import { useState } from "react";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">Account</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Your login and security</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              Keep your account secure after receiving a temporary password from Zera or your business owner.
            </p>
          </div>
          <div className="flex min-h-14 min-w-14 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
            <ShieldCheck size={30} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-zera-line bg-white p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <UserRound size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Profile</h3>
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

        <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={handleSubmit}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Change password</h3>
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
            <Button className="w-full" disabled={saving}>
              {saving ? "Updating..." : "Update password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
