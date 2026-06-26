import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, KeyRound, Plus, ShieldCheck, UserCheck, Users, UserX } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeUsers = users.filter((membership) => membership.user.status === "ACTIVE").length;
  const inactiveUsers = users.filter((membership) => membership.user.status === "INACTIVE").length;
  const roleOptions = useMemo(() => buildRoleOptions(activeBusiness), [activeBusiness]);
  const primaryStaffRole = roleOptions.find((role) => role.name !== "Manager") || roleOptions[0] || null;
  const managerUsers = users.filter((membership) => membership.role?.name === "Manager").length;
  const primaryStaffUsers = primaryStaffRole ? users.filter((membership) => membership.role?.name === primaryStaffRole.name).length : 0;

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
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">User management</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Team accounts</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              Create simple login accounts for the selected business. Start with clear roles before adding deeper permissions.
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
          <p className="mt-2 text-sm leading-6 text-zera-muted">Create or select a business before adding users.</p>
        </section>
      ) : (
        <>
          {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

          <section className="grid gap-4 md:grid-cols-4">
            <UserMetric icon={UserCheck} label="Active" value={loading ? "..." : activeUsers} />
            <UserMetric icon={UserX} label="Inactive" value={loading ? "..." : inactiveUsers} />
            <UserMetric icon={ShieldCheck} label="Managers" value={loading ? "..." : managerUsers} />
            <UserMetric icon={BriefcaseBusiness} label={primaryStaffRole?.name || "Staff"} value={loading ? "..." : primaryStaffUsers} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={handleSubmit}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Create user</h3>
                  <p className="text-sm text-zera-muted">Business: {activeBusiness.name}</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input label="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
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
                    className="min-h-12 w-full rounded-md border border-zera-line bg-white px-4 text-base text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
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
                    <span className="mt-2 block text-xs leading-5 text-zera-muted">
                      {roleOptions.find((role) => role.name === form.roleName)?.description}
                    </span>
                  ) : null}
                </label>
                <Button className="w-full gap-2" disabled={saving}>
                  <Plus size={17} />
                  {saving ? "Creating user..." : "Create user"}
                </Button>
              </div>
            </form>

            <section className="rounded-lg border border-zera-line bg-white p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Current users</h3>
                  <p className="text-sm text-zera-muted">{loading ? "Loading..." : `${users.length} user${users.length === 1 ? "" : "s"}`}</p>
                </div>
              </div>

              <div className="space-y-3">
                {!loading && users.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">
                    No users found for this business yet.
                  </div>
                ) : null}

                {users.map((membership) => {
                  const isActive = membership.user.status === "ACTIVE";
                  const isOwner = membership.role?.name === "Owner";

                  return (
                    <article key={membership.id} className="rounded-md border border-zera-line p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold">{membership.user.name}</h4>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                isActive ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"
                              }`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zera-muted">{membership.user.email}</p>
                          <p className="mt-1 text-sm font-semibold text-zera-muted">{membership.role?.name || "No role"}</p>
                        </div>
                        <Button
                          type="button"
                          variant={isActive ? "secondary" : "primary"}
                          className="gap-2 sm:w-36"
                          disabled={isOwner || updatingUserId === membership.id}
                          onClick={() => handleStatusToggle(membership)}
                        >
                          {isActive ? <UserX size={17} /> : <UserCheck size={17} />}
                          {isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                      {isOwner ? <p className="mt-3 text-xs text-zera-muted">Owner account is protected.</p> : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        </>
      )}
    </div>
  );
}

function UserMetric({ icon: Icon, label, value }) {
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
