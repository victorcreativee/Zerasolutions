import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  CalendarClock,
  ChevronRight,
  CreditCard,
  Database,
  Hotel,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
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
import { useAuth } from "../../context/AuthContext.jsx";
import { updateBranchStatus, updateBusinessModule } from "../../services/setupService.js";
import { getSystemBusinesses, getSystemSetupCatalog, provisionBusiness, updatePlatformPackage, updateSystemBusinessSettings } from "../../services/systemAdminService.js";
import { createBusinessUser, updateBusinessUserStatus } from "../../services/teamService.js";

const defaultForm = {
  businessName: "",
  businessType: "Bar and restaurant",
  packageKey: "STARTER",
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

const fallbackBusinessTypeOptions = [
  {
    key: "BAR_RESTAURANT",
    value: "Bar and restaurant",
    label: "Bar and restaurant",
    posMode: "TABLE_SERVICE",
    icon: Utensils,
    helper: "Tables, waiters, open bills, and cashier settlement.",
    roles: [
      { name: "Waiter", description: "Take table orders and prepare customer bills." },
      { name: "Cashier", description: "Receive payments, close bills, and print final receipts." }
    ]
  },
  {
    key: "RETAIL_SHOP",
    value: "Retail shop",
    label: "Retail shop",
    posMode: "RETAIL_CHECKOUT",
    icon: Store,
    helper: "Simple counter sales for daily shop workflows.",
    roles: [
      { name: "Store Keeper", description: "Receive stock and keep product records clean." },
      { name: "Cashier", description: "Run checkout and receive payments." }
    ]
  },
  {
    key: "ELECTRONICS_SHOP",
    value: "Electronics shop",
    label: "Electronics shop",
    posMode: "RETAIL_CHECKOUT",
    icon: Smartphone,
    helper: "Device, accessory, stock, receipt, and repair-service foundations.",
    roles: [
      { name: "Cashier", description: "Sell devices and accessories and receive payments." },
      { name: "Store Keeper", description: "Receive stock, monitor device quantities, and keep product records clean." },
      { name: "Technician", description: "Support repair and device-service workflows when operations are enabled." }
    ]
  },
  {
    key: "SUPERMARKET",
    value: "Supermarket",
    label: "Supermarket",
    posMode: "RETAIL_CHECKOUT",
    icon: ShoppingBasket,
    helper: "Fast checkout for baskets, barcodes, and many products.",
    roles: [
      { name: "Cashier", description: "Run fast checkout and receive payments." },
      { name: "Store Keeper", description: "Support product and stock-facing supermarket work." }
    ]
  },
  {
    key: "PHARMACY",
    value: "Pharmacy",
    label: "Pharmacy",
    posMode: "RETAIL_CHECKOUT",
    icon: Pill,
    helper: "Pharmacy sales now, batch and medicine controls later.",
    roles: [
      { name: "Pharmacist", description: "Serve pharmacy customers and record medicine sales." },
      { name: "Cashier", description: "Receive payments and run checkout." }
    ]
  },
  {
    key: "HOTEL",
    value: "Hotel",
    label: "Hotel",
    posMode: "RETAIL_CHECKOUT",
    icon: Hotel,
    helper: "Front-desk service sales now, room and folio workflows later.",
    roles: [
      { name: "Front Desk", description: "Serve guest-facing hotel workflows and record service sales." },
      { name: "Cashier", description: "Receive payments and close service bills." }
    ]
  }
];

const fallbackPlatformProducts = [
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

const fallbackPackageOptions = [
  {
    key: "STARTER",
    name: "Starter",
    description: "Simple POS, receipts, and basic reports for one branch.",
    maxBranches: 1,
    maxUsers: 3,
    maxProducts: 300,
    defaultModuleKeys: ["POS", "REPORTS"]
  },
  {
    key: "GROWTH",
    name: "Growth",
    description: "POS, inventory, and stronger reporting for a growing shop.",
    maxBranches: 3,
    maxUsers: 10,
    maxProducts: 2000,
    defaultModuleKeys: ["POS", "INVENTORY", "REPORTS"]
  },
  {
    key: "BUSINESS",
    name: "Business",
    description: "All current Zera foundations for multi-team operations.",
    maxBranches: 10,
    maxUsers: 50,
    maxProducts: 10000,
    defaultModuleKeys: ["POS", "INVENTORY", "FINANCE", "OPERATIONS", "REPORTS"]
  }
];

const selectedBusinessStorageKey = "zera_system_admin_selected_business";

const businessTypeIconMap = {
  BAR_RESTAURANT: Utensils,
  RETAIL_SHOP: Store,
  ELECTRONICS_SHOP: Smartphone,
  SUPERMARKET: ShoppingBasket,
  PHARMACY: Pill,
  HOTEL: Hotel
};

const moduleIconMap = {
  POS: Store,
  INVENTORY: Boxes,
  FINANCE: ShieldCheck,
  OPERATIONS: Settings,
  REPORTS: Users
};

function hydrateBusinessTypes(options = fallbackBusinessTypeOptions) {
  return options.map((option) => {
    const fallback = fallbackBusinessTypeOptions.find((item) => item.value === option.value || item.key === option.key);
    return {
      ...option,
      icon: businessTypeIconMap[option.key] || fallback?.icon || Store,
      helper: option.helper || fallback?.helper || "System Admin controls the sales workflow for this business.",
      roles: option.roles || fallback?.roles || []
    };
  });
}

function hydratePlatformProducts(products = fallbackPlatformProducts) {
  return products.map((product) => {
    const fallback = fallbackPlatformProducts.find((item) => item.key === product.key);
    return {
      ...product,
      title: product.title || product.name || fallback?.title || product.key,
      summary: product.summary || fallback?.summary || product.description,
      detail: product.detail || product.description || fallback?.detail || "Business capability controlled by System Admin.",
      icon: moduleIconMap[product.key] || fallback?.icon || Store
    };
  });
}

function hydratePackages(packages = fallbackPackageOptions) {
  return packages.map((packageItem) => {
    const fallback = fallbackPackageOptions.find((item) => item.key === packageItem.key);

    return {
      ...packageItem,
      name: packageItem.name || fallback?.name || packageItem.key,
      description: packageItem.description || fallback?.description || "Package controls what this customer can use.",
      maxBranches: packageItem.maxBranches ?? fallback?.maxBranches ?? null,
      maxUsers: packageItem.maxUsers ?? fallback?.maxUsers ?? null,
      maxProducts: packageItem.maxProducts ?? fallback?.maxProducts ?? null,
      defaultModuleKeys: packageItem.defaultModuleKeys?.length ? packageItem.defaultModuleKeys : fallback?.defaultModuleKeys || [],
      active: packageItem.active !== false
    };
  });
}

function getBusinessTypeOption(type = "", options = fallbackBusinessTypeOptions) {
  const normalizedType = type.toLowerCase();
  return (
    options.find((option) => option.value === type || option.key === type) ||
    options.find((option) => normalizedType && (normalizedType.includes(option.value.toLowerCase()) || option.value.toLowerCase().includes(normalizedType))) ||
    options[1] ||
    fallbackBusinessTypeOptions[1]
  );
}

function getPackageOption(packageKey = "STARTER", options = fallbackPackageOptions) {
  return options.find((option) => option.key === packageKey || option.id === packageKey) || options[0] || fallbackPackageOptions[0];
}

export default function SystemAdminPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [setupCatalog, setSetupCatalog] = useState({
    businessTypes: fallbackBusinessTypeOptions,
    modules: fallbackPlatformProducts,
    packages: fallbackPackageOptions
  });
  const [form, setForm] = useState(defaultForm);
  const [selectedBusinessId, setSelectedBusinessId] = useState(() => localStorage.getItem(selectedBusinessStorageKey) || "");
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedProductKey, setSelectedProductKey] = useState("POS");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleSavingKey, setModuleSavingKey] = useState("");
  const [packageSavingKey, setPackageSavingKey] = useState("");
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
  const businessTypeOptions = useMemo(() => hydrateBusinessTypes(setupCatalog.businessTypes), [setupCatalog.businessTypes]);
  const platformProducts = useMemo(() => hydratePlatformProducts(setupCatalog.modules), [setupCatalog.modules]);
  const packageOptions = useMemo(() => hydratePackages(setupCatalog.packages), [setupCatalog.packages]);

  useEffect(() => {
    const selectedPackage = getPackageOption(form.packageKey, packageOptions);

    if (selectedPackage.active !== false) {
      return;
    }

    const firstActivePackage = packageOptions.find((packageItem) => packageItem.active !== false);

    if (!firstActivePackage) {
      return;
    }

    setForm((current) => (current.packageKey === selectedPackage.key ? { ...current, packageKey: firstActivePackage.key } : current));
  }, [form.packageKey, packageOptions]);

  const platformTotals = useMemo(
    () => ({
      businesses: businesses.length,
      activeBusinesses: businesses.filter((business) => business.status === "ACTIVE").length,
      inactiveBusinesses: businesses.filter((business) => business.status !== "ACTIVE").length,
      branches: businesses.reduce((total, business) => total + (business.branches?.length || 0), 0),
      activeBranches: businesses.reduce((total, business) => total + (business.branches || []).filter((branch) => branch.status === "ACTIVE").length, 0),
      users: businesses.reduce((total, business) => total + (business.memberships?.length || 0), 0),
      activeUsers: businesses.reduce((total, business) => total + (business.memberships || []).filter((membership) => membership.user?.status === "ACTIVE").length, 0),
      products: businesses.reduce((total, business) => total + (business._count?.products || 0), 0)
    }),
    [businesses]
  );
  const platformHealth = useMemo(
    () => getPlatformHealth({ businesses, businessTypeOptions, packageOptions, platformProducts }),
    [businesses, businessTypeOptions, packageOptions, platformProducts]
  );
  const attentionItems = useMemo(() => getAttentionItems(businesses), [businesses]);
  const recentActivity = useMemo(() => getRecentActivity(businesses), [businesses]);

  async function loadBusinesses() {
    try {
      setLoading(true);
      setError("");
      const [catalog, data] = await Promise.all([getSystemSetupCatalog(), getSystemBusinesses()]);
      setSetupCatalog({
        businessTypes: catalog.businessTypes?.length ? catalog.businessTypes : fallbackBusinessTypeOptions,
        modules: catalog.modules?.length ? catalog.modules : fallbackPlatformProducts,
        packages: catalog.packages?.length ? catalog.packages : fallbackPackageOptions
      });
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
      const selectedType = getBusinessTypeOption(form.businessType, businessTypeOptions);
      const business = await provisionBusiness({
        business: {
          name: form.businessName,
          type: form.businessType,
          packageKey: form.packageKey,
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
      setActiveSection("organizations");
      setMessage(`Organization created. Owner login: ${form.ownerEmail}`);
      setForm(defaultForm);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create organization.");
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

  async function handlePackageSave(packageItem, payload) {
    setError("");
    setMessage("");
    setPackageSavingKey(packageItem.key);

    try {
      const data = await updatePlatformPackage(packageItem.id || packageItem.key, payload);
      setSetupCatalog((current) => ({
        ...current,
        packages: data.catalog?.packages?.length
          ? data.catalog.packages
          : current.packages.map((item) => (item.key === data.package?.key ? data.package : item))
      }));
      await loadBusinesses();
      setMessage(`${data.package?.name || packageItem.name} package updated.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update package.");
    } finally {
      setPackageSavingKey("");
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
        <section className="rounded-xl border border-zera-line bg-white p-5 shadow-card">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zera-mint text-zera-green">
            <ShieldCheck size={23} />
          </div>
          <h2 className="mt-4 text-xl font-bold">System admin access required</h2>
          <p className="mt-2 text-sm leading-6 text-zera-muted">
            This area is only for Zera system administrators who create and provision customer organizations.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1540px] flex-col gap-4 px-0">
      <SystemAdminCommandHeader
        activeSection={activeSection}
        businesses={businesses}
        loading={loading}
        onCreate={() => setActiveSection("create")}
        onRefresh={loadBusinesses}
        onSectionChange={setActiveSection}
        onSelect={(businessId) => {
          selectBusiness(businessId);
          setActiveSection("organizations");
        }}
        platformTotals={platformTotals}
        selectedBusiness={selectedBusiness}
      />

      {error ? <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      {activeSection === "overview" ? (
        <OverviewSection
          businesses={businesses}
          filteredBusinesses={filteredBusinesses}
          loading={loading}
          onCreate={() => setActiveSection("create")}
          onManageSelected={() => setActiveSection("organizations")}
          onProductSelect={setSelectedProductKey}
          onSearch={setSearch}
          onSelect={(businessId) => {
            selectBusiness(businessId);
            setActiveSection("organizations");
          }}
          platformTotals={platformTotals}
          platformHealth={platformHealth}
          attentionItems={attentionItems}
          recentActivity={recentActivity}
          search={search}
          selectedBusiness={selectedBusiness}
          selectedProductKey={selectedProductKey}
          platformProducts={platformProducts}
          businessTypeOptions={businessTypeOptions}
          packageOptions={packageOptions}
        />
      ) : null}

      {activeSection === "create" ? (
        <CreateBusinessPanel
          form={form}
          onCancel={() => setActiveSection("overview")}
          onChange={setForm}
          onSubmit={handleSubmit}
          saving={saving}
          businessTypeOptions={businessTypeOptions}
          packageOptions={packageOptions}
        />
      ) : null}

      {activeSection === "organizations" ? (
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
          platformProducts={platformProducts}
          businessTypeOptions={businessTypeOptions}
          packageOptions={packageOptions}
        />
      ) : null}

      {activeSection === "packages" ? (
        <PackageSettingsSection
          businesses={businesses}
          onSave={handlePackageSave}
          packageOptions={packageOptions}
          packageSavingKey={packageSavingKey}
          platformProducts={platformProducts}
        />
      ) : null}

      {activeSection === "platform" ? (
        <PlatformSettingsSection businessTypeOptions={businessTypeOptions} packageOptions={packageOptions} platformProducts={platformProducts} />
      ) : null}
    </div>
  );
}

function SystemAdminCommandHeader({
  activeSection,
  businesses,
  loading,
  onCreate,
  onRefresh,
  onSectionChange,
  onSelect,
  platformTotals,
  selectedBusiness
}) {
  return (
    <header className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-xs">
      <div className="grid gap-3 border-b border-zera-line px-4 py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-zera-muted">
            <span>Platform</span>
            <ChevronRight size={12} />
            <span className="text-zera-green">System Admin</span>
          </div>
          <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="text-xl font-bold tracking-tight text-zera-ink">Admin workspace</p>
            <span className="pb-0.5 text-sm text-zera-muted">
              {platformTotals.activeBusinesses}/{platformTotals.businesses} active organizations
            </span>
          </div>
        </div>

        <SystemAdminHeaderActions
          businesses={businesses}
          loading={loading}
          onCreate={onCreate}
          onRefresh={onRefresh}
          onSelect={onSelect}
          selectedBusiness={selectedBusiness}
        />
      </div>

      <div className="flex flex-col gap-3 bg-[#fbfdfb] px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <SystemAdminNav activeSection={activeSection} onChange={onSectionChange} />
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zera-line bg-zera-line text-xs font-semibold text-zera-muted lg:min-w-[320px]">
          <HeaderStat label="Branches" value={platformTotals.branches} />
          <HeaderStat label="Users" value={platformTotals.users} />
          <HeaderStat label="Products" value={platformTotals.products} />
        </div>
      </div>
    </header>
  );
}

function HeaderStat({ label, value }) {
  return (
    <div className="bg-white px-3 py-1.5">
      <span className="font-bold text-zera-ink">{value}</span>
      <span className="ml-1">{label}</span>
    </div>
  );
}

function SystemAdminNav({ activeSection, onChange }) {
  const sections = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "organizations", label: "Organizations", icon: Building2 },
    { key: "packages", label: "Packages", icon: CreditCard },
    { key: "platform", label: "Settings", icon: SlidersHorizontal }
  ];

  return (
    <nav className="flex w-full overflow-x-auto rounded-md border border-zera-line bg-white p-1 lg:w-fit" aria-label="System admin sections">
      {sections.map((section) => {
        const Icon = section.icon;

        return (
          <button
            key={section.key}
            type="button"
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-[6px] px-3 text-sm font-semibold transition ${
              activeSection === section.key ? "bg-zera-green text-white shadow-sm" : "text-zera-muted hover:bg-[#f7faf8] hover:text-zera-ink"
            }`}
            onClick={() => onChange(section.key)}
          >
            <Icon size={15} />
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

function SystemAdminHeaderActions({ businesses, loading, onCreate, onRefresh, onSelect, selectedBusiness }) {
  const selectOptions = selectedBusiness && !businesses.some((business) => business.id === selectedBusiness.id) ? [selectedBusiness, ...businesses] : businesses;

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-zera-line bg-[#fbfdfb] px-3 shadow-xs focus-within:border-zera-green focus-within:bg-white focus-within:ring-4 focus-within:ring-zera-green/10 lg:w-[410px]">
        <Building2 size={16} className="shrink-0 text-zera-green" />
        <span className="shrink-0 text-[11px] font-bold uppercase text-zera-muted">Organization</span>
        <select
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-zera-ink outline-none"
          value={selectedBusiness?.id || ""}
          onChange={(event) => onSelect(event.target.value)}
          disabled={loading || selectOptions.length === 0}
        >
          {!selectedBusiness ? <option value="">Select organization</option> : null}
          {selectOptions.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name} - {formatPOSMode(business.posMode, business.type)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="h-10 px-3" onClick={onRefresh} aria-label="Refresh system admin data">
          <RefreshCw size={16} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button type="button" className="h-10 gap-2 px-3" onClick={onCreate}>
          <Plus size={16} />
          New
        </Button>
      </div>
    </div>
  );
}

function OverviewSection({
  businessTypeOptions,
  businesses,
  filteredBusinesses,
  loading,
  attentionItems,
  onCreate,
  onManageSelected,
  onProductSelect,
  onSearch,
  onSelect,
  packageOptions,
  platformHealth,
  platformProducts,
  platformTotals,
  recentActivity,
  search,
  selectedBusiness,
  selectedProductKey
}) {
  const selectedProduct = platformProducts.find((product) => product.key === selectedProductKey) || platformProducts[0];
  const activePackages = packageOptions.filter((packageItem) => packageItem.active !== false).length;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <PlatformOperatingPanel
          activePackages={activePackages}
          loading={loading}
          onCreate={onCreate}
          onManageSelected={onManageSelected}
          platformTotals={platformTotals}
          selectedBusiness={selectedBusiness}
        />
        <OrganizationTableCard
          businessTypeOptions={businessTypeOptions}
          businesses={businesses}
          filteredBusinesses={filteredBusinesses}
          loading={loading}
          maxHeightClass="max-h-[calc(100vh-420px)] min-h-[360px]"
          onSearch={onSearch}
          onSelect={onSelect}
          search={search}
          selectedBusiness={selectedBusiness}
          showCreateAction
          onCreate={onCreate}
          subtitle="Search, select, and manage each customer workspace from one register."
          title="Organizations"
        />
      </div>

      <aside className="min-w-0 space-y-4">
        <AdminFocusPanel
          attentionItems={attentionItems}
          onCreate={onCreate}
          onManageSelected={onManageSelected}
          onSelect={onSelect}
          selectedBusiness={selectedBusiness}
        />
        <PlatformHealthCard compact health={platformHealth} />
        <ModuleSnapshot
          onProductSelect={onProductSelect}
          platformProducts={platformProducts}
          selectedProduct={selectedProduct}
          selectedProductKey={selectedProductKey}
        />
        <RecentActivityList activity={recentActivity} />
      </aside>
    </section>
  );
}

function PlatformOperatingPanel({ activePackages, loading, onCreate, onManageSelected, platformTotals, selectedBusiness }) {
  const stats = [
    { label: "Organizations", value: loading ? "..." : platformTotals.businesses, helper: `${platformTotals.activeBusinesses} active` },
    { label: "Users", value: loading ? "..." : platformTotals.users, helper: `${platformTotals.activeUsers} active` },
    { label: "Packages", value: loading ? "..." : activePackages, helper: "Available plans" },
    { label: "Products", value: loading ? "..." : platformTotals.products, helper: "Managed items" }
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Zera Solutions</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-zera-ink">Business operating system</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zera-muted">
              Configure each customer by business type, package, modules, roles, and sales workflow. Keep every organization simple for its team, while the platform stays scalable.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-zera-line bg-zera-line sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#fbfdfb] px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-zera-muted">{stat.label}</p>
                <p className="mt-1 text-xl font-bold text-zera-ink">{stat.value}</p>
                <p className="truncate text-xs text-zera-muted">{stat.helper}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 xl:w-[250px]">
          <Button type="button" className="h-10 gap-2 px-3" onClick={onCreate}>
            <Plus size={16} />
            New organization
          </Button>
          <Button type="button" variant="secondary" className="h-10 gap-2 px-3" onClick={onManageSelected} disabled={!selectedBusiness}>
            <Settings size={16} />
            Manage selected
          </Button>
          {selectedBusiness ? (
            <div className="rounded-lg border border-zera-line bg-[#f7faf8] px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zera-muted">Selected organization</p>
              <p className="mt-1 truncate text-sm font-bold text-zera-ink">{selectedBusiness.name}</p>
              <p className="truncate text-xs text-zera-muted">{formatPOSMode(selectedBusiness.posMode, selectedBusiness.type)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AdminFocusPanel({ attentionItems, onCreate, onManageSelected, onSelect, selectedBusiness }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
        <SectionTitle icon={ShieldCheck} title="Admin focus" subtitle="The next actions that matter." />
      </div>
      <div className="space-y-3 p-4">
        {attentionItems.length ? (
          attentionItems.slice(0, 3).map((item) => (
            <button
              key={`${item.businessId}-${item.label}`}
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition hover:bg-amber-100"
              onClick={() => onSelect(item.businessId)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-zera-ink">{item.label}</span>
                <span className="block truncate text-xs text-zera-muted">{item.businessName}</span>
              </span>
              <StatusPill label={item.severity} muted={item.severity !== "critical"} />
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-zera-line bg-[#f7faf8] px-3 py-3 text-sm text-zera-muted">
            No setup issues found. Customer workspaces are ready for daily operations.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-10 rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink transition hover:border-zera-green hover:text-zera-green"
            onClick={onCreate}
          >
            Add customer
          </button>
          <button
            type="button"
            className="min-h-10 rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink transition hover:border-zera-green hover:text-zera-green disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedBusiness}
            onClick={onManageSelected}
          >
            Configure
          </button>
        </div>
      </div>
    </section>
  );
}

function ModuleSnapshot({ onProductSelect, platformProducts, selectedProduct, selectedProductKey }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
        <SectionTitle icon={Boxes} title="Product catalog" subtitle="Modules available for packages." />
      </div>
      <div className="space-y-2 p-3">
        {platformProducts.map((product) => {
          const Icon = product.icon;
          const selected = product.key === selectedProductKey;

          return (
            <button
              key={product.key}
              type="button"
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                selected ? "border-zera-green bg-zera-mint" : "border-zera-line bg-white hover:border-zera-green/60 hover:bg-[#f7faf8]"
              }`}
              onClick={() => onProductSelect(product.key)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-zera-green">
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-zera-ink">{product.title}</span>
                <span className="block truncate text-xs text-zera-muted">{product.summary}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-zera-line bg-[#f7faf8] px-4 py-3">
        <p className="text-xs font-bold uppercase text-zera-green">{selectedProduct.title}</p>
        <p className="mt-1 text-xs leading-5 text-zera-muted">{selectedProduct.detail}</p>
      </div>
    </section>
  );
}

function RecentActivityList({ activity }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
        <SectionTitle icon={CalendarClock} title="Recent activity" subtitle="Latest setup changes." />
      </div>
      <div className="divide-y divide-zera-line">
        {activity.length === 0 ? (
          <div className="p-4">
            <EmptyState text="Activity will appear after organizations are created or updated." />
          </div>
        ) : (
          activity.slice(0, 5).map((item) => (
            <div key={`${item.label}-${item.date}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-zera-ink">{item.label}</p>
                <p className="mt-0.5 truncate text-xs text-zera-muted">{item.description}</p>
              </div>
              <p className="text-right text-xs font-semibold text-zera-muted">{formatShortDate(item.date)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AdminMetricCard({ detail, icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-zera-line bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zera-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-zera-ink">{value}</p>
          <p className="mt-1 text-sm text-zera-muted">{detail}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f5f3] text-zera-green">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function PlatformHealthCard({ compact = false, health }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b border-zera-line bg-[#fbfdfb] px-4 py-3 md:flex-row md:items-center md:justify-between">
        <SectionTitle icon={Activity} title="Platform health" subtitle="Operational readiness for configured customer workspaces." />
        <StatusPill label={health.score >= 90 ? "healthy" : health.score >= 70 ? "needs review" : "attention needed"} muted={health.score < 90} />
      </div>
      <div className={`${compact ? "divide-y divide-zera-line bg-white" : "grid gap-px bg-zera-line md:grid-cols-3"}`}>
        {health.rows.map((row) => (
          <div key={row.label} className="bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zera-muted">{row.label}</p>
              <p className="text-lg font-bold text-zera-ink">{row.value}</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eef3ef]">
              <div className={`h-full rounded-full ${row.warning ? "bg-amber-500" : "bg-zera-green"}`} style={{ width: `${row.percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-zera-muted">{row.helper}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttentionPanel({ attentionItems, onSelect }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="border-b border-zera-line px-4 py-3">
        <SectionTitle icon={AlertTriangle} title="Needs attention" subtitle="Setup gaps and configuration risks." />
      </div>
      <div className="overflow-x-auto">
        {attentionItems.length === 0 ? (
          <div className="p-4">
            <EmptyState text="No setup issues found." />
          </div>
        ) : (
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Issue</th>
                <th className="px-4 py-3 font-bold">Organization</th>
                <th className="px-4 py-3 text-right font-bold">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zera-line">
              {attentionItems.slice(0, 5).map((item) => (
                <tr key={`${item.businessId}-${item.label}`} className="cursor-pointer hover:bg-[#f7faf8]" onClick={() => onSelect(item.businessId)}>
                  <td className="px-4 py-3 font-semibold text-zera-ink">{item.label}</td>
                  <td className="max-w-[150px] truncate px-4 py-3 text-zera-muted">{item.businessName}</td>
                  <td className="px-4 py-3 text-right">
                    <StatusPill label={item.severity} muted={item.severity !== "critical"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function RecentActivityPanel({ activity }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="border-b border-zera-line px-4 py-3">
        <SectionTitle icon={CalendarClock} title="Recent activity" subtitle="Latest platform setup events." />
      </div>
      <div className="overflow-x-auto">
        {activity.length === 0 ? (
          <div className="p-4">
            <EmptyState text="Activity will appear after organizations are created or updated." />
          </div>
        ) : (
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
              <tr>
                <th className="px-4 py-3 font-bold">Organization</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zera-line">
              {activity.slice(0, 5).map((item) => (
                <tr key={`${item.label}-${item.date}`} className="hover:bg-[#f7faf8]">
                  <td className="px-4 py-3 font-semibold text-zera-ink">{item.label}</td>
                  <td className="max-w-[190px] truncate px-4 py-3 text-zera-muted">{item.description}</td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-zera-muted">{formatShortDate(item.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function ModuleFoundationTable({ onProductSelect, platformProducts, selectedProductKey }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left text-sm">
        <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
          <tr>
            <th className="px-4 py-3 font-bold">Module</th>
            <th className="px-4 py-3 font-bold">Purpose</th>
            <th className="px-4 py-3 font-bold">Key</th>
            <th className="px-4 py-3 text-right font-bold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zera-line">
          {platformProducts.map((product) => {
            const Icon = product.icon;
            const selected = product.key === selectedProductKey;

            return (
              <tr key={product.key} className={`transition hover:bg-[#f7faf8] ${selected ? "bg-zera-mint/60" : "bg-white"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zera-mint text-zera-green">
                      <Icon size={17} />
                    </span>
                    <span className="font-bold text-zera-ink">{product.title}</span>
                  </div>
                </td>
                <td className="max-w-[460px] truncate px-4 py-3 text-zera-muted">{product.summary}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-[#f7faf8] px-2 py-1 text-xs font-bold text-zera-muted">{product.key}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink transition hover:border-zera-green hover:text-zera-green"
                    onClick={() => onProductSelect(product.key)}
                  >
                    {selected ? "Viewing" : "View"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrganizationTableCard({
  businessTypeOptions,
  businesses,
  compact = false,
  filteredBusinesses,
  loading,
  maxHeightClass = "max-h-[420px]",
  onCreate,
  onSearch,
  onSelect,
  search,
  showCreateAction = false,
  selectedBusiness,
  subtitle,
  title = "Organizations"
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className={`flex flex-col gap-3 border-b border-zera-line bg-[#fbfdfb] ${compact ? "px-3 py-3" : "px-4 py-3"} lg:flex-row lg:items-center lg:justify-between`}>
        <SectionTitle
          icon={Building2}
          title={title}
          subtitle={subtitle || `${loading ? "Loading" : `${filteredBusinesses.length} of ${businesses.length}`} customer workspaces`}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className={`flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-zera-line bg-white px-3 focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10 ${compact ? "sm:w-64" : "sm:w-80"}`}>
            <Search size={16} className="text-zera-muted" />
            <span className="sr-only">Search organizations</span>
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              placeholder="Search organization, owner, type"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
          {showCreateAction ? (
            <Button type="button" className="h-10 gap-2 px-3" onClick={onCreate}>
              <Plus size={15} />
              New
            </Button>
          ) : null}
        </div>
      </div>

      <div className={`${maxHeightClass} overflow-auto`}>
        <table className={`w-full border-collapse text-left text-sm ${compact ? "min-w-full table-fixed" : "min-w-[980px]"}`}>
          <thead className="sticky top-0 z-10 bg-[#f7faf8] text-xs uppercase text-zera-muted shadow-[0_1px_0_rgba(20,31,27,0.08)]">
            {compact ? (
              <tr>
                <th className="w-[32%] px-3 py-2.5 font-bold">Organization</th>
                <th className="w-[25%] px-3 py-2.5 font-bold">Workflow</th>
                <th className="w-[28%] px-3 py-2.5 font-bold">Setup</th>
                <th className="w-[15%] px-3 py-2.5 text-right font-bold">Select</th>
              </tr>
            ) : (
              <tr>
                <th className="px-4 py-3 font-bold">Organization</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Package</th>
                <th className="px-4 py-3 font-bold">Usage</th>
                <th className="px-4 py-3 font-bold">Owner</th>
                <th className="px-4 py-3 text-right font-bold">Action</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-zera-line">
            {!loading && filteredBusinesses.length === 0 ? (
              <tr>
                <td colSpan={compact ? 4 : 6} className="px-4 py-6">
                  <EmptyState text={businesses.length === 0 ? "No organizations yet. Create the first customer workspace." : "No organizations match your search."} />
                </td>
              </tr>
            ) : null}
            {filteredBusinesses.map((business) => (
              <OrganizationTableRow
                key={business.id}
                business={business}
                businessTypeOptions={businessTypeOptions}
                compact={compact}
                selected={selectedBusiness?.id === business.id}
                onSelect={() => onSelect(business.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrganizationTableRow({ business, businessTypeOptions, compact, onSelect, selected }) {
  const owner = getOwner(business);
  const activeModules = (business.modules || []).filter((module) => module.active).length;
  const totalModules = business.modules?.length || 0;
  const activeBranches = (business.branches || []).filter((branch) => branch.status === "ACTIVE").length;
  const totalBranches = business.branches?.length || 0;
  const activeUsers = (business.memberships || []).filter((membership) => membership.user?.status === "ACTIVE").length;
  const totalUsers = business.memberships?.length || 0;
  const posMode = business.posMode || getBusinessTypeOption(business.type, businessTypeOptions).posMode;

  if (compact) {
    return (
      <tr className={`transition hover:bg-[#f7faf8] ${selected ? "bg-[#f3faf6] shadow-[inset_3px_0_0_#14833b]" : "bg-white"}`}>
        <td className="px-3 py-2.5">
          <button type="button" className="w-full min-w-0 text-left" onClick={onSelect}>
            <span className="block truncate font-bold text-zera-ink">{business.name}</span>
            <span className="mt-0.5 block truncate text-xs text-zera-muted">{owner?.user?.email || "Owner not assigned"}</span>
          </button>
        </td>
        <td className="px-3 py-2.5">
          <p className="truncate font-semibold text-zera-ink">{business.type || "Not set"}</p>
          <p className="mt-0.5 truncate text-xs text-zera-green">{formatPOSMode(posMode, business.type)}</p>
        </td>
        <td className="truncate px-3 py-2.5 text-xs text-zera-muted">
          <span className="font-semibold text-zera-ink">{business.platformPackage?.name || "Starter"}</span>
          <span className="mt-0.5 block">
            {activeBranches}/{totalBranches} branches · {activeUsers}/{totalUsers} users · {activeModules}/{totalModules} modules
          </span>
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            type="button"
            className={`inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-bold transition ${
              selected ? "bg-zera-green text-white" : "border border-zera-line bg-white text-zera-ink hover:border-zera-green hover:text-zera-green"
            }`}
            onClick={onSelect}
          >
            {selected ? "Selected" : "Select"}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`transition hover:bg-[#f7faf8] ${selected ? "bg-[#f3faf6] shadow-[inset_3px_0_0_#14833b]" : "bg-white"}`}>
      <td className="px-4 py-2.5">
        <button type="button" className="max-w-[280px] text-left" onClick={onSelect}>
          <span className="block truncate font-bold text-zera-ink">{business.name}</span>
          <span className="mt-1 block truncate text-xs text-zera-muted">
            {business.country || "Country not set"} / {business.currency || "Currency"} / {formatPOSMode(posMode, business.type)}
          </span>
        </button>
      </td>
      <td className="px-4 py-2.5">
        <span className="font-semibold text-zera-ink">{business.type || "Not set"}</span>
        <span className="mt-1 block">
          <StatusPill label={business.status?.toLowerCase() || "active"} muted={business.status !== "ACTIVE"} />
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="font-semibold text-zera-ink">{business.platformPackage?.name || "Starter"}</span>
        <span className="mt-1 block text-xs text-zera-muted">{activeModules}/{totalModules} modules</span>
      </td>
      <td className="px-4 py-2.5 text-zera-muted">
        <span className="font-semibold text-zera-ink">{activeBranches}/{totalBranches}</span> branches
        <span className="mx-2 text-zera-lineStrong">|</span>
        <span className="font-semibold text-zera-ink">{activeUsers}/{totalUsers}</span> users
        <span className="mx-2 text-zera-lineStrong">|</span>
        <span className="font-semibold text-zera-ink">{business._count?.products || 0}</span> products
      </td>
      <td className="max-w-[220px] truncate px-4 py-2.5 text-zera-muted">{owner?.user?.email || "Owner not assigned"}</td>
      <td className="px-4 py-2.5 text-right">
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink transition hover:border-zera-green hover:text-zera-green"
          onClick={onSelect}
        >
          Manage
          <ChevronRight size={15} />
        </button>
      </td>
    </tr>
  );
}

function SelectedProductPanel({ product }) {
  return (
    <div className="border-t border-zera-line bg-[#f7faf8] px-4 py-3">
      <p className="text-xs font-bold uppercase text-zera-green">{product.title}</p>
      <p className="mt-1 text-sm leading-6 text-zera-muted">{product.detail}</p>
    </div>
  );
}

function PackageSettingsSection({ businesses, onSave, packageOptions, packageSavingKey, platformProducts }) {
  const [selectedPackageKey, setSelectedPackageKey] = useState(packageOptions[0]?.key || "STARTER");
  const selectedPackage = packageOptions.find((packageItem) => packageItem.key === selectedPackageKey) || packageOptions[0];

  useEffect(() => {
    if (packageOptions.some((packageItem) => packageItem.key === selectedPackageKey)) {
      return;
    }

    setSelectedPackageKey(packageOptions[0]?.key || "");
  }, [packageOptions, selectedPackageKey]);

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zera-line bg-white px-4 py-3 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">SaaS packages</p>
            <h2 className="mt-1 text-xl font-bold text-zera-ink">Plans and limits</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
              Define the limits and default modules for each package. Organizations assigned to a package inherit its module availability.
            </p>
          </div>
          <div className="rounded-md border border-zera-line bg-[#f7faf8] px-3 py-2 text-sm text-zera-muted">
            <span className="font-bold text-zera-ink">{packageOptions.length}</span> plans configured
          </div>
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
          <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
            <SectionTitle icon={CreditCard} title="Package directory" subtitle="Select a plan to edit its limits and included modules." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Package</th>
                  <th className="px-4 py-3 font-bold">Limits</th>
                  <th className="px-4 py-3 font-bold">Modules</th>
                  <th className="px-4 py-3 font-bold">Organizations</th>
                  <th className="px-4 py-3 text-right font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zera-line">
                {packageOptions.map((packageItem) => {
                  const assignedCount = businesses.filter(
                    (business) => business.platformPackage?.id === packageItem.id || business.platformPackage?.key === packageItem.key
                  ).length;

                  return (
                    <tr
                      key={packageItem.key}
                      className={`cursor-pointer transition hover:bg-[#f7faf8] ${selectedPackage?.key === packageItem.key ? "bg-zera-mint/70" : "bg-white"}`}
                      onClick={() => setSelectedPackageKey(packageItem.key)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-zera-ink">{packageItem.name}</p>
                        <p className="mt-1 max-w-[320px] truncate text-xs text-zera-muted">{packageItem.description}</p>
                      </td>
                      <td className="px-4 py-3 text-zera-muted">{formatPackageLimits(packageItem)}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-zera-ink">{packageItem.defaultModuleKeys?.length || 0}</span>
                        <span className="text-zera-muted"> included</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zera-ink">{assignedCount}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusPill label={packageItem.active === false ? "inactive" : "active"} muted={packageItem.active === false} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selectedPackage ? (
          <PackagePlanCard
            assignedCount={
              businesses.filter((business) => business.platformPackage?.id === selectedPackage.id || business.platformPackage?.key === selectedPackage.key).length
            }
            onSave={onSave}
            packageItem={selectedPackage}
            platformProducts={platformProducts}
            saving={packageSavingKey === selectedPackage.key}
          />
        ) : null}
      </div>
    </section>
  );
}

function PackagePlanCard({ assignedCount, onSave, packageItem, platformProducts, saving }) {
  const [form, setForm] = useState(() => getPackageForm(packageItem));

  useEffect(() => {
    setForm(getPackageForm(packageItem));
  }, [
    packageItem.id,
    packageItem.key,
    packageItem.name,
    packageItem.description,
    packageItem.price,
    packageItem.currency,
    packageItem.billingCycle,
    packageItem.maxBranches,
    packageItem.maxUsers,
    packageItem.maxProducts,
    packageItem.active,
    packageItem.defaultModuleKeys?.join("|")
  ]);

  function handleSubmit(event) {
    event.preventDefault();
    onSave(packageItem, {
      ...form,
      price: form.price === "" ? null : Number(form.price),
      maxBranches: form.maxBranches === "" ? null : Number(form.maxBranches),
      maxUsers: form.maxUsers === "" ? null : Number(form.maxUsers),
      maxProducts: form.maxProducts === "" ? null : Number(form.maxProducts)
    });
  }

  function toggleModule(moduleKey) {
    setForm((current) => {
      const activeKeys = new Set(current.defaultModuleKeys);

      if (activeKeys.has(moduleKey)) {
        activeKeys.delete(moduleKey);
      } else {
        activeKeys.add(moduleKey);
      }

      return {
        ...current,
        defaultModuleKeys: [...activeKeys]
      };
    });
  }

  return (
    <form className="flex min-h-full flex-col overflow-hidden rounded-xl border border-zera-line bg-white shadow-card" onSubmit={handleSubmit}>
      <div className="border-b border-zera-line bg-[#fbfdfb] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-zera-muted">{packageItem.key}</p>
            <input
              className="mt-1 w-full rounded-md border border-transparent bg-transparent p-0 text-xl font-bold text-zera-ink outline-none transition focus:border-zera-line focus:bg-white focus:px-2 focus:py-1"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <StatusPill label={form.active ? "active" : "inactive"} muted={!form.active} />
        </div>
        <p className="mt-2 text-sm text-zera-muted">
          {assignedCount} {assignedCount === 1 ? "organization" : "organizations"} assigned
        </p>
      </div>

      <div className="flex-1 space-y-4 p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zera-ink">Description</span>
          <textarea
            className="min-h-20 w-full resize-none rounded-md border border-zera-line bg-white px-3 py-2 text-sm leading-6 text-zera-ink outline-none transition placeholder:text-zera-muted/60 hover:border-zera-lineStrong focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Price" type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
          <Input label="Currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <PackageNumberField label="Branches" value={form.maxBranches} onChange={(value) => setForm({ ...form, maxBranches: value })} />
          <PackageNumberField label="Users" value={form.maxUsers} onChange={(value) => setForm({ ...form, maxUsers: value })} />
          <PackageNumberField label="Products" value={form.maxProducts} onChange={(value) => setForm({ ...form, maxProducts: value })} />
        </div>

        <div>
          <p className="text-sm font-semibold text-zera-ink">Modules included</p>
          <div className="mt-2 grid gap-2">
            {platformProducts.map((product) => {
              const active = form.defaultModuleKeys.includes(product.key);

              return (
                <button
                  key={product.key}
                  type="button"
                  className={`flex min-h-10 items-center justify-between rounded-md border px-3 text-sm font-semibold transition ${
                    active ? "border-zera-green bg-zera-mint text-zera-green" : "border-zera-line bg-white text-zera-muted hover:border-zera-green"
                  }`}
                  onClick={() => toggleModule(product.key)}
                >
                  <span>{product.title}</span>
                  <span className={`h-3 w-3 rounded-full ${active ? "bg-zera-green" : "bg-zera-line"}`} />
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-3 py-2">
          <span>
            <span className="block text-sm font-semibold text-zera-ink">Available for new customers</span>
            <span className="block text-xs text-zera-muted">Inactive plans stay hidden from setup choices later.</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-zera-green"
            checked={form.active}
            onChange={(event) => setForm({ ...form, active: event.target.checked })}
          />
        </label>
      </div>

      <div className="border-t border-zera-line bg-[#fbfdfb] p-4">
        <Button className="w-full" disabled={saving}>
          {saving ? "Saving package..." : "Save package"}
        </Button>
      </div>
    </form>
  );
}

function PackageNumberField({ label, onChange, value }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase text-zera-muted">{label}</span>
      <input
        className="min-h-10 w-full rounded-md border border-zera-line bg-white px-2 text-sm font-semibold text-zera-ink outline-none transition hover:border-zera-lineStrong focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        min="0"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PlatformSettingsSection({ businessTypeOptions, packageOptions, platformProducts }) {
  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zera-line bg-white px-4 py-3 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Platform settings</p>
            <h2 className="mt-1 text-xl font-bold text-zera-ink">Provisioning catalog</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
              These settings describe how Zera creates customer workspaces. Keep this area compact and predictable because it controls the rest of the system.
            </p>
          </div>
          <StatusPill label="catalog ready" />
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
          <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
            <SectionTitle icon={SlidersHorizontal} title="Business types" subtitle="Each type determines the default POS workflow and staff roles." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">POS workflow</th>
                  <th className="px-4 py-3 font-bold">Default roles</th>
                  <th className="px-4 py-3 font-bold">Modules</th>
                  <th className="px-4 py-3 text-right font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zera-line">
                {businessTypeOptions.map((type) => (
                  <tr key={type.key || type.value} className="hover:bg-[#f7faf8]">
                    <td className="px-4 py-3">
                      <p className="font-bold text-zera-ink">{type.label}</p>
                      <p className="mt-1 max-w-[320px] truncate text-xs text-zera-muted">{type.helper}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-zera-green">{formatPOSMode(type.posMode, type.value)}</td>
                    <td className="px-4 py-3 text-zera-muted">{["Owner", "Manager", ...(type.roles || []).map((role) => role.name)].join(", ")}</td>
                    <td className="px-4 py-3 text-zera-muted">{(type.defaultModuleKeys || ["POS"]).join(", ")}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusPill label={type.active === false ? "inactive" : "active"} muted={type.active === false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <CompactCatalogPanel
            icon={Boxes}
            title="Modules"
            subtitle={`${platformProducts.length} product foundations`}
            rows={platformProducts.map((product) => ({
              label: product.title,
              value: product.key,
              helper: product.summary
            }))}
          />
          <CompactCatalogPanel
            icon={CreditCard}
            title="Packages"
            subtitle={`${packageOptions.filter((packageItem) => packageItem.active !== false).length} active plans`}
            rows={packageOptions.map((packageItem) => ({
              label: packageItem.name,
              value: packageItem.active === false ? "Inactive" : "Active",
              helper: formatPackageLimits(packageItem)
            }))}
          />
        </section>
      </div>
    </section>
  );
}

function CompactCatalogPanel({ icon: Icon, rows, subtitle, title }) {
  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
        <SectionTitle icon={Icon} title={title} subtitle={subtitle} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
            <tr>
              <th className="px-4 py-3 font-bold">Name</th>
              <th className="px-4 py-3 font-bold">Details</th>
              <th className="px-4 py-3 text-right font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {rows.map((row) => (
              <tr key={`${row.label}-${row.value}`} className="hover:bg-[#f7faf8]">
                <td className="max-w-[180px] truncate px-4 py-3 font-semibold text-zera-ink">{row.label}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-zera-muted">{row.helper}</td>
                <td className="px-4 py-3 text-right">
                  <span className="rounded-md bg-[#f7faf8] px-2.5 py-1 text-xs font-bold uppercase text-zera-muted">{row.value}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsSection({
  businessTypeOptions,
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
  userSavingId,
  packageOptions,
  platformProducts
}) {
  return (
    <section className="grid gap-4 2xl:grid-cols-[minmax(560px,0.82fr)_minmax(0,1.18fr)]">
      <div className="min-w-0">
        <OrganizationTableCard
          businessTypeOptions={businessTypeOptions}
          businesses={businesses}
          compact
          filteredBusinesses={filteredBusinesses}
          loading={loading}
          maxHeightClass="max-h-[calc(100vh-260px)] min-h-[520px]"
          onCreate={onCreate}
          onSearch={onSearch}
          onSelect={onSelect}
          search={search}
          selectedBusiness={business}
          showCreateAction
          subtitle="Find a customer workspace, then manage its setup."
          title="Organizations"
        />
      </div>
      <div className="min-w-0">
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
          packageOptions={packageOptions}
          platformProducts={platformProducts}
          businessTypeOptions={businessTypeOptions}
        />
      </div>
    </section>
  );
}

function BusinessWorkspace({
  businessTypeOptions,
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
  userSavingId,
  packageOptions,
  platformProducts
}) {
  const [workspaceSection, setWorkspaceSection] = useState("identity");

  if (!business) {
    return (
      <section className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-zera-line bg-white p-6 text-center shadow-card">
        <Building2 size={34} className="text-zera-green" />
        <h3 className="mt-4 text-xl font-bold">Select an organization</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-zera-muted">
          Choose a customer workspace from the directory or create a new organization.
        </p>
        <Button type="button" className="mt-5 gap-2" onClick={onCreate}>
          <Plus size={16} />
          New organization
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
  const activeModules = (business.modules || []).filter((module) => module.active).length;
  const activeBranches = (business.branches || []).filter((branch) => branch.status === "ACTIVE").length;
  const activeUsers = (business.memberships || []).filter((membership) => membership.user?.status === "ACTIVE").length;

  return (
    <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
      <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-xl font-bold text-zera-ink">{business.name}</p>
              <StatusPill label={business.status?.toLowerCase() || "active"} muted={business.status !== "ACTIVE"} />
            </div>
            <p className="mt-1 truncate text-sm leading-5 text-zera-muted">
              {business.type || "Business type not set"} · {business.platformPackage?.name || "Starter"} · {formatPOSMode(business.posMode, business.type)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-zera-line bg-zera-line text-sm sm:w-[330px]">
            <CompactFact compact label="Branches" value={`${activeBranches}/${business.branches?.length || 0}`} />
            <CompactFact compact label="Modules" value={`${activeModules}/${business.modules?.length || 0}`} />
            <CompactFact compact label="Users" value={`${activeUsers}/${business.memberships?.length || 0}`} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-zera-line pt-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-zera-muted">{activePanel.helper}</p>
          <div className="flex shrink-0 flex-wrap gap-1 rounded-lg border border-zera-line bg-white p-1">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                className={`min-h-9 rounded-md px-3 text-sm font-semibold transition ${
                  workspaceSection === section.key ? "bg-zera-ink text-white shadow-sm" : "text-zera-muted hover:bg-[#f7faf8] hover:text-zera-ink"
                }`}
                onClick={() => setWorkspaceSection(section.key)}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-4">
        {workspaceSection === "identity" ? (
          <BusinessSettingsCard
            business={business}
            businessTypeOptions={businessTypeOptions}
            onSave={onBusinessSave}
            packageOptions={packageOptions}
            saving={settingsSaving}
          />
        ) : null}
        {workspaceSection === "branches" ? (
          <BranchesCard branchSavingId={branchSavingId} business={business} onBranchStatusChange={onBranchStatusChange} />
        ) : null}
        {workspaceSection === "modules" ? (
          <ModulesCard business={business} moduleSavingKey={moduleSavingKey} onModuleToggle={onModuleToggle} platformProducts={platformProducts} />
        ) : null}
        {workspaceSection === "access" ? (
          <TeamCard
            business={business}
            onCreateUser={onCreateUser}
            onUserStatusChange={onUserStatusChange}
            owner={owner}
            userSaving={userSaving}
            userSavingId={userSavingId}
            businessTypeOptions={businessTypeOptions}
          />
        ) : null}
      </div>
    </section>
  );
}

function CreateBusinessPanel({ businessTypeOptions, form, onCancel, onChange, onSubmit, packageOptions, saving }) {
  const selectedType = getBusinessTypeOption(form.businessType, businessTypeOptions);
  const selectedPackage = getPackageOption(form.packageKey, packageOptions);
  const startingUsage = {
    branches: form.branchName?.trim() ? 1 : 0,
    users: 1,
    products: 0
  };

  return (
    <form className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 border-b border-zera-line bg-[#fbfdfb] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zera-green">Provision organization</p>
          <h2 className="mt-1 text-2xl font-bold">Create customer workspace</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zera-muted">
            Create one customer organization, assign the correct business type, activate its first package, and give the owner their admin login.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="gap-2" disabled={saving}>
            <Plus size={16} />
            {saving ? "Creating..." : "Create organization"}
          </Button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-5 p-5">
          <section>
            <SectionTitle icon={Building2} title="Organization" subtitle="Customer identity and commercial setup." />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input
                label="Business name"
                placeholder="Bamboo Bar and Restaurant"
                value={form.businessName}
                onChange={(event) => onChange({ ...form, businessName: event.target.value })}
                required
              />
              <BusinessTypeSelect
                businessTypeOptions={businessTypeOptions}
                value={form.businessType}
                onChange={(businessType) => onChange({ ...form, businessType })}
              />
              <PackageSelect packageOptions={packageOptions} value={form.packageKey} onChange={(packageKey) => onChange({ ...form, packageKey })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Country" value={form.country} onChange={(event) => onChange({ ...form, country: event.target.value })} />
                <Input label="Currency" value={form.currency} onChange={(event) => onChange({ ...form, currency: event.target.value.toUpperCase() })} />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle icon={MapPin} title="First branch" subtitle="The first location this customer will operate from." />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="Branch name" value={form.branchName} onChange={(event) => onChange({ ...form, branchName: event.target.value })} />
              <Input
                label="Branch location"
                placeholder="Kampala, Lubaga..."
                value={form.branchLocation}
                onChange={(event) => onChange({ ...form, branchLocation: event.target.value })}
              />
            </div>
          </section>

          <section>
            <SectionTitle icon={KeyRound} title="Owner login" subtitle="The first admin account for this organization." />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
          </section>
        </div>

        <aside className="border-t border-zera-line bg-[#f7faf8] p-5 xl:border-l xl:border-t-0">
          <div className="xl:sticky xl:top-24">
            <SectionTitle icon={ShieldCheck} title="Provisioning summary" subtitle="Review what the customer receives." />
            <dl className="mt-4 divide-y divide-zera-line rounded-md border border-zera-line bg-white text-sm">
              <SummaryRow label="POS experience" value={formatPOSMode(selectedType.posMode, selectedType.value)} />
              <SummaryRow label="Business type" value={selectedType.label} />
              <SummaryRow label="Package" value={selectedPackage.name} />
              <SummaryRow label="First branch" value={form.branchName || "Not set"} />
              <SummaryRow label="Owner email" value={form.ownerEmail || "Not set"} />
            </dl>
            <div className="mt-4 rounded-md border border-zera-line bg-white p-3">
              <p className="text-sm font-bold text-zera-ink">Operating model</p>
              <p className="mt-2 text-sm leading-6 text-zera-muted">{selectedType.helper}</p>
            </div>
            <div className="mt-4 rounded-md border border-zera-line bg-white p-3">
              <p className="text-sm font-bold text-zera-ink">{selectedPackage.name} package</p>
              <p className="mt-2 text-sm leading-6 text-zera-muted">{selectedPackage.description}</p>
              <p className="mt-2 text-xs font-semibold uppercase text-zera-muted">{formatPackageLimits(selectedPackage)}</p>
            </div>
            <div className="mt-4">
              <PackageUsagePanel selectedPackage={selectedPackage} usage={startingUsage} />
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

function BusinessSettingsCard({ business, businessTypeOptions, onSave, packageOptions, saving }) {
  const [settingsForm, setSettingsForm] = useState(() => getBusinessSettingsForm(business, businessTypeOptions));

  useEffect(() => {
    setSettingsForm(getBusinessSettingsForm(business, businessTypeOptions));
  }, [
    business?.id,
    business?.name,
    business?.type,
    business?.country,
    business?.currency,
    business?.status,
    business?.posMode,
    business?.platformPackage?.key,
    businessTypeOptions
  ]);

  const selectedType = getBusinessTypeOption(settingsForm.type, businessTypeOptions);
  const selectedPackage = getPackageOption(settingsForm.packageKey, packageOptions);
  const packageUsage = getBusinessPackageUsage(business);

  function handleSubmit(event) {
    event.preventDefault();
    onSave({
      ...settingsForm,
      posMode: selectedType.posMode
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SectionTitle icon={Settings} title="Organization controls" subtitle="Platform-owned settings that shape this customer's workspace." />
        <Button className="w-full md:w-auto" disabled={saving}>
          {saving ? "Saving..." : "Save configuration"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-md border border-zera-line bg-white">
          <div className="border-b border-zera-line px-4 py-3">
            <p className="font-bold text-zera-ink">Identity</p>
            <p className="mt-1 text-sm text-zera-muted">Name, type, country, currency, and account state.</p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <Input
              label="Business name"
              value={settingsForm.name}
              onChange={(event) => setSettingsForm({ ...settingsForm, name: event.target.value })}
              required
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
            <BusinessTypeSelect businessTypeOptions={businessTypeOptions} value={settingsForm.type} onChange={(type) => setSettingsForm({ ...settingsForm, type })} />
            <PackageSelect packageOptions={packageOptions} value={settingsForm.packageKey} onChange={(packageKey) => setSettingsForm({ ...settingsForm, packageKey })} />
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
        </section>

        <aside className="space-y-4 rounded-md border border-zera-line bg-[#f7faf8] p-4">
          <SectionTitle icon={SlidersHorizontal} title="Current setup" subtitle="What this organization can use." />
          <dl className="divide-y divide-zera-line rounded-md border border-zera-line bg-white text-sm">
            <SummaryRow label="POS experience" value={formatPOSMode(selectedType.posMode, selectedType.value)} />
            <SummaryRow label="Business type" value={selectedType.label} />
            <SummaryRow label="Package" value={selectedPackage.name} />
            <SummaryRow label="Status" value={settingsForm.status === "ACTIVE" ? "Active" : "Inactive"} />
          </dl>
          <PackageUsagePanel selectedPackage={selectedPackage} usage={packageUsage} />
        </aside>
      </div>
    </form>
  );
}

function BusinessTypeSelect({ businessTypeOptions = fallbackBusinessTypeOptions, onChange, value }) {
  const selectedType = getBusinessTypeOption(value, businessTypeOptions);

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
      <p className="mt-1.5 text-xs leading-5 text-zera-muted">
        {formatPOSMode(selectedType.posMode, selectedType.value)}. {selectedType.helper}
      </p>
    </label>
  );
}

function PackageSelect({ onChange, packageOptions = fallbackPackageOptions, value }) {
  const selectedPackage = getPackageOption(value, packageOptions);
  const visiblePackageOptions = packageOptions.filter((packageItem) => packageItem.active !== false || packageItem.key === selectedPackage.key);

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zera-ink">Customer package</span>
      <select
        className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        value={selectedPackage.key}
        onChange={(event) => onChange(event.target.value)}
      >
        {visiblePackageOptions.map((packageItem) => (
          <option key={packageItem.key} value={packageItem.key}>
            {packageItem.name}
            {packageItem.active === false ? " (inactive)" : ""}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs leading-5 text-zera-muted">
        {selectedPackage.description} {formatPackageLimits(selectedPackage)}
      </p>
    </label>
  );
}

function PackageUsagePanel({ selectedPackage, usage }) {
  const rows = [
    { key: "branches", label: "Branches", limit: selectedPackage.maxBranches, value: usage.branches },
    { key: "users", label: "Users", limit: selectedPackage.maxUsers, value: usage.users },
    { key: "products", label: "Products", limit: selectedPackage.maxProducts, value: usage.products }
  ];
  const overLimit = rows.some((row) => row.limit !== null && row.limit !== undefined && row.value > row.limit);

  return (
    <div className="rounded-md border border-zera-line bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">Package usage</p>
        <span className={`rounded-md px-2 py-1 text-xs font-bold ${overLimit ? "bg-red-50 text-red-700" : "bg-zera-mint text-zera-green"}`}>
          {overLimit ? "Over limit" : "Within limit"}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <PackageLimitRow key={row.key} {...row} />
        ))}
      </div>
    </div>
  );
}

function PackageLimitRow({ label, limit, value }) {
  const hasLimit = limit !== null && limit !== undefined;
  const percentage = hasLimit ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  const overLimit = hasLimit && value > limit;
  const nearLimit = hasLimit && !overLimit && percentage >= 85;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-zera-muted">{label}</span>
        <span className={`font-bold ${overLimit ? "text-red-700" : nearLimit ? "text-amber-700" : "text-zera-ink"}`}>
          {value.toLocaleString()} / {hasLimit ? limit.toLocaleString() : "Custom"}
        </span>
      </div>
      {hasLimit ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eef3ef]">
          <div
            className={`h-full rounded-full ${overLimit ? "bg-red-500" : nearLimit ? "bg-amber-500" : "bg-zera-green"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ModulesCard({ business, moduleSavingKey, onModuleToggle, platformProducts }) {
  return (
    <section>
      <SectionTitle icon={Boxes} title="Modules" subtitle="Enable only what this business needs now" />
      <div className="mt-4 overflow-x-auto rounded-md border border-zera-line">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-zera-line bg-[#f7faf8] text-xs font-bold uppercase text-zera-muted">
            <tr>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {(business.modules || []).map((module) => (
              <ModuleToggleRow
                key={module.id}
                module={module}
                saving={moduleSavingKey === module.key}
                onToggle={(active) => onModuleToggle(module.key, active)}
                platformProducts={platformProducts}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModuleToggleRow({ module, onToggle, saving, platformProducts }) {
  const moduleProduct = platformProducts.find((product) => product.key === module.key);
  const moduleName = module.name || moduleProduct?.title || module.key;

  return (
    <tr className="hover:bg-[#f7faf8]">
      <td className="px-4 py-3">
        <p className="font-bold text-zera-ink">{moduleName}</p>
        <p className="mt-0.5 text-xs font-semibold uppercase text-zera-muted">{module.key}</p>
      </td>
      <td className="max-w-[420px] truncate px-4 py-3 text-zera-muted">{getModuleDescription(module.key, platformProducts)}</td>
      <td className="px-4 py-3">
        <StatusPill label={module.active ? "enabled" : "disabled"} muted={!module.active} />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition ${
            module.active ? "bg-zera-green" : "bg-zera-line"
          } disabled:cursor-not-allowed disabled:opacity-70`}
          onClick={() => onToggle(!module.active)}
          disabled={saving}
          aria-label={`${module.active ? "Disable" : "Enable"} ${moduleName}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${module.active ? "left-7" : "left-1"}`} />
        </button>
      </td>
    </tr>
  );
}

function BranchesCard({ branchSavingId, business, onBranchStatusChange }) {
  return (
    <section>
      <SectionTitle icon={MapPin} title="Branches" subtitle="Locations connected to this business" />
      <div className="mt-4 overflow-x-auto rounded-md border border-zera-line">
        {business.branches?.length ? (
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="border-b border-zera-line bg-[#f7faf8] text-xs font-bold uppercase text-zera-muted">
              <tr>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zera-line">
              {business.branches.map((branch) => (
                <tr key={branch.id} className="hover:bg-[#f7faf8]">
                  <td className="px-4 py-3 font-bold text-zera-ink">{branch.name}</td>
                  <td className="px-4 py-3 text-zera-muted">{branch.location || "Location not set"}</td>
                  <td className="px-4 py-3">
                    <StatusPill label={branch.status?.toLowerCase() || "active"} muted={branch.status !== "ACTIVE"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className={`min-h-9 rounded-md px-3 text-sm font-semibold transition ${
                        branch.status === "ACTIVE"
                          ? "border border-zera-line bg-white text-zera-muted hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          : "bg-zera-green text-white hover:bg-[#116832]"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={branchSavingId === branch.id}
                      onClick={() => onBranchStatusChange(branch.id, branch.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                    >
                      {branchSavingId === branch.id ? "Saving..." : branch.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-4">
            <EmptyState text="No branches are connected to this business." />
          </div>
        )}
      </div>
    </section>
  );
}

function TeamCard({ business, businessTypeOptions, onCreateUser, onUserStatusChange, owner, userSaving, userSavingId }) {
  const [form, setForm] = useState(defaultUserForm);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [search, setSearch] = useState("");
  const roleOptions = useMemo(() => buildRoleOptions(business, businessTypeOptions), [business, businessTypeOptions]);
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
    <div className={`${compact ? "bg-white" : "rounded-lg bg-[#f7faf8]"} px-3 py-3`}>
      <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 px-3 py-2.5">
      <dt className="text-xs font-bold uppercase text-zera-muted">{label}</dt>
      <dd className="truncate text-right font-semibold text-zera-ink">{value}</dd>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-lg border border-dashed border-zera-line bg-[#f7faf8] p-5 text-sm text-zera-muted">{text}</div>;
}

function SectionTitle({ icon: Icon, subtitle, title }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef7f1] text-zera-green">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-zera-ink">{title}</h3>
        <p className="text-sm leading-5 text-zera-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, muted = false }) {
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold capitalize ${
        muted ? "border-zera-line bg-white text-zera-muted" : "border-green-100 bg-zera-mint text-zera-green"
      }`}
    >
      {label}
    </span>
  );
}

function formatShortDate(value) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleDateString("en-UG", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
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

function buildRoleOptions(business, businessTypeOptions = fallbackBusinessTypeOptions) {
  const roles = business?.roles || [];
  const visibleRoles = roles.filter((role) => role.name !== "Owner");

  if (visibleRoles.length > 0) {
    return visibleRoles;
  }

  const typeOption = getBusinessTypeOption(business?.type, businessTypeOptions);
  const typeRoles = typeOption.roles || [];

  return [
    { name: "Manager", description: "Manage daily operations." },
    ...typeRoles
  ];
}

function getPackageForm(packageItem = fallbackPackageOptions[0]) {
  return {
    name: packageItem.name || "",
    description: packageItem.description || "",
    price: packageItem.price ?? "",
    currency: packageItem.currency || "UGX",
    billingCycle: packageItem.billingCycle || "MONTHLY",
    maxBranches: packageItem.maxBranches ?? "",
    maxUsers: packageItem.maxUsers ?? "",
    maxProducts: packageItem.maxProducts ?? "",
    defaultModuleKeys: packageItem.defaultModuleKeys?.length ? packageItem.defaultModuleKeys : [],
    active: packageItem.active !== false
  };
}

function getBusinessSettingsForm(business, businessTypeOptions = fallbackBusinessTypeOptions) {
  return {
    name: business?.name || "",
    type: business?.type || "Retail shop",
    packageKey: business?.platformPackage?.key || "STARTER",
    country: business?.country || "Uganda",
    currency: business?.currency || "UGX",
    status: business?.status || "ACTIVE",
    posMode: business?.posMode || getBusinessTypeOption(business?.type, businessTypeOptions).posMode
  };
}

function getBusinessPackageUsage(business) {
  return {
    branches: (business?.branches || []).filter((branch) => branch.status === "ACTIVE").length,
    users: (business?.memberships || []).filter((membership) => membership.user?.status === "ACTIVE").length,
    products: business?._count?.products || 0
  };
}

function getPlatformHealth({ businesses, packageOptions, platformProducts }) {
  const organizationCount = Math.max(businesses.length, 1);
  const activePackages = packageOptions.filter((packageItem) => packageItem.active !== false).length;
  const packageCount = Math.max(packageOptions.length, 1);
  const readyOrganizations = businesses.filter((business) => {
    const hasOwner = Boolean(getOwner(business));
    const hasActiveBranch = (business.branches || []).some((branch) => branch.status === "ACTIVE");
    const hasPOS = (business.modules || []).some((module) => module.key === "POS" && module.active);
    return hasOwner && hasActiveBranch && hasPOS && business.status === "ACTIVE";
  }).length;
  const moduleSlots = Math.max(businesses.length * Math.max(platformProducts.length, 1), 1);
  const activeModules = businesses.reduce((total, business) => total + (business.modules || []).filter((module) => module.active).length, 0);
  const rows = [
    {
      label: "Workspace readiness",
      value: `${readyOrganizations}/${businesses.length}`,
      percent: Math.round((readyOrganizations / organizationCount) * 100),
      warning: businesses.length > 0 && readyOrganizations < businesses.length,
      helper: "Owner, active branch, POS, and active status."
    },
    {
      label: "Package availability",
      value: `${activePackages}/${packageOptions.length}`,
      percent: Math.round((activePackages / packageCount) * 100),
      warning: activePackages === 0,
      helper: "Plans available for new customer setup."
    },
    {
      label: "Module coverage",
      value: `${activeModules}/${moduleSlots}`,
      percent: Math.round((activeModules / moduleSlots) * 100),
      warning: businesses.length > 0 && activeModules === 0,
      helper: "Enabled modules across all workspaces."
    }
  ];

  return {
    rows,
    score: Math.round(rows.reduce((total, row) => total + row.percent, 0) / rows.length)
  };
}

function getAttentionItems(businesses) {
  return businesses.flatMap((business) => {
    const items = [];
    const hasOwner = Boolean(getOwner(business));
    const hasActiveBranch = (business.branches || []).some((branch) => branch.status === "ACTIVE");
    const hasPOS = (business.modules || []).some((module) => module.key === "POS" && module.active);

    if (!hasOwner) {
      items.push({ businessId: business.id, businessName: business.name, label: "Owner login missing", severity: "critical" });
    }

    if (!hasActiveBranch) {
      items.push({ businessId: business.id, businessName: business.name, label: "No active branch", severity: "critical" });
    }

    if (!hasPOS) {
      items.push({ businessId: business.id, businessName: business.name, label: "POS module disabled", severity: "review" });
    }

    if (business.platformPackage?.active === false) {
      items.push({ businessId: business.id, businessName: business.name, label: "Assigned package is inactive", severity: "review" });
    }

    if (business.status !== "ACTIVE") {
      items.push({ businessId: business.id, businessName: business.name, label: "Organization is inactive", severity: "review" });
    }

    return items;
  });
}

function getRecentActivity(businesses) {
  return [...businesses]
    .sort((first, second) => new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0))
    .slice(0, 8)
    .map((business) => ({
      label: business.name,
      date: business.updatedAt || business.createdAt || business.id,
      description: `${business.type || "Business"} / ${business.platformPackage?.name || "Starter"} / ${business.status?.toLowerCase() || "active"}`
    }));
}

function getOwner(business) {
  return business?.memberships?.find((membership) => membership.role?.name === "Owner") || null;
}

function getModuleDescription(key, platformProducts = fallbackPlatformProducts) {
  const moduleProduct = platformProducts.find((product) => product.key === key);
  return moduleProduct?.description || moduleProduct?.detail || "Business capability controlled by System Admin.";
}

function formatPackageLimits(packageItem = fallbackPackageOptions[0]) {
  const limits = [
    packageItem.maxBranches !== null && packageItem.maxBranches !== undefined
      ? `${packageItem.maxBranches} ${packageItem.maxBranches === 1 ? "branch" : "branches"}`
      : "Custom branches",
    packageItem.maxUsers !== null && packageItem.maxUsers !== undefined ? `${packageItem.maxUsers} users` : "Custom users",
    packageItem.maxProducts !== null && packageItem.maxProducts !== undefined ? `${packageItem.maxProducts.toLocaleString()} products` : "Custom products"
  ];

  return limits.join(" / ");
}
