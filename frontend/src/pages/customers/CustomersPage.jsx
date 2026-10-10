import { useEffect, useMemo, useState } from "react";
import Pagination, { usePagination } from "../../components/Pagination.jsx";
import { Banknote, Eye, Mail, Pencil, Phone, Plus, ReceiptText, Search, ToggleLeft, ToggleRight, UserRound, X } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createCustomer, getCustomerSummary, getCustomers, updateCustomer, updateCustomerStatus } from "../../services/customerService.js";

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
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileLoadingCustomerId, setProfileLoadingCustomerId] = useState("");
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

  async function openCustomerProfile(customer) {
    try {
      setProfileLoadingCustomerId(customer.id);
      setError("");
      setMessage("");
      const profile = await getCustomerSummary(activeBusinessId, customer.id);
      setProfileCustomer(profile);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load customer history.");
    } finally {
      setProfileLoadingCustomerId("");
    }
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

          <h2 className="mt-1 text-xl font-bold tracking-tight text-zera-ink">Customers</h2>

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
          onOpenProfile={openCustomerProfile}
          onStatusToggle={handleStatusToggle}
          profileLoadingCustomerId={profileLoadingCustomerId}
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

      {profileCustomer ? (
        <CustomerProfileDrawer
          currency={activeBusiness.currency}
          customer={profileCustomer}
          onClose={() => setProfileCustomer(null)}
          onEdit={() => {
            setProfileCustomer(null);
            openEditDrawer(profileCustomer);
          }}
        />
      ) : null}
    </div>
  );
}

