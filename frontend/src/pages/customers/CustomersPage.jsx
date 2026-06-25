import { useEffect, useMemo, useState } from "react";
import { Mail, Pencil, Phone, Plus, Search, ToggleLeft, ToggleRight, UserRound, Users, X } from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createCustomer, getCustomers, updateCustomer, updateCustomerStatus } from "../../services/customerService.js";

const defaultForm = {
  name: "",
  phone: "",
  email: "",
  notes: ""
};

export default function CustomersPage() {
  const { activeBusiness, activeBusinessId, activeRoleName } = useWorkspace();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingCustomerId, setUpdatingCustomerId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canManageStatus = ["Owner", "Manager"].includes(activeRoleName);
  const activeCustomers = customers.filter((customer) => customer.status === "ACTIVE");
  const inactiveCustomers = customers.filter((customer) => customer.status === "INACTIVE");
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === editingCustomerId) || null,
    [customers, editingCustomerId]
  );

  useEffect(() => {
    if (!activeBusinessId) {
      setCustomers([]);
      return;
    }

    loadCustomers();
  }, [activeBusinessId, statusFilter]);

  async function loadCustomers(nextSearch = search) {
    if (!activeBusinessId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const params = {
        ...(nextSearch ? { q: nextSearch } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {})
      };
      const data = await getCustomers(activeBusinessId, params);
      setCustomers(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!activeBusinessId) {
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const customer = editingCustomerId
        ? await updateCustomer(activeBusinessId, editingCustomerId, form)
        : await createCustomer(activeBusinessId, form);

      setCustomers((current) =>
        editingCustomerId ? current.map((item) => (item.id === customer.id ? customer : item)) : [customer, ...current]
      );
      setForm(defaultForm);
      setEditingCustomerId("");
      setMessage(editingCustomerId ? "Customer updated." : "Customer created.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusToggle(customer) {
    if (!activeBusinessId || !canManageStatus) {
      return;
    }

    const nextStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError("");
    setMessage("");
    setUpdatingCustomerId(customer.id);

    try {
      const updatedCustomer = await updateCustomerStatus(activeBusinessId, customer.id, nextStatus);
      setCustomers((current) => current.map((item) => (item.id === updatedCustomer.id ? updatedCustomer : item)));
      setMessage(`${updatedCustomer.name} is now ${updatedCustomer.status.toLowerCase()}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update customer status.");
    } finally {
      setUpdatingCustomerId("");
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadCustomers(search);
  }

  function handleEdit(customer) {
    setEditingCustomerId(customer.id);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || ""
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingCustomerId("");
    setForm(defaultForm);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ACTIVE");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">Customer book</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Customers</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              Keep walk-in sales fast, but save repeat customers when the business needs names, phone numbers, or receipt history.
            </p>
          </div>
          <div className="flex min-h-14 min-w-14 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
            <Users size={30} />
          </div>
        </div>
      </section>

      {!activeBusiness ? (
        <section className="rounded-lg border border-zera-line bg-white p-6">
          <h3 className="text-lg font-bold">No business selected</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">Select a business before managing customers.</p>
        </section>
      ) : (
        <>
          {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

          <section className="grid gap-4 md:grid-cols-3">
            <Metric icon={Users} label="Customers" value={loading ? "..." : customers.length} />
            <Metric icon={ToggleRight} label="Active" value={loading ? "..." : activeCustomers.length} />
            <Metric icon={ToggleLeft} label="Inactive" value={loading ? "..." : inactiveCustomers.length} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={handleSubmit}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                    <Plus size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{editingCustomerId ? "Edit customer" : "Create customer"}</h3>
                    <p className="text-sm text-zera-muted">Business: {activeBusiness.name}</p>
                  </div>
                </div>
                {editingCustomerId ? (
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-zera-muted hover:bg-[#f7faf8] hover:text-zera-ink"
                    onClick={cancelEdit}
                    aria-label="Cancel edit"
                  >
                    <X size={18} />
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                <Input
                  label="Customer name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Sarah Kato"
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+256..."
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="customer@example.com"
                  />
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-zera-ink">Notes</span>
                  <textarea
                    className="min-h-28 w-full rounded-md border border-zera-line bg-white px-3 py-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Preference, delivery note, account note..."
                  />
                </label>
              </div>

              <Button type="submit" className="mt-5 w-full" disabled={saving}>
                {saving ? "Saving..." : editingCustomerId ? "Update customer" : "Create customer"}
              </Button>

              {selectedCustomer ? (
                <p className="mt-3 text-center text-xs text-zera-muted">
                  Editing {selectedCustomer.name}. Use the close button to return to a blank form.
                </p>
              ) : null}
            </form>

            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-bold">Customer directory</h3>
                  <p className="mt-1 text-sm text-zera-muted">{loading ? "Loading..." : `${customers.length} customer${customers.length === 1 ? "" : "s"}`}</p>
                </div>
                <div className="flex gap-2">
                  {["ACTIVE", "ALL", "INACTIVE"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${
                        statusFilter === status ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line text-zera-muted hover:bg-[#f7faf8]"
                      }`}
                      onClick={() => setStatusFilter(status)}
                    >
                      {formatStatus(status)}
                    </button>
                  ))}
                </div>
              </div>

              <form className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]" onSubmit={handleSearchSubmit}>
                <label className="flex min-h-12 items-center gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-3">
                  <Search size={18} className="text-zera-muted" />
                  <input
                    className="w-full border-0 bg-transparent text-sm outline-none"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, phone, or email"
                  />
                </label>
                <Button type="submit" variant="secondary">
                  Search
                </Button>
                <Button type="button" variant="ghost" className="px-3" onClick={clearFilters}>
                  Clear
                </Button>
              </form>

              <div className="space-y-3">
                {!loading && customers.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">
                    No customers found. Walk-in sales still work without saving a customer.
                  </div>
                ) : null}

                {loading ? (
                  <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">
                    Loading customers...
                  </div>
                ) : null}

                {customers.map((customer) => (
                  <article key={customer.id} className="rounded-md border border-zera-line bg-[#f7faf8] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="font-bold">{customer.name}</h4>
                        <div className="mt-2 space-y-1 text-sm text-zera-muted">
                          <ContactLine icon={Phone} value={customer.phone || "No phone"} />
                          <ContactLine icon={Mail} value={customer.email || "No email"} />
                        </div>
                        {customer.notes ? <p className="mt-3 text-sm leading-6 text-zera-muted">{customer.notes}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={customer.status} />
                        <button
                          type="button"
                          className="flex min-h-9 items-center gap-2 rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink hover:bg-zera-mint"
                          onClick={() => handleEdit(customer)}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        {canManageStatus ? (
                          <button
                            type="button"
                            className="flex min-h-9 items-center gap-2 rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink hover:bg-zera-mint disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={updatingCustomerId === customer.id}
                            onClick={() => handleStatusToggle(customer)}
                          >
                            {customer.status === "ACTIVE" ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                            {customer.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      )}
    </div>
  );
}

function ContactLine({ icon: Icon, value }) {
  return (
    <p className="flex items-center gap-2">
      <Icon size={15} />
      <span>{value}</span>
    </p>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-lg border border-zera-line bg-white p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-zera-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-zera-ink">{value}</p>
    </article>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${status === "ACTIVE" ? "bg-zera-mint text-zera-green" : "bg-zera-line text-zera-muted"}`}>
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

function formatStatus(status) {
  return status.toLowerCase().replace("_", " ");
}
