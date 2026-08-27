import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, KeyRound, Plus, Search, ShieldCheck, UserCheck, Users, UserX, X } from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { createBusinessUser, getBusinessUsers, updateBusinessUserStatus } from "../../services/teamService.js";

const defaultForm = {
  name: "",
  email: "",
  password: "",
  roleName: ""
};

export default function UsersPage() {
  const { activeBusiness } = useWorkspace();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [userSearch, setUserSearch] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const activeUsers = users.filter((membership) => membership.user.status === "ACTIVE").length;
  const inactiveUsers = users.filter((membership) => membership.user.status === "INACTIVE").length;
  const roleOptions = useMemo(() => buildRoleOptions(activeBusiness), [activeBusiness]);
  const managerUsers = users.filter((membership) => membership.role?.name === "Manager").length;
  const filteredUsers = users.filter((membership) => {
    const normalizedSearch = userSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return true;
    }

    return [membership.user.name, membership.user.email, membership.role?.name, membership.user.status]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  useEffect(() => {
    if (activeBusiness?.id) {
      loadUsers(activeBusiness.id);
    } else {
      setUsers([]);
    }
  }, [activeBusiness?.id]);

  useEffect(() => {
    const nextRoleName = roleOptions[0]?.name || "";

    if (!form.roleName && nextRoleName) {
      setForm((current) => ({ ...current, roleName: nextRoleName }));
      return;
    }

    if (form.roleName && roleOptions.length > 0 && !roleOptions.some((role) => role.name === form.roleName)) {
      setForm((current) => ({ ...current, roleName: nextRoleName }));
    }
  }, [form.roleName, roleOptions]);

  async function loadUsers(businessId) {
    try {
      setLoading(true);
      setError("");
      const data = await getBusinessUsers(businessId);
      setUsers(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusToggle(membership) {
    if (!activeBusiness?.id) {
      return;
    }

    const nextStatus = membership.user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError("");
    setMessage("");
    setUpdatingUserId(membership.id);

    try {
      const updatedMembership = await updateBusinessUserStatus(activeBusiness.id, membership.id, nextStatus);
      setUsers((current) => current.map((item) => (item.id === updatedMembership.id ? updatedMembership : item)));
      setMessage(`${updatedMembership.user.name} is now ${updatedMembership.user.status.toLowerCase()}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update user status.");
    } finally {
      setUpdatingUserId("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!activeBusiness?.id) {
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const businessUser = await createBusinessUser(activeBusiness.id, form);
      setUsers((current) => [...current, businessUser]);
      setMessage(`User created. Login email: ${form.email}`);
      setForm({ ...defaultForm, roleName: roleOptions[0]?.name || "" });
      setShowCreatePanel(false);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-col gap-3 border-b border-zera-line pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zera-green">User management</p>
          <h2 className="mt-1 text-2xl font-bold">Team accounts</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
            Create and manage the people who can use this business workspace.
          </p>
        </div>
        {activeBusiness ? (
          <Button type="button" className="h-10 gap-2 px-3" onClick={() => setShowCreatePanel(true)}>
            <Plus size={16} />
            New user
          </Button>
        ) : null}
      </header>

      {!activeBusiness ? (
        <section className="rounded-md border border-zera-line bg-white p-5">
          <h3 className="text-lg font-bold">No business selected</h3>
          <p className="mt-2 text-sm leading-6 text-zera-muted">Create or select a business before adding users.</p>
        </section>
      ) : (
        <>
          {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

          <section className="grid gap-3 md:grid-cols-4">
            <UserMetric icon={UserCheck} label="Active" value={loading ? "..." : activeUsers} />
            <UserMetric icon={UserX} label="Inactive" value={loading ? "..." : inactiveUsers} />
            <UserMetric icon={ShieldCheck} label="Managers" value={loading ? "..." : managerUsers} />
            <UserMetric icon={BriefcaseBusiness} label="Roles" value={roleOptions.length} />
          </section>

          <section className="rounded-md border border-zera-line bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <RoleGuide activeBusiness={activeBusiness} />
              <label className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-zera-line bg-white px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10 lg:w-96">
                <Search size={17} className="shrink-0 text-zera-muted" />
                <input
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  placeholder="Search name, email, role"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
              </label>
            </div>
          </section>

          <UsersTable loading={loading} onStatusToggle={handleStatusToggle} updatingUserId={updatingUserId} users={filteredUsers} />

          {showCreatePanel ? (
            <div className="fixed inset-0 z-40 flex justify-end bg-black/20 no-print">
              <form className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onSubmit={handleSubmit}>
                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zera-line bg-white p-5">
                  <div>
                    <p className="text-xs font-bold uppercase text-zera-green">Create user</p>
                    <h3 className="mt-1 text-xl font-bold">{activeBusiness.name}</h3>
                    <p className="mt-1 text-sm text-zera-muted">Assign a clear role before sharing login details.</p>
                  </div>
                  <button className="rounded-md border border-zera-line p-2 text-zera-muted hover:text-zera-ink" type="button" onClick={() => setShowCreatePanel(false)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <Input label="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                  <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                  <Input
                    label="Temporary password"
                    type="text"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required
                    minLength={8}
                  />
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zera-ink">Role</span>
                    <select
                      className="h-12 w-full rounded-md border border-zera-line bg-white px-4 text-base text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                      value={form.roleName}
                      onChange={(event) => setForm({ ...form, roleName: event.target.value })}
                    >
                      {roleOptions.map((role) => (
                        <option key={role.name} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    {roleOptions.find((role) => role.name === form.roleName)?.description ? (
                      <span className="mt-2 block text-xs leading-5 text-zera-muted">{roleOptions.find((role) => role.name === form.roleName)?.description}</span>
                    ) : null}
                  </label>
                </div>

                <div className="sticky bottom-0 border-t border-zera-line bg-white p-5">
                  <Button className="w-full gap-2" disabled={saving}>
                    <KeyRound size={17} />
                    {saving ? "Creating user..." : "Create user"}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function UsersTable({ loading, onStatusToggle, updatingUserId, users }) {
  return (
    <section className="overflow-hidden rounded-md border border-zera-line bg-white">
      <div className="flex items-center justify-between border-b border-zera-line p-4">
        <div>
          <h3 className="font-bold">User directory</h3>
          <p className="mt-0.5 text-sm text-zera-muted">{loading ? "Loading..." : `${users.length} user${users.length === 1 ? "" : "s"} shown`}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[780px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-zera-line bg-[#f7faf8] text-xs font-bold uppercase text-zera-muted">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {!loading && users.length ? (
              users.map((membership) => {
                const isActive = membership.user.status === "ACTIVE";
                const isOwner = membership.role?.name === "Owner";

                return (
                  <tr className="hover:bg-[#f7faf8]" key={membership.id}>
                    <td className="px-4 py-3">
                      <p className="truncate font-bold">{membership.user.name}</p>
                      <p className="mt-0.5 truncate text-xs text-zera-muted">{membership.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-[#f7faf8] px-2 py-1 text-xs font-bold text-zera-muted">{membership.role?.name || "No role"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${isActive ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"}`}>
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant={isActive ? "secondary" : "primary"}
                        className="h-9 gap-2 px-3"
                        disabled={isOwner || updatingUserId === membership.id}
                        onClick={() => onStatusToggle(membership)}
                      >
                        {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                        {isOwner ? "Protected" : isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zera-muted" colSpan="4">
                  {loading ? "Loading users..." : "No users match this view."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserMetric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-md border border-zera-line bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
          <Icon size={19} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
          <p className="mt-1 text-lg font-bold">{value}</p>
        </div>
      </div>
    </article>
  );
}

function RoleGuide({ activeBusiness }) {
  const guide = getRoleGuide(activeBusiness);

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
        <Users size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-zera-green">{guide.eyebrow}</p>
        <p className="mt-0.5 text-sm leading-6 text-zera-muted">{guide.helper}</p>
      </div>
    </div>
  );
}

function getRoleGuide(activeBusiness) {
  const type = (activeBusiness?.type || "").toLowerCase();
  const posMode = activeBusiness?.posMode || "RETAIL_CHECKOUT";

  if (posMode === "TABLE_SERVICE" || type.includes("bar") || type.includes("restaurant")) {
    return {
      eyebrow: "Table service team",
      helper: "Waiters open tables and send orders. Cashiers receive payment and close bills. Managers supervise the branch."
    };
  }

  if (type.includes("pharmacy")) {
    return {
      eyebrow: "Pharmacy team",
      helper: "Pharmacists handle medicine sales, cashiers collect payment, and managers supervise daily operations."
    };
  }

  if (type.includes("hotel")) {
    return {
      eyebrow: "Hotel team",
      helper: "Front desk staff manage guest-facing service sales while cashiers and managers support payments and control."
    };
  }

  if (type.includes("supermarket")) {
    return {
      eyebrow: "Supermarket team",
      helper: "Cashiers handle checkout, store keepers support stock work, and managers supervise the floor."
    };
  }

  if (type.includes("electronic")) {
    return {
      eyebrow: "Electronics shop team",
      helper: "Cashiers sell devices and accessories, store keepers manage stock, technicians support service work, and managers supervise the shop."
    };
  }

  return {
    eyebrow: "Retail team",
    helper: "Cashiers handle checkout, store keepers support stock work, and managers supervise daily shop operations."
  };
}

function buildRoleOptions(activeBusiness) {
  const roles = activeBusiness?.roles || [];
  const visibleRoles = roles.filter((role) => role.name !== "Owner");

  if (visibleRoles.length > 0) {
    return visibleRoles;
  }

  const type = (activeBusiness?.type || "").toLowerCase();
  const posMode = activeBusiness?.posMode || "RETAIL_CHECKOUT";

  if (posMode === "TABLE_SERVICE" || type.includes("bar") || type.includes("restaurant")) {
    return [
      { name: "Manager", description: "Manage daily restaurant operations." },
      { name: "Waiter", description: "Take table orders and record table-service bills." },
      { name: "Cashier", description: "Receive payments and close customer bills." }
    ];
  }

  if (type.includes("pharmacy")) {
    return [
      { name: "Manager", description: "Manage pharmacy operations." },
      { name: "Pharmacist", description: "Serve pharmacy customers and record medicine sales." },
      { name: "Cashier", description: "Receive payments and run checkout." }
    ];
  }

  if (type.includes("retail")) {
    return [
      { name: "Manager", description: "Manage retail shop operations." },
      { name: "Store Keeper", description: "Support stock-facing shop duties and retail checkout." },
      { name: "Cashier", description: "Run retail checkout and receive payments." }
    ];
  }

  if (type.includes("supermarket")) {
    return [
      { name: "Manager", description: "Manage supermarket operations." },
      { name: "Cashier", description: "Run fast checkout and receive payments." },
      { name: "Store Keeper", description: "Support product and stock-facing supermarket work." }
    ];
  }

  if (type.includes("electronic")) {
    return [
      { name: "Manager", description: "Manage electronics shop operations." },
      { name: "Cashier", description: "Sell devices and accessories and receive payments." },
      { name: "Store Keeper", description: "Receive device stock and keep product records clean." },
      { name: "Technician", description: "Support repair and device-service workflows." }
    ];
  }

  if (type.includes("hotel")) {
    return [
      { name: "Manager", description: "Manage daily hotel operations." },
      { name: "Front Desk", description: "Serve guest-facing hotel workflows and record service sales." },
      { name: "Cashier", description: "Receive payments and close service bills." }
    ];
  }

  return [
    { name: "Manager", description: "Manage daily operations." },
    { name: "Cashier", description: "Run checkout and receive payments." }
  ];
}
