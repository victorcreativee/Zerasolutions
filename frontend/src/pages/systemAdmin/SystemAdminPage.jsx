import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  CheckCircle2,
  Hotel,
  KeyRound,
  MapPin,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Store,
  UserCheck,
  UserX,
  Users,
  Utensils,
  X
} from "lucide-react";
import Button from "../../components/Button.jsx";
import Input from "../../components/Input.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateBranchStatus, updateBusinessModule } from "../../services/setupService.js";
import { getSystemBusinesses, provisionBusiness, updateSystemBusinessSettings } from "../../services/systemAdminService.js";
import { createBusinessUser, updateBusinessUserStatus } from "../../services/teamService.js";

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

const defaultUserForm = {
  name: "",
  email: "",
  password: "",
  roleName: ""
};

const businessTypeOptions = [
  {
    value: "Bar and restaurant",
    label: "Bar and restaurant",
    posMode: "TABLE_SERVICE",
    icon: Utensils,
    helper: "Tables, waiters, open bills, and cashier settlement."
  },
  {
    value: "Retail shop",
    label: "Retail shop",
    posMode: "RETAIL_CHECKOUT",
    icon: Store,
    helper: "Simple counter sales for daily shop workflows."
  },
  {
    value: "Electronics shop",
    label: "Electronics shop",
    posMode: "RETAIL_CHECKOUT",
    icon: Smartphone,
    helper: "Device, accessory, stock, receipt, and repair-service foundations."
  },
  {
    value: "Supermarket",
    label: "Supermarket",
    posMode: "RETAIL_CHECKOUT",
    icon: ShoppingBasket,
    helper: "Fast checkout for baskets, barcodes, and many products."
  },
  {
    value: "Pharmacy",
    label: "Pharmacy",
    posMode: "RETAIL_CHECKOUT",
    icon: Pill,
    helper: "Pharmacy sales now, batch and medicine controls later."
  },
  {
    value: "Hotel",
    label: "Hotel",
    posMode: "RETAIL_CHECKOUT",
    icon: Hotel,
    helper: "Front-desk service sales now, room and folio workflows later."
  }
];

const platformProducts = [
  {
    key: "POS",
    title: "Zera POS",
    icon: Store,
    summary: "Fast sales for retail, electronics, supermarkets, pharmacies, bars, and restaurants.",
    detail: "Supports retail checkout and table-service workflows so each business sells in the way that matches its daily work."
  },
  {
    key: "INVENTORY",
    title: "Inventory",
    icon: Boxes,
    summary: "Products, stock visibility, branches, and warehouse foundations.",
    detail: "Designed to grow from simple product records into stock transfers, reorder alerts, and multi-location inventory."
  },
  {
    key: "FINANCE",
    title: "Finance",
    icon: ShieldCheck,
    summary: "Cash, expenses, payment tracking, and business reporting.",
    detail: "Keeps owner and manager finance workflows understandable before adding heavier accounting features."
  },
  {
    key: "OPERATIONS",
    title: "Operations",
    icon: Settings,
    summary: "Business-type workflows for restaurants, hotels, pharmacies, and services.",
    detail: "Keeps Zera modular so every business sees the tools it needs, not a crowded ERP interface."
  },
  {
    key: "REPORTS",
    title: "Reports",
    icon: Users,
    summary: "Daily, weekly, and monthly summaries for owners and managers.",
    detail: "Turns POS, inventory, and team activity into clear decisions without overwhelming small business teams."
  }
];

const selectedBusinessStorageKey = "zera_system_admin_selected_business";

function getBusinessTypeOption(type = "") {
  const normalizedType = type.toLowerCase();
  return (
    businessTypeOptions.find((option) => option.value === type) ||
    businessTypeOptions.find((option) => normalizedType && (normalizedType.includes(option.value.toLowerCase()) || option.value.toLowerCase().includes(normalizedType))) ||
    businessTypeOptions[1]
  );
}

