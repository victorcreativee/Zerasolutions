import { useEffect, useMemo, useState } from "react";
import { Mail, Pencil, Phone, Plus, Search, ToggleLeft, ToggleRight, UserRound, X } from "lucide-react";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  const filterCount = [statusFilter !== "ACTIVE", Boolean(search)].filter(Boolean).length;

  useEffect(() => {
    if (!activeBusinessId) {
      setCustomers([]);
      return;
    }

    loadCustomers();
  }, [activeBusinessId, statusFilter]);

  async function loadCustomers(nextSearch = search, nextStatusFilter = statusFilter) {
    if (!activeBusinessId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const params = {
        ...(nextSearch ? { q: nextSearch } : {}),
        ...(nextStatusFilter !== "ALL" ? { status: nextStatusFilter } : {})
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
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        notes: form.notes.trim()
      };
      const customer = editingCustomerId
        ? await updateCustomer(activeBusinessId, editingCustomerId, payload)
        : await createCustomer(activeBusinessId, payload);

      setCustomers((current) =>
        editingCustomerId ? current.map((item) => (item.id === customer.id ? customer : item)) : [customer, ...current]
      );
      closeDrawer();
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

  function openCreateDrawer() {
    setEditingCustomerId("");
    setForm(defaultForm);
    setDrawerOpen(true);
    setMessage("");
    setError("");
  }

  function openEditDrawer(customer) {
    setEditingCustomerId(customer.id);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || ""
    });
    setDrawerOpen(true);
    setMessage("");
    setError("");
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingCustomerId("");
    setForm(defaultForm);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ACTIVE");
    loadCustomers("", "ACTIVE");
  }

  if (!activeBusiness) {
    return (
      <section className="rounded-md border border-zera-line bg-white p-5">
        <h2 className="text-xl font-bold">Customers</h2>
        <p className="mt-2 text-sm text-zera-muted">Select a business before managing customers.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-zera-line pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-zera-green">Customer directory</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zera-ink">Customers</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
            Save repeat customers for phone lookup, account notes, and cleaner receipt history. Walk-in sales can still continue without a saved customer.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zera-green px-4 text-sm font-bold text-white shadow-xs hover:bg-zera-greenDark"
          type="button"
          onClick={openCreateDrawer}
        >
          <Plus size={17} />
          New customer
        </button>
      </header>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md border border-zera-green/10 bg-zera-mintSoft px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <CustomerCounts activeCount={activeCustomers.length} inactiveCount={inactiveCustomers.length} loading={loading} totalCount={customers.length} />

      <section className="rounded-md border border-zera-line bg-white">
        <CustomerToolbar
          filterCount={filterCount}
          onClearFilters={clearFilters}
          onSearchChange={setSearch}
          onSearchSubmit={handleSearchSubmit}
          onStatusChange={setStatusFilter}
          search={search}
          statusFilter={statusFilter}
        />

        <CustomerTable
          canManageStatus={canManageStatus}
          customers={customers}
          loading={loading}
          onEdit={openEditDrawer}
          onStatusToggle={handleStatusToggle}
          updatingCustomerId={updatingCustomerId}
        />
      </section>

      {drawerOpen ? (
        <CustomerDrawer
          customer={selectedCustomer}
          form={form}
          isEditing={Boolean(editingCustomerId)}
          onChange={setForm}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function CustomerCounts({ activeCount, inactiveCount, loading, totalCount }) {
  const items = [
    { label: "Visible", value: totalCount },
    { label: "Active", value: activeCount },
    { label: "Inactive", value: inactiveCount }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <div className="inline-flex min-h-9 items-center gap-2 rounded-md border border-zera-line bg-white px-3 text-sm text-zera-muted shadow-xs" key={item.label}>
          <span className="font-semibold">{item.label}</span>
          <span className="font-bold text-zera-ink">{loading ? "..." : item.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomerToolbar({ filterCount, onClearFilters, onSearchChange, onSearchSubmit, onStatusChange, search, statusFilter }) {
  return (
    <div className="overflow-x-auto border-b border-zera-line bg-white px-3 py-2">
      <div className="flex min-w-max flex-nowrap items-center gap-2">
        <form
          className="flex h-9 w-[320px] shrink-0 items-center gap-2 rounded-md border border-zera-line bg-white px-2.5 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10"
          onSubmit={onSearchSubmit}
        >
          <Search size={16} className="shrink-0 text-zera-muted" />
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, phone, or email"
          />
        </form>

        <SegmentedStatusFilter value={statusFilter} onChange={onStatusChange} />

        <button
          className="h-9 w-[64px] shrink-0 rounded-md border border-zera-line bg-white px-2 text-sm font-bold text-zera-muted hover:bg-zera-mintSoft hover:text-zera-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!filterCount}
          type="button"
          onClick={onClearFilters}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function SegmentedStatusFilter({ onChange, value }) {
  const items = [
    { label: "Active", value: "ACTIVE" },
    { label: "All", value: "ALL" },
    { label: "Inactive", value: "INACTIVE" }
  ];

  return (
    <div className="inline-flex h-9 shrink-0 overflow-hidden rounded-md border border-zera-line bg-zera-surface p-1">
      {items.map((item) => (
        <button
          className={`h-7 min-w-[72px] rounded px-2 text-sm font-bold transition ${
            value === item.value ? "bg-white text-zera-green shadow-xs" : "text-zera-muted hover:bg-white hover:text-zera-ink"
          }`}
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CustomerTable({ canManageStatus, customers, loading, onEdit, onStatusToggle, updatingCustomerId }) {
  if (!loading && customers.length === 0) {
    return (
      <div className="m-4 rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-6 text-sm text-zera-muted">
        No customers found. Walk-in sales still work without saving a customer.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="max-h-[calc(100vh-286px)] min-w-[880px] overflow-y-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
            <tr>
              <th className="w-[28%] px-4 py-3">Customer</th>
              <th className="w-[20%] px-4 py-3">Phone</th>
              <th className="w-[24%] px-4 py-3">Email</th>
              <th className="w-[16%] px-4 py-3">Status</th>
              <th className="w-[12%] px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-sm text-zera-muted" colSpan={5}>
                  Loading customers...
                </td>
              </tr>
            ) : null}

            {!loading && customers.map((customer) => (
              <tr className="hover:bg-zera-mintSoft/70" key={customer.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-zera-ink">{customer.name}</p>
                  <p className="mt-1 truncate text-xs text-zera-muted">{customer.notes || "No notes"}</p>
                </td>
                <td className="px-4 py-3 text-zera-muted">
                  <ContactLine icon={Phone} value={customer.phone || "No phone"} />
                </td>
                <td className="px-4 py-3 text-zera-muted">
                  <ContactLine icon={Mail} value={customer.email || "No email"} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={customer.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zera-line bg-white text-zera-ink hover:bg-zera-mintSoft"
                      type="button"
                      onClick={() => onEdit(customer)}
                      aria-label={`Edit ${customer.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    {canManageStatus ? (
                      <button
                        className="inline-flex h-9 items-center rounded-md border border-zera-line bg-white px-3 text-xs font-bold text-zera-ink hover:bg-zera-mintSoft disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={updatingCustomerId === customer.id}
                        type="button"
                        onClick={() => onStatusToggle(customer)}
                      >
                        {customer.status === "ACTIVE" ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                        <span className="ml-1">{customer.status === "ACTIVE" ? "Pause" : "Activate"}</span>
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerDrawer({ customer, form, isEditing, onChange, onClose, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
      <button className="hidden flex-1 cursor-default lg:block" type="button" aria-label="Close customer form" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-zera-line bg-white shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-zera-line bg-zera-mintSoft/40 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase text-zera-green">Customer record</p>
            <h3 className="mt-1 text-xl font-bold">{isEditing ? "Edit customer" : "New customer"}</h3>
            <p className="mt-1 text-sm text-zera-muted">{customer ? `Editing ${customer.name}` : "Save details only when they help the business serve the customer better."}</p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-md text-zera-muted hover:bg-zera-surface" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-y-auto px-5 py-4" onSubmit={onSubmit}>
          <div className="space-y-4">
            <section className="rounded-md border border-zera-line p-4">
              <SectionLabel title="Customer details" helper="Save only the information staff need for lookup, deliveries, and account follow-up." />
              <div className="mt-3 space-y-3">
                <Field label="Customer name" required value={form.name} onChange={(value) => onChange({ ...form, name: value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phone" placeholder="+256..." value={form.phone} onChange={(value) => onChange({ ...form, phone: value })} />
                  <Field label="Email" placeholder="customer@example.com" type="email" value={form.email} onChange={(value) => onChange({ ...form, email: value })} />
                </div>
              </div>
            </section>

            <section className="rounded-md border border-zera-line p-4">
              <SectionLabel title="Internal notes" helper="Useful preferences, delivery instructions, or account context for the team." />
              <label className="mt-3 block">
                <span className="sr-only">Notes</span>
                <textarea
                  className="min-h-28 w-full rounded-md border border-zera-line bg-white px-3 py-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={form.notes}
                  onChange={(event) => onChange({ ...form, notes: event.target.value })}
                  placeholder="Preference, delivery note, account note..."
                />
              </label>
            </section>

            <section className="rounded-md border border-zera-line bg-zera-mintSoft p-4">
              <p className="text-xs font-bold uppercase text-zera-green">Customer preview</p>
              <div className="mt-3 rounded-md bg-white p-3 shadow-xs">
                <p className="truncate font-bold text-zera-ink">{form.name || "Customer name"}</p>
                <p className="mt-1 truncate text-xs text-zera-muted">{form.phone || "No phone"} · {form.email || "No email"}</p>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 mt-6 flex flex-col-reverse gap-2 border-t border-zera-line bg-white py-4 sm:flex-row sm:justify-end">
            <button className="inline-flex min-h-10 items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-bold text-zera-ink hover:bg-zera-surface" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zera-green px-4 text-sm font-bold text-white shadow-xs hover:bg-zera-greenDark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              <UserRound size={16} />
              {saving ? "Saving..." : isEditing ? "Save changes" : "Create customer"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ContactLine({ icon: Icon, value }) {
  return (
    <p className="flex min-w-0 items-center gap-2">
      <Icon className="shrink-0" size={15} />
      <span className="truncate">{value}</span>
    </p>
  );
}

function SectionLabel({ helper, title }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-zera-ink">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-zera-muted">{helper}</p>
    </div>
  );
}

function Field({ label, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zera-ink">{label}</span>
      <input
        className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition placeholder:text-zera-muted/60 focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${status === "ACTIVE" ? "bg-zera-mintSoft text-zera-green" : "bg-zera-line text-zera-muted"}`}>
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}