function CustomerCounts({ activeCount, inactiveCount, loading, totalCount }) {
  const items = [
    { label: "Customers", value: totalCount },
    { label: "Active", value: activeCount },
    { label: "Inactive", value: inactiveCount }
  ];

  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-zera-line bg-white">
      {items.map((item) => (
        <div className="flex min-h-20 flex-col justify-center gap-1 border-r border-zera-line px-4 text-zera-muted last:border-r-0" key={item.label}>
          <span className="text-xs">{item.label}</span>
          <span className="text-2xl font-bold text-zera-ink">{loading ? "..." : item.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomerToolbar({ filterCount, onClearFilters, onSearchChange, onSearchSubmit, onStatusChange, search, statusFilter }) {
  return (
    <div className="overflow-x-auto border-b border-zera-line bg-white px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
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

function CustomerTable({ canManageStatus, customers, loading, onEdit, onOpenProfile, onStatusToggle, profileLoadingCustomerId, updatingCustomerId }) {
  const pagination = usePagination(customers);
  if (!loading && customers.length === 0) {
    return (
      <div className="m-4 rounded-md border border-dashed border-zera-line bg-zera-mintSoft p-6 text-sm text-zera-muted">
        No customers found. Walk-in sales still work without saving a customer.
      </div>
    );
  }

  return (
    <>
    <div className="divide-y divide-zera-line sm:hidden">
      {loading ? <p className="p-4 text-sm text-zera-muted">Loading customers…</p> : pagination.rows.map(customer => <article key={customer.id} className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{customer.name}</p><p className="mt-1 break-words text-sm text-zera-muted">{customer.phone || customer.email || '—'}</p></div><StatusBadge status={customer.status} /></div>
        <div className="flex flex-wrap gap-2"><button type="button" className="pagination-button" disabled={profileLoadingCustomerId === customer.id} onClick={() => onOpenProfile(customer)}>View</button><button type="button" className="pagination-button" onClick={() => onEdit(customer)}>Edit</button>{canManageStatus && <button type="button" className="pagination-button" disabled={updatingCustomerId === customer.id} onClick={() => onStatusToggle(customer)}>{customer.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button>}</div>
      </article>)}
    </div>
    <div className="hidden overflow-x-auto sm:block">
      <div className="min-w-[880px]">
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

            {!loading && pagination.rows.map((customer) => (
              <tr className="hover:bg-zera-mintSoft/70" key={customer.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-zera-ink">{customer.name}</p>
                  {customer.notes && <p className="mt-1 truncate text-xs text-zera-muted">{customer.notes}</p>}
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
                      disabled={profileLoadingCustomerId === customer.id}
                      onClick={() => onOpenProfile(customer)}
                      aria-label={`View ${customer.name}`}
                    >
                      <Eye size={14} />
                    </button>
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
      <Pagination {...pagination} loading={loading} />
    </>
  );
}

function CustomerDrawer({ customer, form, isEditing, onChange, onClose, onSubmit, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
      <button className="hidden flex-1 cursor-default lg:block" type="button" aria-label="Close customer form" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-zera-line bg-white shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-zera-line bg-zera-mintSoft/40 px-5 py-4">
          <div>

            <h3 className="mt-1 text-xl font-bold">{isEditing ? "Edit customer" : "New customer"}</h3>

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
                  <Field label="Email" placeholder="name@business.com" type="email" value={form.email} onChange={(value) => onChange({ ...form, email: value })} />
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

function CustomerProfileDrawer({ currency, customer, onClose, onEdit }) {
  const summary = customer.summary || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25">
      <button className="hidden flex-1 cursor-default lg:block" type="button" aria-label="Close customer profile" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-zera-line bg-white shadow-panel">
        <div className="flex items-start justify-between gap-3 border-b border-zera-line bg-zera-mintSoft/40 px-5 py-4">
          <div className="min-w-0">

            <h3 className="mt-1 truncate text-xl font-bold">{customer.name}</h3>
            <p className="mt-1 truncate text-sm text-zera-muted">{customer.phone || "No phone"} · {customer.email || "No email"}</p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-md text-zera-muted hover:bg-zera-surface" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <ProfileMetric icon={ReceiptText} label="Receipts" value={summary.receiptCount || 0} />
            <ProfileMetric icon={Banknote} label="Total spent" value={formatMoney(summary.totalSpent, currency)} />
            <ProfileMetric icon={UserRound} label="Status" value={customer.status === "ACTIVE" ? "Active" : "Inactive"} />
          </div>

          <section className="mt-4 rounded-md border border-zera-line">
            <div className="border-b border-zera-line px-4 py-3">
              <h4 className="font-bold text-zera-ink">Recent receipts</h4>

            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[620px] w-full text-left text-sm">
                <thead className="border-b border-zera-line bg-zera-mintSoft text-xs font-bold uppercase text-zera-muted">
                  <tr>
                    <th className="px-4 py-2.5">Receipt</th>
                    <th className="px-4 py-2.5">Branch</th>
                    <th className="px-4 py-2.5">Payment</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.recentSales?.length ? (
                    customer.recentSales.map((sale) => (
                      <tr className="border-b border-zera-line last:border-0" key={sale.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-zera-ink">{sale.receiptNumber}</p>
                          <p className="mt-0.5 text-xs text-zera-muted">{formatDate(sale.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-zera-muted">{sale.branch?.name || "Branch"}</td>
                        <td className="px-4 py-3 text-zera-muted">{formatPayment(sale.paymentMethod)}</td>
                        <td className="px-4 py-3 text-right font-bold text-zera-ink">{formatMoney(sale.total, currency)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-sm text-zera-muted" colSpan={4}>
                        No saved receipt history yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {customer.notes ? (
            <section className="mt-4 rounded-md border border-zera-line bg-zera-mintSoft p-4">
              <p className="text-xs font-bold uppercase text-zera-muted">Notes</p>
              <p className="mt-2 text-sm leading-6 text-zera-ink">{customer.notes}</p>
            </section>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-zera-line px-5 py-4">
          <button className="inline-flex h-10 items-center justify-center rounded-md border border-zera-line bg-white px-4 text-sm font-bold text-zera-ink hover:bg-zera-surface" type="button" onClick={onClose}>
            Close
          </button>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zera-green px-4 text-sm font-bold text-white hover:bg-zera-greenDark" type="button" onClick={onEdit}>
            <Pencil size={15} />
            Edit customer
          </button>
        </div>
      </aside>
    </div>
  );
}

function ProfileMetric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-zera-line bg-white p-3">
      <Icon className="text-zera-green" size={17} />
      <p className="mt-2 text-[11px] font-bold uppercase text-zera-muted">{label}</p>
      <p className="mt-0.5 truncate font-bold text-zera-ink">{value}</p>
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

function formatMoney(value, currency = "UGX") {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) {
    return "No sales yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatPayment(method = "") {
  return method
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