export default function SystemAdminPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [selectedBusinessId, setSelectedBusinessId] = useState(() => localStorage.getItem(selectedBusinessStorageKey) || "");
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedProductKey, setSelectedProductKey] = useState("POS");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleSavingKey, setModuleSavingKey] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [branchSavingId, setBranchSavingId] = useState("");
  const [userSaving, setUserSaving] = useState(false);
  const [userSavingId, setUserSavingId] = useState("");
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
      localStorage.removeItem(selectedBusinessStorageKey);
      return;
    }

    if (!businesses.some((business) => business.id === selectedBusinessId)) {
      setSelectedBusinessId(businesses[0].id);
    }
  }, [businesses, selectedBusinessId]);

  useEffect(() => {
    if (selectedBusinessId) {
      localStorage.setItem(selectedBusinessStorageKey, selectedBusinessId);
    }
  }, [selectedBusinessId]);

  const filteredBusinesses = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return businesses;
    }

    return businesses.filter((business) => {
      const owner = getOwner(business);
      return [business.name, business.type, business.country, business.currency, business.posMode, owner?.user?.name, owner?.user?.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchTerm));
    });
  }, [businesses, search]);

  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId) || filteredBusinesses[0] || null;
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
      setError("");
      const data = await getSystemBusinesses();
      setBusinesses(data);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load system admin data.");
    } finally {
      setLoading(false);
    }
  }

  function selectBusiness(businessId) {
    setSelectedBusinessId(businessId);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const selectedType = getBusinessTypeOption(form.businessType);
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
      setActiveSection("settings");
      setMessage(`Business created. Owner login: ${form.ownerEmail}`);
      setForm(defaultForm);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create business account.");
    } finally {
      setSaving(false);
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

  async function handleCreateBusinessUser(payload) {
    if (!selectedBusiness) {
      return null;
    }

    setError("");
    setMessage("");
    setUserSaving(true);

    try {
      const createdMembership = await createBusinessUser(selectedBusiness.id, payload);
      setBusinesses((current) =>
        current.map((business) =>
          business.id === selectedBusiness.id
            ? {
                ...business,
                memberships: [...(business.memberships || []), createdMembership]
              }
            : business
        )
      );
      setMessage(`${createdMembership.user.name} can now access ${selectedBusiness.name}.`);
      return createdMembership;
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create user account.");
      return null;
    } finally {
      setUserSaving(false);
    }
  }

  async function handleBusinessUserStatusChange(membership) {
    if (!selectedBusiness) {
      return;
    }

    const nextStatus = membership.user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError("");
    setMessage("");
    setUserSavingId(membership.id);

    try {
      const updatedMembership = await updateBusinessUserStatus(selectedBusiness.id, membership.id, nextStatus);
      setBusinesses((current) =>
        current.map((business) =>
          business.id === selectedBusiness.id
            ? {
                ...business,
                memberships: business.memberships.map((item) => (item.id === updatedMembership.id ? updatedMembership : item))
              }
            : business
        )
      );
      setMessage(`${updatedMembership.user.name} is now ${updatedMembership.user.status.toLowerCase()}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update user status.");
    } finally {
      setUserSavingId("");
    }
  }

  if (user?.systemRole !== "SYSTEM_ADMIN") {
    return (
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-md border border-zera-line bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
            <ShieldCheck size={23} />
          </div>
          <h2 className="mt-4 text-xl font-bold">System admin access required</h2>
          <p className="mt-2 text-sm leading-6 text-zera-muted">
            This area is only for Zera system administrators who create and provision business accounts.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <PageHeader
        eyebrow="Platform operations"
        title="System admin"
        description="Manage Zera as a modular business platform, then give each company only the tools it needs."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" className="gap-2" onClick={loadBusinesses}>
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button type="button" className="gap-2" onClick={() => setActiveSection("create")}>
              <Plus size={16} />
              New business
            </Button>
          </div>
        }
      />

      <SystemAdminNav activeSection={activeSection} onChange={setActiveSection} />

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      {activeSection === "overview" ? (
        <OverviewSection
          businesses={businesses}
          filteredBusinesses={filteredBusinesses}
          loading={loading}
          onCreate={() => setActiveSection("create")}
          onManage={() => setActiveSection("settings")}
          onProductSelect={setSelectedProductKey}
          onSearch={setSearch}
          onSelect={selectBusiness}
          platformTotals={platformTotals}
          search={search}
          selectedBusiness={selectedBusiness}
          selectedProductKey={selectedProductKey}
        />
      ) : null}

      {activeSection === "create" ? (
        <CreateBusinessPanel
          form={form}
          onCancel={() => setActiveSection("overview")}
          onChange={setForm}
          onSubmit={handleSubmit}
          saving={saving}
        />
      ) : null}

      {activeSection === "settings" ? (
        <SettingsSection
          branchSavingId={branchSavingId}
          business={selectedBusiness}
          businesses={businesses}
          filteredBusinesses={filteredBusinesses}
          loading={loading}
          onCreate={() => setActiveSection("create")}
          onSearch={setSearch}
          onSelect={selectBusiness}
          moduleSavingKey={moduleSavingKey}
          onBranchStatusChange={handleBranchStatusChange}
          onBusinessSave={handleBusinessSettingsSave}
          onCreateUser={handleCreateBusinessUser}
          onModuleToggle={handleModuleToggle}
          onUserStatusChange={handleBusinessUserStatusChange}
          search={search}
          settingsSaving={settingsSaving}
          userSaving={userSaving}
          userSavingId={userSavingId}
        />
      ) : null}
    </div>
  );
}

function SystemAdminNav({ activeSection, onChange }) {
  const sections = [
    { key: "overview", label: "Overview" },
    { key: "create", label: "Create business" },
    { key: "settings", label: "Company settings" }
  ];

  return (
    <nav className="flex w-fit rounded-md border border-zera-line bg-white p-1">
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          className={`min-h-9 rounded-md px-4 text-sm font-semibold transition ${
            activeSection === section.key ? "bg-zera-green text-white" : "text-zera-muted hover:bg-zera-mint hover:text-zera-ink"
          }`}
          onClick={() => onChange(section.key)}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

function OverviewSection({
  businesses,
  filteredBusinesses,
  loading,
  onCreate,
  onManage,
  onProductSelect,
  onSearch,
  onSelect,
  platformTotals,
  search,
  selectedBusiness,
  selectedProductKey
}) {
  const selectedProduct = platformProducts.find((product) => product.key === selectedProductKey) || platformProducts[0];

  return (
    <section className="space-y-4">
      <article className="rounded-lg border border-zera-line bg-white p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Zera Solutions</p>
            <h2 className="mt-2 text-2xl font-bold text-zera-ink">Simple business software for African SMEs</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zera-muted">
              Zera is built for pharmacies, supermarkets, retail shops, bars, restaurants, hotels, warehouses, and service businesses.
              System Admin decides the business type and active modules, while each business owner gets a focused workspace for daily work.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <OverviewStat label="Businesses" value={loading ? "..." : platformTotals.businesses} />
            <OverviewStat label="Branches" value={loading ? "..." : platformTotals.branches} />
            <OverviewStat label="Users" value={loading ? "..." : platformTotals.users} />
            <OverviewStat label="Products" value={loading ? "..." : platformTotals.products} />
          </div>
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-zera-line bg-white p-4">
          <SectionTitle icon={Boxes} title="Products" subtitle="Select a Zera product foundation to understand what it controls." />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {platformProducts.map((product) => (
              <ProductCard
                key={product.key}
                product={product}
                selected={product.key === selectedProduct.key}
                onSelect={() => onProductSelect(product.key)}
              />
            ))}
          </div>
          <SelectedProductPanel product={selectedProduct} />
        </section>

        <BusinessOverviewSelector
          businesses={businesses}
          filteredBusinesses={filteredBusinesses}
          loading={loading}
          onCreate={onCreate}
          onManage={onManage}
          onSearch={onSearch}
          onSelect={onSelect}
          search={search}
          selectedBusiness={selectedBusiness}
        />
      </div>
    </section>
  );
}

function OverviewStat({ label, value }) {
  return (
    <div className="rounded-md bg-[#f7faf8] px-3 py-3">
      <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function ProductCard({ onSelect, product, selected }) {
  const Icon = product.icon;

  return (
    <button
      type="button"
      className={`rounded-md border p-4 text-left transition ${
        selected ? "border-zera-green bg-zera-mint shadow-soft" : "border-zera-line bg-white hover:border-zera-green hover:bg-[#f7faf8]"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${selected ? "bg-white" : "bg-zera-mint"} text-zera-green`}>
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold">{product.title}</h3>
            {selected ? <CheckCircle2 size={16} className="text-zera-green" /> : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-zera-muted">{product.summary}</p>
        </div>
      </div>
    </button>
  );
}

function SelectedProductPanel({ product }) {
  return (
    <div className="mt-4 rounded-md border border-zera-green/20 bg-[#f7faf8] p-4">
      <p className="text-sm font-semibold text-zera-green">{product.title}</p>
      <p className="mt-1 text-sm leading-6 text-zera-muted">{product.detail}</p>
    </div>
  );
}

function BusinessOverviewSelector({
  businesses,
  filteredBusinesses,
  loading,
  onCreate,
  onManage,
  onSearch,
  onSelect,
  search,
  selectedBusiness
}) {
  const owner = getOwner(selectedBusiness);
  const posMode = selectedBusiness?.posMode || getBusinessTypeOption(selectedBusiness?.type).posMode;

  return (
    <aside className="rounded-lg border border-zera-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle icon={Building2} title="Business" subtitle="Choose the company you want to manage." />
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green transition hover:bg-green-100"
          onClick={onCreate}
          aria-label="Create business"
        >
          <Plus size={18} />
        </button>
      </div>

      <label className="mt-4 flex min-h-10 items-center gap-2 rounded-md border border-zera-line bg-[#f7faf8] px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
        <Search size={17} className="text-zera-muted" />
        <span className="sr-only">Search businesses</span>
        <input
          className="w-full border-0 bg-transparent text-sm outline-none"
          placeholder="Search business or owner"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-2 block text-xs font-bold uppercase text-zera-muted">Selected company</span>
        <select
          className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
          value={selectedBusiness?.id || ""}
          onChange={(event) => onSelect(event.target.value)}
          disabled={loading || filteredBusinesses.length === 0}
        >
          {!selectedBusiness ? <option value="">No business selected</option> : null}
          {filteredBusinesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name} - {business.type || "Business"}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3">
        {!loading && businesses.length === 0 ? <EmptyState text="No businesses yet. Create the first workspace." /> : null}
        {!loading && businesses.length > 0 && filteredBusinesses.length === 0 ? <EmptyState text="No businesses match your search." /> : null}
        {selectedBusiness ? (
          <div className="rounded-md border border-zera-green/20 bg-[#f7faf8] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold">{selectedBusiness.name}</p>
                <p className="mt-1 truncate text-sm text-zera-muted">
                  {selectedBusiness.type || "Business type not set"} / {selectedBusiness.country || "Country not set"} /{" "}
                  {selectedBusiness.currency || "Currency not set"}
                </p>
              </div>
              <StatusPill label={selectedBusiness.status?.toLowerCase() || "active"} />
            </div>
            <div className="mt-3 grid gap-2">
              <CompactBusinessFact label="POS mode" value={formatPOSMode(posMode, selectedBusiness.type)} />
              <CompactBusinessFact label="Owner" value={owner?.user?.email || "Not assigned"} />
              <CompactBusinessFact label="Branches" value={`${selectedBusiness.branches?.length || 0}`} />
            </div>
          </div>
        ) : null}
      </div>

      <Button type="button" className="mt-4 w-full gap-2" onClick={onManage} disabled={!selectedBusiness}>
        <Settings size={16} />
        Manage business
      </Button>
    </aside>
  );
}

function CompactBusinessFact({ label, value }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
      <span className="shrink-0 text-xs font-bold uppercase text-zera-muted">{label}</span>
      <span className="truncate text-right text-sm font-semibold text-zera-ink">{value}</span>
    </div>
  );
}

function SettingsSection({
  branchSavingId,
  business,
  businesses,
  filteredBusinesses,
  loading,
  moduleSavingKey,
  onBranchStatusChange,
  onBusinessSave,
  onCreateUser,
  onCreate,
  onModuleToggle,
  onUserStatusChange,
  onSearch,
  onSelect,
  search,
  settingsSaving,
  userSaving,
  userSavingId
}) {
  return (
    <section className="space-y-4">
      <SettingsBusinessSelector
        business={business}
        businesses={businesses}
        filteredBusinesses={filteredBusinesses}
        loading={loading}
        onCreate={onCreate}
        onSearch={onSearch}
        onSelect={onSelect}
        search={search}
      />
      <BusinessWorkspace
        branchSavingId={branchSavingId}
        business={business}
        moduleSavingKey={moduleSavingKey}
        onBranchStatusChange={onBranchStatusChange}
        onBusinessSave={onBusinessSave}
        onCreate={onCreate}
        onCreateUser={onCreateUser}
        onModuleToggle={onModuleToggle}
        onUserStatusChange={onUserStatusChange}
        settingsSaving={settingsSaving}
        userSaving={userSaving}
        userSavingId={userSavingId}
      />
    </section>
  );
}

function SettingsBusinessSelector({ business, businesses, filteredBusinesses, loading, onCreate, onSearch, onSelect, search }) {
  const owner = getOwner(business);
  const posMode = business?.posMode || getBusinessTypeOption(business?.type).posMode;
  const activeBranches = business?.branches?.filter((branch) => branch.status === "ACTIVE") || [];
  const activeModules = business?.modules?.filter((module) => module.active) || [];
  const activeUsers = business?.memberships?.filter((membership) => membership.user.status === "ACTIVE") || [];
  const selectOptions = business && !filteredBusinesses.some((item) => item.id === business.id) ? [business, ...filteredBusinesses] : filteredBusinesses;

  return (
    <section className="rounded-lg border border-zera-line bg-white">
      <div className="flex flex-col gap-3 border-b border-zera-line p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Business settings</p>
          <h2 className="mt-1 text-xl font-bold">Company control center</h2>
          <p className="mt-1 text-sm leading-6 text-zera-muted">Select a customer workspace, then manage the settings that shape its daily operations.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(260px,360px)_minmax(220px,1fr)_auto] xl:w-[780px]">
          <label className="block">
            <span className="sr-only">Selected business</span>
            <select
              className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
              value={business?.id || ""}
              onChange={(event) => onSelect(event.target.value)}
              disabled={loading || selectOptions.length === 0}
            >
              {!business ? <option value="">Select business</option> : null}
              {selectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.type || "Business"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-zera-line bg-[#f7faf8] px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
            <Search size={17} className="text-zera-muted" />
            <span className="sr-only">Search businesses</span>
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              placeholder="Search business, type, owner, or country"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
          <Button type="button" variant="secondary" className="gap-2 whitespace-nowrap" onClick={onCreate}>
            <Plus size={16} />
            New
          </Button>
        </div>
      </div>

      {!loading && businesses.length === 0 ? (
        <div className="p-4">
          <EmptyState text="No businesses yet. Create the first workspace." />
        </div>
      ) : null}
      {!loading && businesses.length > 0 && filteredBusinesses.length === 0 ? (
        <div className="p-4">
          <EmptyState text="No businesses match your search." />
        </div>
      ) : null}

      {business ? (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold">{business.name}</h3>
              <StatusPill label={business.status?.toLowerCase() || "active"} />
            </div>
            <p className="mt-1 truncate text-sm text-zera-muted">Owner: {owner?.user?.email || "Not assigned"}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zera-muted">
              <span className="rounded-md bg-[#f7faf8] px-2.5 py-1.5">{business.type || "Business type not set"}</span>
              <span className="rounded-md bg-zera-mint px-2.5 py-1.5 text-zera-green">{formatPOSMode(posMode, business.type)}</span>
              <span className="rounded-md bg-[#f7faf8] px-2.5 py-1.5">{business.country || "Country not set"}</span>
              <span className="rounded-md bg-[#f7faf8] px-2.5 py-1.5">{business.currency || "Currency not set"}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-zera-line bg-zera-line lg:w-[440px] lg:grid-cols-4 lg:border-l lg:border-t-0">
            <CompactFact label="Branches" value={`${activeBranches.length}/${business.branches?.length || 0}`} compact />
            <CompactFact label="Modules" value={`${activeModules.length}/${business.modules?.length || 0}`} compact />
            <CompactFact label="Users" value={`${activeUsers.length}/${business.memberships?.length || 0}`} compact />
            <CompactFact label="Products" value={business._count?.products || 0} compact />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BusinessDirectory({ businesses, filteredBusinesses, loading, onCreate, onSearch, onSelect, search, selectedBusiness }) {
  return (
    <aside className="flex min-h-0 flex-col rounded-lg border border-zera-line bg-white">
      <div className="border-b border-zera-line p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">Businesses</h3>
            <p className="mt-1 text-sm text-zera-muted">{loading ? "Loading..." : `${filteredBusinesses.length} of ${businesses.length} shown`}</p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green transition hover:bg-green-100"
            onClick={onCreate}
            aria-label="Create business"
          >
            <Plus size={18} />
          </button>
        </div>

        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-md border border-zera-line bg-[#f7faf8] px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
          <Search size={17} className="text-zera-muted" />
          <span className="sr-only">Search businesses</span>
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="Search business or owner"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!loading && businesses.length === 0 ? <EmptyState text="No businesses yet. Create the first workspace." /> : null}
        {!loading && businesses.length > 0 && filteredBusinesses.length === 0 ? <EmptyState text="No businesses match your search." /> : null}
        {filteredBusinesses.map((business) => (
          <BusinessDirectoryItem
            key={business.id}
            business={business}
            selected={selectedBusiness?.id === business.id}
            onSelect={() => onSelect(business.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function BusinessDirectoryItem({ business, onSelect, selected }) {
  const owner = getOwner(business);
  const mode = business.posMode || getBusinessTypeOption(business.type).posMode;

  return (
    <button
      type="button"
      className={`w-full rounded-md border p-2.5 text-left transition ${
        selected ? "border-zera-green bg-zera-mint shadow-soft" : "border-zera-line bg-white hover:border-zera-green hover:bg-[#f7faf8]"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{business.name}</p>
          <p className="mt-1 truncate text-xs text-zera-muted">
            {business.type || "Business type not set"} / {formatPOSMode(mode, business.type)}
          </p>
          <p className="mt-1 truncate text-xs text-zera-muted">Owner: {owner?.user?.email || "Not assigned"}</p>
        </div>
        {selected ? <CheckCircle2 size={18} className="shrink-0 text-zera-green" /> : null}
      </div>
    </button>
  );
}

function BusinessWorkspace({
  branchSavingId,
  business,
  moduleSavingKey,
  onBranchStatusChange,
  onBusinessSave,
  onCreate,
  onCreateUser,
  onModuleToggle,
  onUserStatusChange,
  settingsSaving,
  userSaving,
  userSavingId
}) {
  const [workspaceSection, setWorkspaceSection] = useState("identity");

  if (!business) {
    return (
      <section className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-zera-line bg-white p-6 text-center">
        <Building2 size={34} className="text-zera-green" />
        <h3 className="mt-4 text-xl font-bold">Select a business</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-zera-muted">
          Choose a business from the list or create a new workspace for a customer.
        </p>
        <Button type="button" className="mt-5 gap-2" onClick={onCreate}>
          <Plus size={16} />
          New business
        </Button>
      </section>
    );
  }

  const owner = getOwner(business);
  const sections = [
    { key: "identity", label: "Identity", helper: "Business type, country, currency, and status." },
    { key: "modules", label: "Modules", helper: "Enable only the Zera products this company should use now." },
    { key: "branches", label: "Branches", helper: "Manage operating locations and branch availability." },
    { key: "access", label: "Access", helper: "Review the owner and staff accounts connected to this company." }
  ];
  const activePanel = sections.find((section) => section.key === workspaceSection) || sections[0];

  return (
    <section className="rounded-lg border border-zera-line bg-white">
      <div className="flex flex-col gap-3 border-b border-zera-line p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="font-bold">Manage {business.name}</h3>
          <p className="mt-1 text-sm text-zera-muted">{activePanel.helper}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md bg-[#f7faf8] p-1">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={`min-h-9 rounded-md px-3 text-sm font-semibold transition ${
                workspaceSection === section.key ? "bg-white text-zera-ink shadow-sm" : "text-zera-muted hover:bg-white hover:text-zera-ink"
              }`}
              onClick={() => setWorkspaceSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {workspaceSection === "identity" ? (
          <BusinessSettingsCard business={business} onSave={onBusinessSave} saving={settingsSaving} />
        ) : null}
        {workspaceSection === "branches" ? (
          <BranchesCard branchSavingId={branchSavingId} business={business} onBranchStatusChange={onBranchStatusChange} />
        ) : null}
        {workspaceSection === "modules" ? (
          <ModulesCard business={business} moduleSavingKey={moduleSavingKey} onModuleToggle={onModuleToggle} />
        ) : null}
        {workspaceSection === "access" ? (
          <TeamCard
            business={business}
            onCreateUser={onCreateUser}
            onUserStatusChange={onUserStatusChange}
            owner={owner}
            userSaving={userSaving}
            userSavingId={userSavingId}
          />
        ) : null}
      </div>
    </section>
  );
}

function CreateBusinessPanel({ form, onCancel, onChange, onSubmit, saving }) {
  const selectedType = getBusinessTypeOption(form.businessType);

  return (
    <form className="rounded-lg border border-zera-line bg-white p-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 border-b border-zera-line pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zera-green">New business</p>
          <h2 className="mt-1 text-2xl font-bold">Create workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zera-muted">
            Set the business type, first branch, and owner login. The business type decides the POS experience.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="space-y-4">
          <SectionTitle icon={Building2} title="Business profile" subtitle="Basic identity and operating model" />
          <Input
            label="Business name"
            placeholder="Bamboo Bar and Restaurant"
            value={form.businessName}
            onChange={(event) => onChange({ ...form, businessName: event.target.value })}
            required
          />
          <BusinessTypeSelect value={form.businessType} onChange={(businessType) => onChange({ ...form, businessType })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Country" value={form.country} onChange={(event) => onChange({ ...form, country: event.target.value })} />
            <Input label="Currency" value={form.currency} onChange={(event) => onChange({ ...form, currency: event.target.value.toUpperCase() })} />
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
        </section>

        <section className="space-y-4 rounded-lg bg-[#f7faf8] p-4">
          <SectionTitle icon={KeyRound} title="Owner login" subtitle="First admin account for this business" />
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
          <div className="rounded-md border border-zera-line bg-white p-4">
            <p className="text-sm font-semibold text-zera-green">POS foundation</p>
            <p className="mt-1 font-bold">{formatPOSMode(selectedType.posMode, selectedType.value)}</p>
            <p className="mt-2 text-sm leading-6 text-zera-muted">{selectedType.helper}</p>
          </div>
          <Button className="w-full gap-2" disabled={saving}>
            <Plus size={16} />
            {saving ? "Creating..." : "Create business"}
          </Button>
        </section>
      </div>
    </form>
  );
}

function BusinessSettingsCard({ business, onSave, saving }) {
  const [settingsForm, setSettingsForm] = useState(() => getBusinessSettingsForm(business));

  useEffect(() => {
    setSettingsForm(getBusinessSettingsForm(business));
  }, [business?.id, business?.name, business?.type, business?.country, business?.currency, business?.status, business?.posMode]);

  const selectedType = getBusinessTypeOption(settingsForm.type);

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...settingsForm,
      posMode: selectedType.posMode
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <SectionTitle icon={Settings} title="Business identity" subtitle="System-owned settings for this workspace" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Input
            label="Business name"
            value={settingsForm.name}
            onChange={(event) => setSettingsForm({ ...settingsForm, name: event.target.value })}
            required
          />
          <BusinessTypeSelect value={settingsForm.type} onChange={(type) => setSettingsForm({ ...settingsForm, type })} />
        </div>
        <div className="space-y-4 rounded-md border border-zera-line bg-[#f7faf8] p-4">
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
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-zera-ink">Business status</span>
            <select
              className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
              value={settingsForm.status}
              onChange={(event) => setSettingsForm({ ...settingsForm, status: event.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <div className="rounded-md bg-white p-3">
            <p className="text-sm font-semibold text-zera-green">{formatPOSMode(selectedType.posMode, selectedType.value)}</p>
            <p className="mt-1 text-sm leading-6 text-zera-muted">{selectedType.helper}</p>
          </div>
          <Button className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save identity"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function BusinessTypeSelect({ onChange, value }) {
  const selectedType = getBusinessTypeOption(value);

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zera-ink">Type of business</span>
      <select
        className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {businessTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="mt-2 rounded-md bg-[#f7faf8] px-3 py-2 text-sm leading-6 text-zera-muted">
        {formatPOSMode(selectedType.posMode, selectedType.value)}. {selectedType.helper}
      </p>
    </label>
  );
}

function ModulesCard({ business, moduleSavingKey, onModuleToggle }) {
  return (
    <section>
      <SectionTitle icon={Boxes} title="Modules" subtitle="Enable only what this business needs now" />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {(business.modules || []).map((module) => (
          <ModuleToggleRow
            key={module.id}
            module={module}
            saving={moduleSavingKey === module.key}
            onToggle={(active) => onModuleToggle(module.key, active)}
          />
        ))}
      </div>
    </section>
  );
}

function ModuleToggleRow({ module, onToggle, saving }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-zera-line bg-[#f7faf8] px-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{module.name || module.key}</p>
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
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${module.active ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

function BranchesCard({ branchSavingId, business, onBranchStatusChange }) {
  return (
    <section>
      <SectionTitle icon={MapPin} title="Branches" subtitle="Locations connected to this business" />
      <div className="mt-4 space-y-2">
        {business.branches?.length ? (
          business.branches.map((branch) => (
            <div key={branch.id} className="flex flex-col gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
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
                {branchSavingId === branch.id ? "Saving..." : branch.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))
        ) : (
          <EmptyState text="No branches are connected to this business." />
        )}
      </div>
    </section>
  );
}

function TeamCard({ business, onCreateUser, onUserStatusChange, owner, userSaving, userSavingId }) {
  const [form, setForm] = useState(defaultUserForm);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [search, setSearch] = useState("");
  const roleOptions = useMemo(() => buildRoleOptions(business), [business]);
  const activeUsers = business.memberships?.filter((membership) => membership.user.status === "ACTIVE").length || 0;
  const filteredMemberships = (business.memberships || []).filter((membership) => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return true;
    }

    return [membership.user.name, membership.user.email, membership.role?.name, membership.user.status]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchTerm));
  });

  useEffect(() => {
    const defaultRoleName = roleOptions[0]?.name || "";

    setForm((current) => ({
      ...current,
      roleName: current.roleName && roleOptions.some((role) => role.name === current.roleName) ? current.roleName : defaultRoleName
    }));
  }, [business.id, roleOptions]);

  async function handleSubmit(event) {
    event.preventDefault();
    const createdMembership = await onCreateUser(form);

    if (createdMembership) {
      setForm({ ...defaultUserForm, roleName: roleOptions[0]?.name || "" });
      setShowCreatePanel(false);
    }
  }

  return (
    <section>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SectionTitle icon={Users} title="Access" subtitle="Owner and staff accounts" />
        <Button type="button" className="h-10 gap-2 px-3" onClick={() => setShowCreatePanel(true)}>
          <Plus size={16} />
          New user
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-zera-line bg-white px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
          <Search size={17} className="shrink-0 text-zera-muted" />
          <span className="sr-only">Search users</span>
          <input
            className="w-full border-0 bg-transparent text-sm outline-none"
            placeholder="Search name, email, role"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <CompactFact label="Active" value={`${activeUsers}/${business.memberships?.length || 0}`} />
        <CompactFact label="Roles" value={roleOptions.length} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-zera-line">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-zera-line bg-[#f7faf8] text-xs font-bold uppercase text-zera-muted">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {filteredMemberships.length ? (
              filteredMemberships.map((membership) => {
                const isActive = membership.user.status === "ACTIVE";
                const isOwner = membership.role?.name === "Owner";

                return (
                  <tr key={membership.id} className="hover:bg-[#f7faf8]">
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
                        disabled={isOwner || userSavingId === membership.id}
                        onClick={() => onUserStatusChange(membership)}
                      >
                        {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                        {isOwner ? "Protected" : isActive ? "Disable" : "Reactivate"}
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zera-muted" colSpan="4">
                  No users match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-md border border-zera-line bg-[#f7faf8] p-3">
        <p className="text-xs font-bold uppercase text-zera-muted">Owner account</p>
        <p className="mt-1 font-semibold">{owner?.user?.name || "Owner not set"}</p>
        <p className="mt-1 text-sm text-zera-muted">{owner?.user?.email || "Email not set"}</p>
      </div>

      {showCreatePanel ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20 no-print">
          <form className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onSubmit={handleSubmit}>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zera-line bg-white p-5">
              <div>
                <p className="text-xs font-bold uppercase text-zera-green">Create user</p>
                <h3 className="mt-1 text-xl font-bold">{business.name}</h3>
                <p className="mt-1 text-sm text-zera-muted">Assign the role this person needs for daily work.</p>
              </div>
              <button
                className="rounded-md border border-zera-line p-2 text-zera-muted hover:text-zera-ink"
                type="button"
                onClick={() => setShowCreatePanel(false)}
                aria-label="Close create user panel"
              >
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
                <span className="mb-2 block text-sm font-semibold text-zera-ink">Role</span>
                <select
                  className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
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

              <div className="rounded-md bg-[#f7faf8] p-3 text-sm leading-6 text-zera-muted">
                System Admin creates the account here. The business owner can later manage daily staff from their own workspace.
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-zera-line bg-white p-5">
              <Button className="w-full gap-2" disabled={userSaving}>
                <KeyRound size={17} />
                {userSaving ? "Creating user..." : "Create user"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function CompactFact({ compact = false, label, value }) {
  return (
    <div className={`${compact ? "bg-white" : "rounded-md bg-[#f7faf8]"} px-3 py-3`}>
      <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-md border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">{text}</div>;
}

function SectionTitle({ icon: Icon, subtitle, title }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <h3 className="font-bold">{title}</h3>
        <p className="text-sm leading-5 text-zera-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, muted = false }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${muted ? "bg-white text-zera-muted" : "bg-zera-mint text-zera-green"}`}>
      {label}
    </span>
  );
}

function formatPOSMode(posMode = "RETAIL_CHECKOUT", businessType = "") {
  const type = businessType.toLowerCase();

  if (posMode === "TABLE_SERVICE") {
    return "Table-service POS";
  }

  if (type.includes("pharmacy")) {
    return "Pharmacy checkout POS";
  }

  if (type.includes("hotel")) {
    return "Front desk service POS";
  }

  if (type.includes("supermarket")) {
    return "Supermarket checkout POS";
  }

  if (type.includes("electronic")) {
    return "Electronics checkout POS";
  }

  if (type.includes("retail")) {
    return "Retail shop checkout POS";
  }

  return "Retail checkout POS";
}

function buildRoleOptions(business) {
  const roles = business?.roles || [];
  const visibleRoles = roles.filter((role) => role.name !== "Owner");

  if (visibleRoles.length > 0) {
    return visibleRoles;
  }

  const type = (business?.type || "").toLowerCase();
  const posMode = business?.posMode || "RETAIL_CHECKOUT";

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

  if (type.includes("electronic")) {
    return [
      { name: "Manager", description: "Manage electronics shop operations." },
      { name: "Cashier", description: "Sell devices and accessories and receive payments." },
      { name: "Store Keeper", description: "Receive stock and keep product records clean." },
      { name: "Technician", description: "Support repair and device-service workflows." }
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
    { name: "Store Keeper", description: "Support stock-facing shop duties and retail checkout." },
    { name: "Cashier", description: "Run checkout and receive payments." }
  ];
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

function getOwner(business) {
  return business?.memberships?.find((membership) => membership.role?.name === "Owner") || null;
}

function getModuleDescription(key) {
  const descriptions = {
    POS: "Sales, open bills, receipts, and daily checkout.",
    INVENTORY: "Products, stock, transfers, and warehouse control.",
    FINANCE: "Cash, expenses, invoices, and financial reports.",
    OPERATIONS: "Restaurant, hotel, pharmacy, or workflow operations.",
    REPORTS: "Daily, weekly, monthly, and manager reporting."
  };

  return descriptions[key] || "Business capability controlled by System Admin.";
}
