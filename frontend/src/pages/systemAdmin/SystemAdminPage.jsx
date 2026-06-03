import { useEffect, useMemo, useState } from "react";
import { Boxes, Building2, KeyRound, MapPin, Plus, Search, ShieldCheck, Store, UserRound, Users } from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getSystemBusinesses, provisionBusiness } from "../../services/systemAdminService.js";

const defaultForm = {
  businessName: "",
  businessType: "Bar and restaurant",
  country: "Uganda",
  currency: "UGX",
  branchName: "Main Branch",
  branchLocation: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: ""
};

export default function SystemAdminPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user?.systemRole === "SYSTEM_ADMIN") {
      loadBusinesses();
    }
  }, [user?.systemRole]);

  useEffect(() => {
    if (!businesses.length) {
      setSelectedBusinessId("");
      return;
    }

    const selectedStillExists = businesses.some((business) => business.id === selectedBusinessId);

    if (!selectedStillExists) {
      setSelectedBusinessId(businesses[0].id);
    }
  }, [businesses, selectedBusinessId]);

  const filteredBusinesses = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return businesses;
    }

    return businesses.filter((business) => {
      const owner = business.memberships?.find((membership) => membership.role?.name === "Owner");
      return [business.name, business.type, business.country, owner?.user?.name, owner?.user?.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchTerm));
    });
  }, [businesses, search]);

  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId) || filteredBusinesses[0] || null;
  const selectedOwner = selectedBusiness?.memberships?.find((membership) => membership.role?.name === "Owner");
  const selectedActiveBranches = selectedBusiness?.branches?.filter((branch) => branch.status === "ACTIVE") || [];
  const selectedActiveModules = selectedBusiness?.modules?.filter((module) => module.active) || [];
  const selectedActiveUsers = selectedBusiness?.memberships?.filter((membership) => membership.user.status === "ACTIVE") || [];
  const platformTotals = useMemo(
    () => ({
      businesses: businesses.length,
      branches: businesses.reduce((total, business) => total + (business.branches?.length || 0), 0),
      users: businesses.reduce((total, business) => total + (business.memberships?.length || 0), 0),
      products: businesses.reduce((total, business) => total + (business._count?.products || 0), 0)
    }),
    [businesses]
  );

  async function loadBusinesses() {
    try {
      setLoading(true);
      const data = await getSystemBusinesses();
      setBusinesses(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load system admin data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const business = await provisionBusiness({
        business: {
          name: form.businessName,
          type: form.businessType,
          country: form.country,
          currency: form.currency
        },
        branch: {
          name: form.branchName,
          location: form.branchLocation
        },
        owner: {
          name: form.ownerName,
          email: form.ownerEmail,
          password: form.ownerPassword
        }
      });

      setBusinesses((current) => [business, ...current]);
      setSelectedBusinessId(business.id);
      setMessage(`Business created. Owner login: ${form.ownerEmail}`);
      setForm(defaultForm);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create business account.");
    } finally {
      setSaving(false);
    }
  }

  if (user?.systemRole !== "SYSTEM_ADMIN") {
    return (
      <div className="mx-auto max-w-3xl">
        <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-zera-mint text-zera-green">
            <ShieldCheck size={23} />
          </div>
          <h2 className="mt-5 text-2xl font-bold">System admin access required</h2>
          <p className="mt-3 leading-7 text-zera-muted">
            This area is only for Zera system administrators who create and provision business accounts.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-zera-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">System admin</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Provision business accounts</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zera-muted">
              Create a business workspace and give the business owner their first admin login. Staff setup will belong to that business later.
            </p>
          </div>
          <div className="flex min-h-14 min-w-14 items-center justify-center rounded-lg bg-zera-mint text-zera-green">
            <ShieldCheck size={30} />
          </div>
        </div>
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Building2} label="Businesses" value={loading ? "..." : platformTotals.businesses} />
        <MetricCard icon={MapPin} label="Branches" value={loading ? "..." : platformTotals.branches} />
        <MetricCard icon={Users} label="Users" value={loading ? "..." : platformTotals.users} />
        <MetricCard icon={Boxes} label="Products" value={loading ? "..." : platformTotals.products} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={handleSubmit}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Business details</h3>
              <p className="text-sm text-zera-muted">Start with the account basics.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Business name"
              placeholder="Bamboo Bar and Restaurant"
              value={form.businessName}
              onChange={(event) => setForm({ ...form, businessName: event.target.value })}
              required
            />
            <Input
              label="Type of business"
              placeholder="Bar and restaurant"
              value={form.businessType}
              onChange={(event) => setForm({ ...form, businessType: event.target.value })}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Country"
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
              />
              <Input
                label="Currency"
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Branch name"
                value={form.branchName}
                onChange={(event) => setForm({ ...form, branchName: event.target.value })}
              />
              <Input
                label="Branch location"
                value={form.branchLocation}
                onChange={(event) => setForm({ ...form, branchLocation: event.target.value })}
              />
            </div>
          </div>

          <div className="mt-7 mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Owner login</h3>
              <p className="text-sm text-zera-muted">This user becomes the business admin.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Owner name"
              value={form.ownerName}
              onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
              required
            />
            <Input
              label="Owner email"
              type="email"
              value={form.ownerEmail}
              onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
              required
            />
            <Input
              label="Temporary password"
              type="text"
              value={form.ownerPassword}
              onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })}
              required
              minLength={8}
            />
            <Button className="w-full gap-2" disabled={saving}>
              <Plus size={17} />
              {saving ? "Creating business..." : "Create business account"}
            </Button>
          </div>
        </form>

        <section className="rounded-lg border border-zera-line bg-white p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zera-mint text-zera-green">
              <Store size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Business directory</h3>
              <p className="text-sm text-zera-muted">{loading ? "Loading..." : `${businesses.length} business account${businesses.length === 1 ? "" : "s"}`}</p>
            </div>
          </div>

          <label className="mb-4 block">
            <span className="sr-only">Search businesses</span>
            <div className="flex min-h-12 items-center gap-2 rounded-md border border-zera-line bg-white px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
              <Search size={18} className="text-zera-muted" />
              <input
                className="w-full border-0 bg-transparent text-base outline-none"
                placeholder="Search business or owner"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </label>

          <div className="space-y-3">
            {!loading && businesses.length === 0 ? (
              <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">
                No business accounts have been created yet.
              </div>
            ) : null}

            {!loading && businesses.length > 0 && filteredBusinesses.length === 0 ? (
              <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">
                No businesses match your search.
              </div>
            ) : null}

            {filteredBusinesses.map((business) => {
              const owner = business.memberships?.find((membership) => membership.role?.name === "Owner");
              const isSelected = selectedBusiness?.id === business.id;

              return (
                <button
                  key={business.id}
                  type="button"
                  className={`w-full rounded-md border p-4 text-left transition ${
                    isSelected ? "border-zera-green bg-zera-mint/60" : "border-zera-line hover:bg-[#f7faf8]"
                  }`}
                  onClick={() => setSelectedBusinessId(business.id)}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-bold">{business.name}</h4>
                      <p className="mt-1 text-sm text-zera-muted">
                        {business.type || "Business"} - {business.country || "Country not set"} - {business.currency}
                      </p>
                      <p className="mt-2 text-sm text-zera-muted">
                        Owner: {owner?.user?.name || "Not set"} {owner?.user?.email ? `(${owner.user.email})` : ""}
                      </p>
                    </div>
                    <span className="rounded-md bg-zera-mint px-3 py-2 text-sm font-semibold text-zera-green">
                      {business.branches?.length || 0} branch{business.branches?.length === 1 ? "" : "es"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </section>

      {selectedBusiness ? (
        <section className="rounded-lg border border-zera-line bg-white p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-zera-green">Selected business</p>
              <h3 className="mt-1 text-2xl font-bold">{selectedBusiness.name}</h3>
              <p className="mt-2 text-sm text-zera-muted">
                {selectedBusiness.type || "Business type not set"} - {selectedBusiness.country || "Country not set"} -{" "}
                {selectedBusiness.currency}
              </p>
            </div>
            <span className="rounded-md bg-zera-mint px-3 py-2 text-sm font-semibold text-zera-green">
              {selectedBusiness.status?.toLowerCase() || "active"}
            </span>
          </div>

          <section className="grid gap-4 md:grid-cols-4">
            <DetailMetric icon={MapPin} label="Active branches" value={`${selectedActiveBranches.length}/${selectedBusiness.branches?.length || 0}`} />
            <DetailMetric icon={Boxes} label="Active modules" value={`${selectedActiveModules.length}/${selectedBusiness.modules?.length || 0}`} />
            <DetailMetric icon={Users} label="Active users" value={`${selectedActiveUsers.length}/${selectedBusiness.memberships?.length || 0}`} />
            <DetailMetric icon={UserRound} label="Products" value={selectedBusiness._count?.products || 0} />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-md border border-zera-line p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <UserRound size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Owner login</h4>
                  <p className="text-sm text-zera-muted">Primary business admin</p>
                </div>
              </div>
              <p className="font-semibold">{selectedOwner?.user?.name || "Owner not set"}</p>
              <p className="mt-1 text-sm text-zera-muted">{selectedOwner?.user?.email || "Email not set"}</p>
            </article>

            <article className="rounded-md border border-zera-line p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <Boxes size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Modules</h4>
                  <p className="text-sm text-zera-muted">Visible foundations for this business</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(selectedBusiness.modules || []).map((module) => (
                  <span
                    key={module.id}
                    className={`rounded-md px-3 py-2 text-sm font-semibold ${
                      module.active ? "bg-zera-mint text-zera-green" : "bg-[#f7faf8] text-zera-muted"
                    }`}
                  >
                    {module.key}
                  </span>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <article className="rounded-md border border-zera-line p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <MapPin size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Branches</h4>
                  <p className="text-sm text-zera-muted">Locations connected to this business</p>
                </div>
              </div>
              <div className="space-y-3">
                {selectedBusiness.branches?.length ? (
                  selectedBusiness.branches.map((branch) => (
                    <div key={branch.id} className="rounded-md bg-[#f7faf8] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{branch.name}</p>
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${
                            branch.status === "ACTIVE" ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {branch.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zera-muted">{branch.location || "Location not set"}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-zera-line p-4 text-sm text-zera-muted">No branches yet.</p>
                )}
              </div>
            </article>

            <article className="rounded-md border border-zera-line p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="font-bold">Users</h4>
                  <p className="text-sm text-zera-muted">Owner and staff accounts</p>
                </div>
              </div>
              <div className="space-y-3">
                {selectedBusiness.memberships?.map((membership) => (
                  <div key={membership.id} className="rounded-md bg-[#f7faf8] px-3 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{membership.user.name}</p>
                        <p className="mt-1 text-sm text-zera-muted">{membership.user.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zera-muted">
                          {membership.role?.name || "No role"}
                        </span>
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${
                            membership.user.status === "ACTIVE" ? "bg-zera-mint text-zera-green" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {membership.user.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
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

function DetailMetric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-md bg-[#f7faf8] p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-white text-zera-green">
        <Icon size={20} />
      </div>
      <p className="text-sm font-medium text-zera-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-zera-ink">{value}</p>
    </article>
  );
}
