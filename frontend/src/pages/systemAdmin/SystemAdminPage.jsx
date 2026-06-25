import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  Hotel,
  KeyRound,
  MapPin,
  Pill,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Store,
  UserRound,
  Users,
  Utensils
} from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import StatCard from "../../components/StatCard.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateBranchStatus, updateBusinessModule } from "../../services/setupService.js";
import { getSystemBusinesses, provisionBusiness, updateSystemBusinessSettings } from "../../services/systemAdminService.js";

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

const businessTypeOptions = [
  {
    value: "Bar and restaurant",
    label: "Bar and restaurant",
    posMode: "TABLE_SERVICE",
    icon: Utensils,
    helper: "Table orders, waiter flow, bar tabs, and restaurant-style checkout."
  },
  {
    value: "Retail shop",
    label: "Retail shop",
    posMode: "RETAIL_CHECKOUT",
    icon: Store,
    helper: "Simple counter sales for daily retail shop workflows."
  },
  {
    value: "Supermarket",
    label: "Supermarket",
    posMode: "RETAIL_CHECKOUT",
    icon: ShoppingBasket,
    helper: "Fast item scanning and basket checkout foundation."
  },
  {
    value: "Pharmacy",
    label: "Pharmacy",
    posMode: "RETAIL_CHECKOUT",
    icon: Pill,
    helper: "Retail checkout now, batch and medicine controls later."
  },
  {
    value: "Hotel",
    label: "Hotel",
    posMode: "RETAIL_CHECKOUT",
    icon: Hotel,
    helper: "Guest, room, folio, and service sales will come later."
  }
];

const adminTabs = [
  { key: "overview", label: "Overview", icon: ShieldCheck },
  { key: "businesses", label: "Directory", icon: Store },
  { key: "details", label: "Details", icon: Building2 },
  { key: "settings", label: "Settings", icon: Settings }
];

function getBusinessTypeOption(type) {
  return businessTypeOptions.find((option) => option.value === type) || businessTypeOptions[1];
}

export default function SystemAdminPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleSavingKey, setModuleSavingKey] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [branchSavingId, setBranchSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedType = getBusinessTypeOption(form.businessType);

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
      return [business.name, business.type, business.country, business.currency, business.posMode, owner?.user?.name, owner?.user?.email]
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
          posMode: selectedType.posMode,
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
      setActiveTab("details");
      setMessage(`Business created. Owner login: ${form.ownerEmail}`);
      setForm(defaultForm);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create business account.");
    } finally {
      setSaving(false);
    }
  }

  function openBusinessDetails(businessId) {
    setSelectedBusinessId(businessId);
    setActiveTab("details");
  }

  function selectBusiness(businessId) {
    setSelectedBusinessId(businessId);
    setMessage("");
    setError("");
  }

  async function handleModuleToggle(key, active) {
    if (!selectedBusiness) {
      return;
    }

    setError("");
    setMessage("");
    setModuleSavingKey(key);

    try {
      const updatedModule = await updateBusinessModule(selectedBusiness.id, key, active);
      setBusinesses((current) =>
        current.map((business) =>
          business.id === selectedBusiness.id
            ? {
                ...business,
                modules: business.modules.map((module) => (module.key === updatedModule.key ? updatedModule : module))
              }
            : business
        )
      );
      setMessage(`${updatedModule.key} module ${updatedModule.active ? "enabled" : "disabled"} for ${selectedBusiness.name}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update module settings.");
    } finally {
      setModuleSavingKey("");
    }
  }

  async function handleBusinessSettingsSave(payload) {
    if (!selectedBusiness) {
      return;
    }

    setError("");
    setMessage("");
    setSettingsSaving(true);

    try {
      const updatedBusiness = await updateSystemBusinessSettings(selectedBusiness.id, payload);
      setBusinesses((current) => current.map((business) => (business.id === updatedBusiness.id ? updatedBusiness : business)));
      setMessage(`${updatedBusiness.name} settings updated.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update business settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleBranchStatusChange(branchId, status) {
    if (!selectedBusiness) {
      return;
    }

    setError("");
    setMessage("");
    setBranchSavingId(branchId);

    try {
      const updatedBranch = await updateBranchStatus(selectedBusiness.id, branchId, status);
      setBusinesses((current) =>
        current.map((business) =>
          business.id === selectedBusiness.id
            ? {
                ...business,
                branches: business.branches.map((branch) => (branch.id === updatedBranch.id ? updatedBranch : branch))
              }
            : business
        )
      );
      setMessage(`${updatedBranch.name} is now ${updatedBranch.status.toLowerCase()}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update branch status.");
    } finally {
      setBranchSavingId("");
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
    <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:h-[calc(100dvh-104px)] lg:min-h-0">
      <PageHeader
        eyebrow="Platform operations"
        title="Business control center"
        description="Choose a company from the header, then manage its setup, access, modules, and sales mode from the tabs below."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <CurrentBusinessSelector
              businesses={businesses}
              loading={loading}
              onChange={selectBusiness}
              onOpenBusinesses={() => setActiveTab("businesses")}
              selectedBusiness={selectedBusiness}
            />
            <Button className="shrink-0 gap-2" onClick={() => setActiveTab("create")}>
              <Plus size={17} />
              New business
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Building2} label="Businesses" value={loading ? "..." : platformTotals.businesses} helper="Customer workspaces" />
        <StatCard icon={MapPin} label="Branches" value={loading ? "..." : platformTotals.branches} helper="Connected locations" />
        <StatCard icon={Users} label="Users" value={loading ? "..." : platformTotals.users} helper="Owner and staff accounts" />
        <StatCard icon={Boxes} label="Products" value={loading ? "..." : platformTotals.products} helper="Across all businesses" />
      </section>

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      <section className="flex min-h-0 flex-1 flex-col rounded-md border border-zera-line bg-white">
        <div className="border-b border-zera-line p-3">
          <div className="flex gap-1 overflow-x-auto">
            {adminTabs.map((tab) => (
              <AdminTabButton key={tab.key} active={activeTab === tab.key} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.key)} />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === "create" ? (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-md border border-zera-line bg-zera-surface px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase text-zera-green">New workspace</p>
                <p className="mt-1 text-sm font-semibold">Create a business and its first owner account.</p>
              </div>
              <Button type="button" variant="ghost" className="shrink-0" onClick={() => setActiveTab("overview")}>
                Cancel
              </Button>
            </div>
          ) : null}

          {activeTab === "overview" ? (
            <OverviewTab
              businesses={businesses}
              loading={loading}
              onOpenBusiness={openBusinessDetails}
              onOpenSettings={(businessId) => {
                selectBusiness(businessId);
                setActiveTab("settings");
              }}
              selectedBusiness={selectedBusiness}
            />
          ) : null}

          {activeTab === "create" ? (
            <CreateBusinessTab
              form={form}
              onChange={setForm}
              onSubmit={handleSubmit}
              saving={saving}
              selectedType={selectedType}
            />
          ) : null}

          {activeTab === "businesses" ? (
            <BusinessesTab
              businesses={businesses}
              filteredBusinesses={filteredBusinesses}
              loading={loading}
              onOpenBusiness={openBusinessDetails}
              onSelectBusiness={selectBusiness}
              search={search}
              selectedBusiness={selectedBusiness}
              setSearch={setSearch}
            />
          ) : null}

          {activeTab === "details" ? (
            <BusinessDetailsTab
              activeBranches={selectedActiveBranches}
              activeModules={selectedActiveModules}
              activeUsers={selectedActiveUsers}
              business={selectedBusiness}
              owner={selectedOwner}
            />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsTab
              business={selectedBusiness}
              branchSavingId={branchSavingId}
              moduleSavingKey={moduleSavingKey}
              onBranchStatusChange={handleBranchStatusChange}
              onBusinessSave={handleBusinessSettingsSave}
              onModuleToggle={handleModuleToggle}
              onOpenBusinesses={() => setActiveTab("businesses")}
              settingsSaving={settingsSaving}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function OverviewTab({ businesses, loading, onOpenBusiness, onOpenSettings, selectedBusiness }) {
  const setupHealth = getPlatformSetupHealth(businesses);

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="min-w-0 rounded-lg border border-zera-line bg-[#f7faf8] p-4 sm:p-5">
        <SectionTitle icon={CheckCircle2} title="Setup health" subtitle="Readiness checks across all business accounts." />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SetupHealthRow
            label="Owner assigned"
            detail="Every business needs a primary owner account."
            value={loading ? "..." : `${setupHealth.withOwner}/${businesses.length}`}
            ready={!loading && setupHealth.withOwner === businesses.length && businesses.length > 0}
          />
          <SetupHealthRow
            label="Active branch"
            detail="At least one location is ready for daily operations."
            value={loading ? "..." : `${setupHealth.withActiveBranch}/${businesses.length}`}
            ready={!loading && setupHealth.withActiveBranch === businesses.length && businesses.length > 0}
          />
          <SetupHealthRow
            label="POS enabled"
            detail="The sales foundation is available to the business."
            value={loading ? "..." : `${setupHealth.withPOS}/${businesses.length}`}
            ready={!loading && setupHealth.withPOS === businesses.length && businesses.length > 0}
          />
          <SetupHealthRow
            label="Ready to operate"
            detail="Owner, branch, and POS are all prepared."
            value={loading ? "..." : `${setupHealth.ready}/${businesses.length}`}
            ready={!loading && setupHealth.ready === businesses.length && businesses.length > 0}
          />
        </div>
      </section>

      <article className="min-w-0 rounded-lg border border-zera-line p-4 sm:p-5">
        <SectionTitle icon={Store} title="Company workspace" subtitle="Manage the company selected in the top header." />
        {selectedBusiness ? (
          <div className="mt-4 rounded-md border border-zera-green/20 bg-zera-mint/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-zera-green">Currently managing</p>
                <h3 className="mt-1 truncate text-xl font-bold">{selectedBusiness.name}</h3>
                <p className="mt-1 text-sm text-zera-muted">
                  {selectedBusiness.type || "Business type not set"} · {selectedBusiness.country || "Country not set"} ·{" "}
                  {selectedBusiness.currency}
                </p>
              </div>
              <StatusPill label={selectedBusiness.status?.toLowerCase() || "active"} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="gap-2" onClick={() => onOpenBusiness(selectedBusiness.id)}>
                <Eye size={16} />
                Open details
              </Button>
              <Button className="gap-2" variant="secondary" onClick={() => onOpenSettings(selectedBusiness.id)}>
                <Settings size={16} />
                Settings
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState text="Create or select a company to begin managing its workspace." />
        )}
      </article>
    </div>
  );
}

function CreateBusinessTab({ form, onChange, onSubmit, saving, selectedType }) {
  return (
    <form className="mx-auto max-w-5xl" onSubmit={onSubmit}>
      <div className="mb-5 rounded-lg border border-zera-line bg-[#f7faf8] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">Create business</p>
            <h3 className="mt-1 text-2xl font-bold">Set up a new customer workspace</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zera-muted">
              Start with the business identity, choose how sales should work, then hand the owner a clean login to continue setup.
            </p>
          </div>
          <div className="rounded-md bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase text-zera-muted">Selected POS</p>
            <p className="mt-1 font-bold text-zera-green">{formatPOSMode(selectedType.posMode)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="rounded-lg border border-zera-line p-5">
          <SectionTitle icon={Building2} title="Business setup" subtitle="Account basics, first branch, and business type." />

          <div className="mt-5 space-y-5">
            <Input
              label="Business name"
              placeholder="Bamboo Bar and Restaurant"
              value={form.businessName}
              onChange={(event) => onChange({ ...form, businessName: event.target.value })}
              required
            />

            <BusinessTypePicker value={form.businessType} onChange={(businessType) => onChange({ ...form, businessType })} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Country" value={form.country} onChange={(event) => onChange({ ...form, country: event.target.value })} />
              <Input
                label="Currency"
                value={form.currency}
                onChange={(event) => onChange({ ...form, currency: event.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Branch name" value={form.branchName} onChange={(event) => onChange({ ...form, branchName: event.target.value })} />
              <Input
                label="Branch location"
                placeholder="Kampala, Lubaga..."
                value={form.branchLocation}
                onChange={(event) => onChange({ ...form, branchLocation: event.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zera-line bg-[#f7faf8] p-5">
          <SectionTitle icon={KeyRound} title="Owner login" subtitle="First admin account for this business." />

          <div className="mt-5 space-y-4">
            <Input label="Owner name" value={form.ownerName} onChange={(event) => onChange({ ...form, ownerName: event.target.value })} required />
            <Input
              label="Owner email"
              type="email"
              value={form.ownerEmail}
              onChange={(event) => onChange({ ...form, ownerEmail: event.target.value })}
              required
            />
            <Input
              label="Temporary password"
              type="text"
              value={form.ownerPassword}
              onChange={(event) => onChange({ ...form, ownerPassword: event.target.value })}
              required
              minLength={8}
            />
          </div>

          <div className="mt-5 rounded-md border border-zera-line bg-white p-4">
            <p className="text-sm font-semibold text-zera-green">POS foundation</p>
            <p className="mt-1 text-lg font-bold">{formatPOSMode(selectedType.posMode)}</p>
            <p className="mt-2 text-sm leading-6 text-zera-muted">{selectedType.helper}</p>
          </div>

          <Button className="mt-5 w-full gap-2" disabled={saving}>
            <Plus size={17} />
            {saving ? "Creating business..." : "Create business account"}
          </Button>
        </section>
      </div>
    </form>
  );
}

function BusinessesTab({
  businesses,
  filteredBusinesses,
  loading,
  onOpenBusiness,
  onSelectBusiness,
  search,
  selectedBusiness,
  setSearch
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionTitle icon={Store} title="Company directory" subtitle={loading ? "Loading business accounts..." : "Search, select, or open a company workspace."} />
        <label className="block md:w-96">
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
      </div>

      <div className="mt-5 grid gap-3">
        {!loading && businesses.length === 0 ? <EmptyState text="No business accounts have been created yet." /> : null}
        {!loading && businesses.length > 0 && filteredBusinesses.length === 0 ? <EmptyState text="No businesses match your search." /> : null}
        {filteredBusinesses.map((business) => (
          <BusinessListItem
            key={business.id}
            business={business}
            selected={selectedBusiness?.id === business.id}
            onOpenDetails={() => onOpenBusiness(business.id)}
            onSelect={() => onSelectBusiness(business.id)}
          />
        ))}
      </div>
    </div>
  );
}

function BusinessDetailsTab({ activeBranches, activeModules, activeUsers, business, owner }) {
  if (!business) {
    return <EmptyState text="Select a business from the directory to view its setup details." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-zera-line bg-[#f7faf8] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zera-green">Current business</p>
            <h3 className="mt-1 text-2xl font-bold">{business.name}</h3>
            <p className="mt-2 text-sm text-zera-muted">
              {business.type || "Business type not set"} - {business.country || "Country not set"} - {business.currency}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={business.status?.toLowerCase() || "active"} />
            <StatusPill label={formatPOSMode(business.posMode || getBusinessTypeOption(business.type).posMode)} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <DetailMetric icon={MapPin} label="Active branches" value={`${activeBranches.length}/${business.branches?.length || 0}`} />
        <DetailMetric icon={Boxes} label="Active modules" value={`${activeModules.length}/${business.modules?.length || 0}`} />
        <DetailMetric icon={Users} label="Active users" value={`${activeUsers.length}/${business.memberships?.length || 0}`} />
        <DetailMetric icon={Store} label="Products" value={business._count?.products || 0} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <InfoPanel icon={UserRound} title="Owner login" subtitle="Primary business admin">
          <p className="font-semibold">{owner?.user?.name || "Owner not set"}</p>
          <p className="mt-1 text-sm text-zera-muted">{owner?.user?.email || "Email not set"}</p>
        </InfoPanel>

        <InfoPanel icon={Utensils} title="POS foundation" subtitle="Driven by the business type selected by System Admin">
          <p className="font-semibold">{formatPOSMode(business.posMode || getBusinessTypeOption(business.type).posMode)}</p>
          <p className="mt-2 text-sm leading-6 text-zera-muted">{getBusinessTypeOption(business.type).helper}</p>
        </InfoPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <InfoPanel icon={MapPin} title="Branches" subtitle="Locations connected to this business">
          <div className="space-y-3">
            {business.branches?.length ? (
              business.branches.map((branch) => (
                <div key={branch.id} className="rounded-md bg-[#f7faf8] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{branch.name}</p>
                    <StatusPill label={branch.status === "ACTIVE" ? "Active" : "Inactive"} />
                  </div>
                  <p className="mt-1 text-sm text-zera-muted">{branch.location || "Location not set"}</p>
                </div>
              ))
            ) : (
              <EmptyState text="No branches yet." />
            )}
          </div>
        </InfoPanel>

        <InfoPanel icon={Users} title="Users" subtitle="Owner and staff accounts">
          <div className="space-y-3">
            {business.memberships?.map((membership) => (
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
                    <StatusPill label={membership.user.status === "ACTIVE" ? "Active" : "Inactive"} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </InfoPanel>
      </section>
    </div>
  );
}

function SettingsTab({
  branchSavingId,
  business,
  moduleSavingKey,
  onBranchStatusChange,
  onBusinessSave,
  onModuleToggle,
  onOpenBusinesses,
  settingsSaving
}) {
  const [settingsForm, setSettingsForm] = useState(() => getBusinessSettingsForm(business));

  useEffect(() => {
    setSettingsForm(getBusinessSettingsForm(business));
  }, [business?.id, business?.name, business?.type, business?.country, business?.currency, business?.status, business?.posMode]);

  if (!business) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState text="Select a business first, then come back to Settings to manage modules and platform controls." />
        <Button className="mt-4 gap-2" onClick={onOpenBusinesses}>
          <Store size={17} />
          Choose business
        </Button>
      </div>
    );
  }

  const activeModules = business.modules?.filter((module) => module.active) || [];
  const selectedType = getBusinessTypeOption(settingsForm.type);

  function submitSettings(event) {
    event.preventDefault();
    onBusinessSave({
      ...settingsForm,
      posMode: selectedType.posMode
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-zera-line bg-[#f7faf8] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle icon={Settings} title="Business settings" subtitle="System-level controls for the selected business." />
          <div className="flex flex-wrap gap-2">
            <StatusPill label={business.status?.toLowerCase() || "active"} />
            <StatusPill label={formatPOSMode(business.posMode || getBusinessTypeOption(business.type).posMode)} />
            <StatusPill label={`${activeModules.length}/${business.modules?.length || 0} modules active`} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <form className="rounded-lg border border-zera-line p-5" onSubmit={submitSettings}>
            <SectionTitle icon={Building2} title="Business profile" subtitle="Identity, type, currency, and workspace access." />

            <div className="mt-5 space-y-4">
              <Input
                label="Business name"
                value={settingsForm.name}
                onChange={(event) => setSettingsForm({ ...settingsForm, name: event.target.value })}
                required
              />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zera-ink">Type of business</span>
                <select
                  className="min-h-12 w-full rounded-md border border-zera-line bg-white px-3 text-base text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={settingsForm.type}
                  onChange={(event) => setSettingsForm({ ...settingsForm, type: event.target.value })}
                >
                  {businessTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Country"
                  value={settingsForm.country}
                  onChange={(event) => setSettingsForm({ ...settingsForm, country: event.target.value })}
                />
                <Input
                  label="Currency"
                  value={settingsForm.currency}
                  onChange={(event) => setSettingsForm({ ...settingsForm, currency: event.target.value.toUpperCase() })}
                />
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zera-ink">Business status</span>
                <select
                  className="min-h-12 w-full rounded-md border border-zera-line bg-white px-3 text-base text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                  value={settingsForm.status}
                  onChange={(event) => setSettingsForm({ ...settingsForm, status: event.target.value })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-md border border-zera-line bg-[#f7faf8] p-4">
              <p className="text-sm font-semibold text-zera-green">Resulting POS foundation</p>
              <p className="mt-1 font-bold">{formatPOSMode(selectedType.posMode)}</p>
              <p className="mt-2 text-sm leading-6 text-zera-muted">{selectedType.helper}</p>
            </div>

            <Button className="mt-5 w-full" disabled={settingsSaving}>
              {settingsSaving ? "Saving settings..." : "Save business settings"}
            </Button>
          </form>

          <section className="rounded-lg border border-zera-line p-5">
            <SectionTitle icon={MapPin} title="Branch access" subtitle="Keep locations active only when they are ready to operate." />

            <div className="mt-5 space-y-3">
              {business.branches?.length ? (
                business.branches.map((branch) => (
                  <div key={branch.id} className="flex flex-col gap-3 rounded-md bg-[#f7faf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{branch.name}</p>
                      <p className="mt-1 text-sm text-zera-muted">{branch.location || "Location not set"}</p>
                    </div>
                    <button
                      type="button"
                      className={`min-h-10 rounded-md px-4 text-sm font-semibold transition ${
                        branch.status === "ACTIVE"
                          ? "border border-zera-line bg-white text-zera-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          : "bg-zera-green text-white hover:bg-[#116832]"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={branchSavingId === branch.id}
                      onClick={() => onBranchStatusChange(branch.id, branch.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                    >
                      {branchSavingId === branch.id
                        ? "Saving..."
                        : branch.status === "ACTIVE"
                          ? "Deactivate branch"
                          : "Activate branch"}
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState text="No branches are connected to this business." />
              )}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-zera-line p-5">
          <SectionTitle icon={Boxes} title="Module activation" subtitle="Choose which foundations this business can access." />

          <div className="mt-5 rounded-md border border-zera-line bg-[#f7faf8] p-4">
            <p className="font-semibold">Keep the workspace focused</p>
            <p className="mt-2 text-sm leading-6 text-zera-muted">
              Enable a module only when the business is ready to use it. This keeps navigation simple for cashiers, managers, and owners.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {(business.modules || []).map((module) => (
              <ModuleToggleCard
                key={module.id}
                module={module}
                saving={moduleSavingKey === module.key}
                onToggle={(active) => onModuleToggle(module.key, active)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminTabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
        active ? "bg-zera-green text-white shadow-soft" : "bg-[#f7faf8] text-zera-muted hover:bg-zera-mint hover:text-zera-ink"
      }`}
      onClick={onClick}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}

function CurrentBusinessSelector({ businesses, loading, onChange, onOpenBusinesses, selectedBusiness }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectorRef = useRef(null);
  const visibleBusinesses = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm) {
      return businesses;
    }

    return businesses.filter((business) => {
      const owner = business.memberships?.find((membership) => membership.role?.name === "Owner");
      return [business.name, business.type, business.country, business.currency, business.posMode, owner?.user?.name, owner?.user?.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchTerm));
    });
  }, [businesses, query]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function chooseBusiness(businessId) {
    onChange(businessId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={selectorRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-md border border-zera-line bg-white px-3 text-left transition hover:border-zera-green focus:border-zera-green focus:outline-none focus:ring-4 focus:ring-zera-green/10 sm:w-[340px]"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={loading || businesses.length === 0}
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
          <Building2 size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase text-zera-muted">Manage company</p>
          <p className="truncate text-sm font-bold text-zera-ink">
            {loading ? "Loading companies..." : selectedBusiness?.name || "No companies yet"}
          </p>
        </div>
        <ChevronDown className={`shrink-0 text-zera-muted transition ${open ? "rotate-180" : ""}`} size={16} />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-[min(460px,calc(100vw-32px))] overflow-hidden rounded-md border border-zera-line bg-white shadow-xl">
          <div className="border-b border-zera-line p-3">
            <p className="text-xs font-bold uppercase text-zera-muted">Switch company</p>
            <label className="mt-2 flex min-h-10 items-center gap-2 rounded-md border border-zera-line px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
              <Search size={16} className="shrink-0 text-zera-muted" />
              <span className="sr-only">Search companies</span>
              <input
                autoFocus
                className="w-full border-0 bg-transparent text-sm outline-none"
                placeholder="Search name, type, or owner"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="max-h-72 overflow-y-auto p-2" role="listbox" aria-label="Companies">
            {visibleBusinesses.length ? (
              visibleBusinesses.map((business) => {
                const selected = business.id === selectedBusiness?.id;
                const owner = business.memberships?.find((membership) => membership.role?.name === "Owner");
                const mode = business.posMode || getBusinessTypeOption(business.type).posMode;

                return (
                  <button
                    key={business.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition ${
                      selected ? "bg-zera-mint text-zera-ink" : "hover:bg-[#f7faf8]"
                    }`}
                    role="option"
                    aria-selected={selected}
                    onClick={() => chooseBusiness(business.id)}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        selected ? "bg-white text-zera-green" : "bg-[#f7faf8] text-zera-muted"
                      }`}
                    >
                      <Store size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{business.name}</p>
                      <p className="mt-0.5 truncate text-xs text-zera-muted">
                        {business.type || "Business"} · {formatPOSMode(mode)} · {business.currency}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zera-muted">Owner: {owner?.user?.email || "Not assigned"}</p>
                    </div>
                    {selected ? <CheckCircle2 size={18} className="shrink-0 text-zera-green" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-zera-muted">No companies match your search.</p>
            )}
          </div>

          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-zera-line bg-[#f7faf8] px-4 text-sm font-semibold text-zera-green transition hover:bg-zera-mint"
            onClick={() => {
              setOpen(false);
              onOpenBusinesses();
            }}
          >
            <Building2 size={16} />
            View all {businesses.length} businesses
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BusinessListItem({ business, onOpenDetails, onSelect, selected }) {
  const owner = business.memberships?.find((membership) => membership.role?.name === "Owner");
  const mode = business.posMode || getBusinessTypeOption(business.type).posMode;

  return (
    <article
      className={`w-full rounded-md border p-4 text-left transition ${
        selected ? "border-zera-green bg-zera-mint/60 shadow-soft" : "border-zera-line bg-white hover:border-zera-green/60"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h4 className="truncate font-bold">{business.name}</h4>
            {selected ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-zera-green">
                <CheckCircle2 size={13} />
                Current
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zera-muted">
            {business.type || "Business"} · {business.country || "Country not set"} · {business.currency}
          </p>
          <p className="mt-1 truncate text-sm text-zera-muted">
            Owner: {owner?.user?.name || "Not set"} {owner?.user?.email ? `(${owner.user.email})` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
                <StatusPill label={formatPOSMode(mode)} />
                <StatusPill label={`${business.branches?.length || 0} branch${business.branches?.length === 1 ? "" : "es"}`} />
              </div>
          <div className="flex gap-2">
            {!selected ? (
              <Button className="flex-1 sm:flex-none" variant="secondary" onClick={onSelect}>
                Select
              </Button>
            ) : null}
            <Button className="flex-1 gap-2 sm:flex-none" onClick={onOpenDetails}>
              <Eye size={16} />
              Details
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function BusinessTypePicker({ onChange, value }) {
  return (
    <div>
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label className="block text-sm font-semibold text-zera-ink">Type of business</label>
          <p className="text-sm text-zera-muted">This controls the POS experience the business will receive.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {businessTypeOptions.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`rounded-md border p-4 text-left transition ${
                selected ? "border-zera-green bg-zera-mint/70 shadow-soft" : "border-zera-line bg-white hover:border-zera-green hover:bg-[#f7faf8]"
              }`}
              onClick={() => onChange(option.value)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-zera-green">
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{option.label}</p>
                    {selected ? <CheckCircle2 size={16} className="text-zera-green" /> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-zera-muted">{option.helper}</p>
                  <p className="mt-3 inline-flex rounded-md bg-zera-mint px-2 py-1 text-xs font-semibold text-zera-green">
                    {formatPOSMode(option.posMode)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModuleToggleCard({ module, onToggle, saving }) {
  return (
    <article className={`rounded-md border p-4 ${module.active ? "border-zera-green bg-zera-mint/60" : "border-zera-line bg-[#f7faf8]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold">{module.name || module.key}</p>
          <p className="mt-1 text-sm text-zera-muted">{getModuleDescription(module.key)}</p>
        </div>
        <button
          type="button"
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${
            module.active ? "bg-zera-green" : "bg-zera-line"
          } disabled:cursor-not-allowed disabled:opacity-70`}
          onClick={() => onToggle(!module.active)}
          disabled={saving}
          aria-label={`${module.active ? "Disable" : "Enable"} ${module.name || module.key}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
              module.active ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <StatusPill label={saving ? "Saving" : module.active ? "Enabled" : "Disabled"} />
        <span className="text-xs font-semibold text-zera-muted">{module.key}</span>
      </div>
    </article>
  );
}

function SetupHealthRow({ detail, label, ready, value }) {
  return (
    <article className="rounded-md border border-zera-line bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
            ready ? "bg-zera-mint text-zera-green" : "bg-[#f7faf8] text-zera-muted"
          }`}
        >
          <CheckCircle2 size={18} />
        </div>
        <span className="shrink-0 text-lg font-bold text-zera-ink">{value}</span>
      </div>
      <p className="mt-3 font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-5 text-zera-muted">{detail}</p>
    </article>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-md border border-dashed border-zera-line p-5 text-sm text-zera-muted">{text}</div>;
}

function InfoPanel({ children, icon: Icon, subtitle, title }) {
  return (
    <article className="rounded-md border border-zera-line p-4">
      <SectionTitle icon={Icon} title={title} subtitle={subtitle} compact />
      <div className="mt-4">{children}</div>
    </article>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="rounded-md border border-zera-line bg-[#f7faf8] p-3">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-white text-zera-green">
        <Icon size={18} />
      </div>
      <p className="text-xs font-medium text-zera-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-zera-ink">{value}</p>
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

function SectionTitle({ compact = false, icon: Icon, subtitle, title }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`${compact ? "h-10 w-10" : "h-11 w-11"} flex items-center justify-center rounded-md bg-zera-mint text-zera-green`}>
        <Icon size={compact ? 20 : 22} />
      </div>
      <div className="min-w-0">
        <h3 className={`${compact ? "text-base" : "text-lg"} font-bold`}>{title}</h3>
        <p className="text-sm leading-5 text-zera-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusPill({ label }) {
  return <span className="rounded-md bg-zera-mint px-3 py-2 text-xs font-semibold capitalize text-zera-green">{label}</span>;
}

function formatPOSMode(posMode = "RETAIL_CHECKOUT") {
  return posMode === "TABLE_SERVICE" ? "Table-service POS" : "Retail checkout POS";
}

function getBusinessSettingsForm(business) {
  return {
    name: business?.name || "",
    type: business?.type || "Retail shop",
    country: business?.country || "Uganda",
    currency: business?.currency || "UGX",
    status: business?.status || "ACTIVE",
    posMode: business?.posMode || getBusinessTypeOption(business?.type).posMode
  };
}

function getPlatformSetupHealth(businesses) {
  return businesses.reduce(
    (health, business) => {
      const hasOwner = business.memberships?.some((membership) => membership.role?.name === "Owner");
      const hasActiveBranch = business.branches?.some((branch) => branch.status === "ACTIVE");
      const hasPOS = business.modules?.some((module) => module.key === "POS" && module.active);

      if (hasOwner) health.withOwner += 1;
      if (hasActiveBranch) health.withActiveBranch += 1;
      if (hasPOS) health.withPOS += 1;
      if (hasOwner && hasActiveBranch && hasPOS) health.ready += 1;

      return health;
    },
    {
      withOwner: 0,
      withActiveBranch: 0,
      withPOS: 0,
      ready: 0
    }
  );
}

function getModuleDescription(key) {
  const descriptions = {
    POS: "Sales, checkout, receipts, customers, and product selling flow.",
    INVENTORY: "Stock control, purchasing, transfers, and warehouse readiness.",
    FINANCE: "Cash, expenses, reports, and future accounting controls.",
    OPERATIONS: "Daily operations for restaurants, hotels, warehouses, and service flows.",
    REPORTS: "Business intelligence, summaries, exports, and management views."
  };

  return descriptions[key] || "Business capability controlled by System Admin.";
}
