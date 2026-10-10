import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  Download,
  FileText,
  Hotel,
  KeyRound,
  MapPin,
  Palette,
  Pill,
  Plus,
  ReceiptText,
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
import LogoUpload from "../../components/LogoUpload.jsx";
import { brandTheme } from "../../utils/brandTheme.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { updateBusinessModule } from "../../services/setupService.js";
import {
  buildSystemBusinessDesktopInstaller,
  getSystemBusinessInstallations,
  createInstallationEnrollment,
  revokeInstallation,
  createPlatformBusinessType,
  createPlatformPackage,
  createSystemBusinessBranch,
  createSystemBusinessUser,
  downloadSystemBusinessDesktopInstaller,
  downloadSystemBusinessDeploymentPackage,
  getSystemBusinesses,
  getSystemSetupCatalog,
  provisionBusiness,
  updatePlatformBusinessType,
  updatePlatformPackage,
  updateSystemBusinessBranchStatus,
  updateSystemBusinessUserStatus,
  updateSystemBusinessSettings
} from "../../services/systemAdminService.js";

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

const defaultBranchForm = {
  name: "",
  location: ""
};

const packageStatusOptions = [
  { value: "TRIAL", label: "Trial", helper: "Customer is testing Zera before paid activation." },
  { value: "ACTIVE", label: "Active", helper: "Package is paid or approved for normal use." },
  { value: "PAST_DUE", label: "Payment due", helper: "Payment needs follow-up, but access can remain open." },
  { value: "SUSPENDED", label: "Suspended", helper: "Temporarily blocked until the account is resolved." },
  { value: "CANCELLED", label: "Cancelled", helper: "Customer is no longer using this package." }
];

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
    helper: "Device, accessory, stock, receipt, and repair-service tools.",
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
    helper: "Medicine sales, services, stock control, and counter reporting.",
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
    helper: "Front-desk service sales, guest charges, and branch reporting.",
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
    summary: "Products, stock visibility, branches, and warehouse control.",
    detail: "Designed to grow from simple product records into stock transfers, reorder alerts, and multi-location inventory."
  },
  {
    key: "FINANCE",
    title: "Finance",
    icon: ShieldCheck,
    summary: "Cash, expenses, payment tracking, and business reporting.",
    detail: "Keeps owner and manager finance workflows clear with collections, expenses, payment tracking, and net cash visibility."
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
    description: "All active Zera modules for multi-team operations.",
    maxBranches: 10,
    maxUsers: 50,
    maxProducts: 10000,
    defaultModuleKeys: ["POS", "INVENTORY", "FINANCE", "OPERATIONS", "REPORTS"]
  },
  {
    key: "CUSTOM",
    name: "Custom",
    description: "Tailored package for customers with negotiated limits or a special module mix.",
    maxBranches: null,
    maxUsers: null,
    maxProducts: null,
    defaultModuleKeys: ["POS", "INVENTORY", "FINANCE", "OPERATIONS", "REPORTS"]
  }
];

const selectedBusinessStorageKey = "zera_system_admin_selected_business";

const SYSTEM_ADMIN_SECTIONS = [
  { id: "organizations", label: "Organizations", icon: Building2 },
  { id: "packages", label: "Packages", icon: CreditCard },
  { id: "platform", label: "Settings", icon: SlidersHorizontal }
];

const configurationSectionIds = SYSTEM_ADMIN_SECTIONS.map((section) => section.id);
const systemAdminSectionIds = new Set(["dashboard", ...configurationSectionIds, "create"]);

function getSystemAdminSection(section) {
  if (section === "overview") {
    return "dashboard";
  }

  return systemAdminSectionIds.has(section) ? section : "dashboard";
}

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

function getBusinessPackageKey(business) {
  return business?.platformPackage?.key || business?.packageKey || business?.packageCode || "STARTER";
}

function getBusinessPosMode(business, businessTypeOptions = fallbackBusinessTypeOptions) {
  return business?.posMode || getBusinessTypeOption(business?.type, businessTypeOptions).posMode || "RETAIL_CHECKOUT";
}

function formatPosLabel(posMode, businessType = "") {
  return formatPOSMode(posMode, businessType);
}

function getPackageSummary(packageKey, packageOptions = fallbackPackageOptions) {
  return getPackageOption(packageKey, packageOptions);
}

function getBusinessSetupSummary(business) {
  const branches = business?.branches || [];
  const memberships = business?.memberships || [];
  const modules = business?.modules || [];

  return {
    activeBranches: branches.filter((branch) => branch.status === "ACTIVE").length,
    totalBranches: branches.length,
    activeUsers: memberships.filter((membership) => membership.user?.status === "ACTIVE").length,
    totalUsers: memberships.length,
    activeModules: modules.filter((module) => module.active).length,
    totalModules: modules.length
  };
}

function getBusinessDeploymentReadiness(business) {
  const summary = getBusinessSetupSummary(business);
  const missing = [];
  const hasPOS = (business?.modules || []).some((module) => module.key === "POS" && module.active);

  if (business?.status !== "ACTIVE") {
    missing.push("Activate the organization.");
  }

  if (!business?.platformPackage) {
    missing.push("Assign a package.");
  }

  if (!isPackageStatusHealthy(business?.packageStatus)) {
    missing.push("Resolve the package status.");
  }

  if (summary.activeBranches === 0) {
    missing.push("Create or activate at least one branch.");
  }

  if (summary.activeUsers === 0) {
    missing.push("Create at least one active user.");
  }

  if (summary.activeModules === 0) {
    missing.push("Enable at least one module.");
  }

  if (!hasPOS) {
    missing.push("Enable POS before installation.");
  }

  return {
    ready: missing.length === 0,
    missing
  };
}

export default function SystemAdminPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState([]);
  const [setupCatalog, setSetupCatalog] = useState({
    businessTypes: fallbackBusinessTypeOptions,
    modules: fallbackPlatformProducts,
    packages: fallbackPackageOptions
  });
  const [form, setForm] = useState(defaultForm);
  const [selectedBusinessId, setSelectedBusinessId] = useState(() => localStorage.getItem(selectedBusinessStorageKey) || "");
  const [activeSection, setActiveSection] = useState(() => getSystemAdminSection(searchParams.get("section")));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleSavingKey, setModuleSavingKey] = useState("");
  const [packageSavingKey, setPackageSavingKey] = useState("");
  const [packageCreating, setPackageCreating] = useState(false);
  const [businessTypeSavingKey, setBusinessTypeSavingKey] = useState("");
  const [businessTypeCreating, setBusinessTypeCreating] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [branchCreating, setBranchCreating] = useState(false);
  const [branchSavingId, setBranchSavingId] = useState("");
  const [userSaving, setUserSaving] = useState(false);
  const [userSavingId, setUserSavingId] = useState("");
  const [deploymentDownloading, setDeploymentDownloading] = useState("");
  const [installerBuilding, setInstallerBuilding] = useState("");
  const [installerDownloading, setInstallerDownloading] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user?.systemRole === "SYSTEM_ADMIN") {
      loadBusinesses();
    }
  }, [user?.systemRole]);

  useEffect(() => {
    const nextSection = getSystemAdminSection(searchParams.get("section"));
    setActiveSection((current) => (current === nextSection ? current : nextSection));
  }, [searchParams]);

  useEffect(() => {
    if (loading || error) return;
    if (!businesses.length) {
      setSelectedBusinessId("");
      localStorage.removeItem(selectedBusinessStorageKey);
      return;
    }

    if (!businesses.some((business) => business.id === selectedBusinessId)) {
      setSelectedBusinessId(businesses[0].id);
    }
  }, [businesses, selectedBusinessId, loading, error]);

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

  function selectSection(sectionId) {
    const nextSection = getSystemAdminSection(sectionId);
    setActiveSection(nextSection);
    setSearchParams(nextSection === "dashboard" ? {} : { section: nextSection });
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
      selectSection("organizations");
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

  async function handlePackageCreate() {
    setError("");
    setMessage("");
    setPackageCreating(true);

    try {
      const packageName = getNextPackageName(packageOptions);
      const data = await createPlatformPackage({
        name: packageName,
        description: "Configure this package before making it available to new customers.",
        price: null,
        currency: "UGX",
        billingCycle: "MONTHLY",
        maxBranches: 1,
        maxUsers: 3,
        maxProducts: 300,
        defaultModuleKeys: ["POS", "REPORTS"],
        active: false
      });

      setSetupCatalog((current) => ({
        ...current,
        packages: data.catalog?.packages?.length ? data.catalog.packages : [...current.packages, data.package]
      }));
      setMessage(`${data.package?.name || packageName} package created. Review it before activating.`);
      return data.package;
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create package.");
      return null;
    } finally {
      setPackageCreating(false);
    }
  }

  async function handleBusinessTypeSave(businessType, payload) {
    setError("");
    setMessage("");
    setBusinessTypeSavingKey(businessType.key);

    try {
      const data = await updatePlatformBusinessType(businessType.id || businessType.key, payload);
      setSetupCatalog((current) => ({
        ...current,
        businessTypes: data.catalog?.businessTypes?.length
          ? data.catalog.businessTypes
          : current.businessTypes.map((item) => (item.key === data.businessType?.key ? data.businessType : item))
      }));
      setMessage(`${data.businessType?.label || businessType.label} setup updated.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update business type.");
    } finally {
      setBusinessTypeSavingKey("");
    }
  }

  async function handleBusinessTypeCreate() {
    setError("");
    setMessage("");
    setBusinessTypeCreating(true);

    try {
      const businessTypeName = getNextBusinessTypeName(businessTypeOptions);
      const data = await createPlatformBusinessType({
        label: businessTypeName,
        helper: "Configure this business type before using it for new customer workspaces.",
        posMode: "RETAIL_CHECKOUT",
        defaultTableCount: null,
        defaultModuleKeys: ["POS", "INVENTORY", "REPORTS"],
        roles: [{ name: "Cashier", description: "Run checkout and receive payments." }],
        active: true
      });

      setSetupCatalog((current) => ({
        ...current,
        businessTypes: data.catalog?.businessTypes?.length ? data.catalog.businessTypes : [...current.businessTypes, data.businessType]
      }));
      setMessage(`${data.businessType?.label || businessTypeName} business type created.`);
      return data.businessType;
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create business type.");
      return null;
    } finally {
      setBusinessTypeCreating(false);
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
      const updatedBranch = await updateSystemBusinessBranchStatus(selectedBusiness.id, branchId, status);
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

  async function handleCreateBranch(payload) {
    if (!selectedBusiness) {
      return;
    }

    setError("");
    setMessage("");
    setBranchCreating(true);

    try {
      const branch = await createSystemBusinessBranch(selectedBusiness.id, {
        name: payload.name,
        location: payload.location
      });

      setBusinesses((current) =>
        current.map((business) =>
          business.id === selectedBusiness.id
            ? {
                ...business,
                branches: [...(business.branches || []), branch]
              }
            : business
        )
      );
      setMessage(`${branch.name} branch created for ${selectedBusiness.name}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create branch.");
    } finally {
      setBranchCreating(false);
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
      const createdMembership = await createSystemBusinessUser(selectedBusiness.id, payload);
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
      setMessage(`${createdMembership.user?.name || "User"} can now access ${selectedBusiness.name}.`);
      return createdMembership;
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to create user account.");
      return null;
    } finally {
      setUserSaving(false);
    }
  }

  async function handleBusinessUserStatusChange(membership) {
    if (!selectedBusiness || !membership?.user) {
      return;
    }

    const nextStatus = membership.user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError("");
    setMessage("");
    setUserSavingId(membership.id);

    try {
      const updatedMembership = await updateSystemBusinessUserStatus(selectedBusiness.id, membership.id, nextStatus);
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
      setMessage(`${updatedMembership.user?.name || "User"} is now ${updatedMembership.user?.status?.toLowerCase() || "updated"}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to update user status.");
    } finally {
      setUserSavingId("");
    }
  }

  async function handleDeploymentManifestExport(platform = "manifest") {
    if (!selectedBusiness) {
      return;
    }

    setError("");
    setMessage("");
    setDeploymentDownloading(platform);

    try {
      const { blob, filename } = await downloadSystemBusinessDeploymentPackage(selectedBusiness.id, platform);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename || `${slugifyFileName(selectedBusiness.name)}-${platform}-setup`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`${selectedBusiness.name} ${formatDeploymentPlatform(platform)} file downloaded.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to download deployment file.");
    } finally {
      setDeploymentDownloading("");
    }
  }

  async function handleDesktopInstallerBuild(platform) {
    if (!selectedBusiness) {
      return;
    }

    setError("");
    setMessage("");
    setInstallerBuilding(platform);

    try {
      const installer = await buildSystemBusinessDesktopInstaller(selectedBusiness.id, platform);
      setMessage(
        [
          `${formatDeploymentPlatform(platform)} build requested for ${selectedBusiness.name}. Track progress in Installations.`
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (apiError) {
      setError(apiError.response?.data?.message || `Unable to build ${formatDeploymentPlatform(platform)} installer.`);
    } finally {
      setInstallerBuilding("");
    }
  }

  async function handleDesktopInstallerDownload(platform) {
    if (!selectedBusiness) {
      return;
    }

    setError("");
    setMessage("");
    setInstallerDownloading(platform);

    try {
      const { blob, filename } = await downloadSystemBusinessDesktopInstaller(selectedBusiness.id, platform);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename || `${slugifyFileName(selectedBusiness.name)}-${platform}-installer.${platform === 'windows' ? 'exe' : 'dmg'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`${formatDeploymentPlatform(platform)} installer downloaded for ${selectedBusiness.name}.`);
    } catch (apiError) {
      setError(apiError.response?.data?.message || `Build the ${formatDeploymentPlatform(platform)} installer before downloading.`);
    } finally {
      setInstallerDownloading("");
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
            System administrator access required.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-0">
      {error ? <div role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div role="status" className="rounded-md bg-zera-mint px-4 py-3 text-sm font-semibold text-zera-green">{message}</div> : null}

      {configurationSectionIds.includes(activeSection) ? (
        <SystemAdminScopeBar
          businesses={businesses}
          businessTypeOptions={businessTypeOptions}
          onSelectBusiness={selectBusiness}
          packageOptions={packageOptions}
          selectedBusiness={selectedBusiness}
        />
      ) : null}

      {loading && !businesses.length ? <p role="status" className="rounded-xl border border-zera-line bg-white p-8 text-center text-zera-muted">Loading administration…</p> : <main className="min-w-0 space-y-4">
        {activeSection === "dashboard" ? (
          <SystemControlDashboard
            businesses={businesses}
            businessTypeOptions={businessTypeOptions}
            health={platformHealth}
            onCreate={() => selectSection("create")}
            onOpenOrganizations={() => selectSection("organizations")}
            onOpenPackages={() => selectSection("packages")}
            onOpenSettings={() => selectSection("platform")}
            onSelectBusiness={selectBusiness}
            packageOptions={packageOptions}
            platformTotals={platformTotals}
            recentActivity={recentActivity}
          />
        ) : null}

        {activeSection === "create" ? (
          <CreateBusinessPanel
            form={form}
            onCancel={() => selectSection("organizations")}
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
            branchCreating={branchCreating}
            businessTypeOptions={businessTypeOptions}
            moduleSavingKey={moduleSavingKey}
            onBranchStatusChange={handleBranchStatusChange}
            onBusinessSave={handleBusinessSettingsSave}
            onCreateBranch={handleCreateBranch}
            onCreateUser={handleCreateBusinessUser}
            onBuildInstaller={handleDesktopInstallerBuild}
            onDownloadInstaller={handleDesktopInstallerDownload}
            onExportDeployment={handleDeploymentManifestExport}
            deploymentDownloading={deploymentDownloading}
            installerBuilding={installerBuilding}
            installerDownloading={installerDownloading}
            onModuleToggle={handleModuleToggle}
            onUserStatusChange={handleBusinessUserStatusChange}
            packageOptions={packageOptions}
            platformProducts={platformProducts}
            selectedBusiness={selectedBusiness}
            settingsSaving={settingsSaving}
            userSaving={userSaving}
            userSavingId={userSavingId}
          />
        ) : null}

        {activeSection === "packages" ? (
          <PackageSettingsSection
            businesses={businesses}
            onCreate={handlePackageCreate}
            onSave={handlePackageSave}
            packageCreating={packageCreating}
            packageOptions={packageOptions}
            packageSavingKey={packageSavingKey}
            platformProducts={platformProducts}
            selectedBusiness={selectedBusiness}
          />
        ) : null}

        {activeSection === "platform" ? (
          <PlatformSettingsSection
            businessTypeCreating={businessTypeCreating}
            businessTypeSavingKey={businessTypeSavingKey}
            businessTypeOptions={businessTypeOptions}
            onBusinessTypeCreate={handleBusinessTypeCreate}
            onBusinessTypeSave={handleBusinessTypeSave}
            packageOptions={packageOptions}
            platformProducts={platformProducts}
            selectedBusiness={selectedBusiness}
          />
        ) : null}
      </main>}
    </div>
  );
}

function SystemAdminScopeBar({
  businesses,
  businessTypeOptions,
  onSelectBusiness,
  packageOptions,
  selectedBusiness,
}) {
  const packageSummary = selectedBusiness ? getPackageSummary(getBusinessPackageKey(selectedBusiness), packageOptions) : null;
  const posMode = selectedBusiness ? getBusinessPosMode(selectedBusiness, businessTypeOptions) : "";

  return (
    <section className="rounded-2xl border border-zera-line bg-white px-4 py-3 shadow-[0_8px_22px_rgba(20,31,27,0.04)]">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] xl:items-center">
        <label className="block min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-zera-muted">Selected organization</span>
          <select
            className="h-10 w-full rounded-xl border border-zera-line bg-[#fbfdfb] px-3 text-sm font-bold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
            value={selectedBusiness?.id || ""}
            onChange={(event) => onSelectBusiness(event.target.value)}
          >
            {businesses.length ? null : <option value="">No organization yet</option>}
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid min-w-0 gap-2 text-sm md:grid-cols-4">
          <ScopeFact label="Type" value={selectedBusiness?.type || "No organization"} />
          <ScopeFact label="Package" value={packageSummary?.name || "No package"} />
          <ScopeFact label="Plan status" value={getPackageStatusLabel(selectedBusiness?.packageStatus)} />
          <ScopeFact label="Workflow" value={posMode ? formatPosLabel(posMode) : "Not set"} />
        </div>
      </div>
    </section>
  );
}

function ScopeFact({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-zera-line bg-[#f7faf8] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zera-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-zera-ink">{value}</p>
    </div>
  );
}

function SystemControlDashboard({
  businesses,
  businessTypeOptions,
  health,
  onCreate,
  onOpenOrganizations,
  onOpenPackages,
  onOpenSettings,
  onSelectBusiness,
  packageOptions,
  platformTotals,
  recentActivity,
}) {
  const activePackages = packageOptions.filter((packageItem) => packageItem.active !== false).length;
  const setupScore = platformTotals.businesses ? Math.round((health.readyToOperate / platformTotals.businesses) * 100) : 0;
  const dashboardMetrics = [
    {
      label: "Organizations",
      value: platformTotals.businesses,
      helper: `${platformTotals.activeBusinesses} active workspaces`,
      icon: Building2
    },
    {
      label: "Users",
      value: platformTotals.users,
      helper: `${platformTotals.activeUsers} active accounts`,
      icon: Users
    },
    {
      label: "Packages",
      value: packageOptions.length,
      helper: `${activePackages} available for setup`,
      icon: CreditCard
    },
    {
      label: "Readiness",
      value: `${setupScore}%`,
      helper: `${health.readyToOperate}/${platformTotals.businesses || 0} ready to operate`,
      icon: Activity
    }
  ];

  const dashboardActions = [
    {
      label: "Configure organizations",
      helper: "",
      action: onOpenOrganizations,
      icon: Building2
    },
    {
      label: "Review packages",
      helper: "",
      action: onOpenPackages,
      icon: CreditCard
    },
    {
      label: "Platform settings",
      helper: "",
      action: onOpenSettings,
      icon: SlidersHorizontal
    }
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">Overview</h2><Button onClick={onCreate}><Plus size={16}/>New organization</Button></div>
      <section className="overflow-hidden rounded-2xl border border-zera-line bg-white shadow-[0_10px_26px_rgba(20,31,27,0.045)]">
        <div className="grid divide-y divide-zera-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <SystemDashboardMetric key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <div className={`grid items-start gap-3 ${health.attention.length ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]" : ""}`}>
        <SystemOrganizationsOverview
          businesses={businesses}
          businessTypeOptions={businessTypeOptions}
          onOpenOrganizations={onOpenOrganizations}
          onSelectBusiness={onSelectBusiness}
        />
        {health.attention.length > 0 && <SystemAttentionPanel health={health} onOpenOrganizations={onOpenOrganizations} onSelectBusiness={onSelectBusiness} />}
      </div>

      <details className="rounded-xl border border-zera-line bg-white p-4"><summary className="cursor-pointer font-semibold">Recent activity</summary><div className="mt-3"><SystemActivityPanel activity={recentActivity} /></div></details>
    </section>
  );
}

function SystemDashboardMetric({ helper, icon: Icon, label, value }) {
  return (
    <div className="flex min-h-[92px] items-center gap-3 px-4 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef7f1] text-zera-green">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zera-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-bold leading-none text-zera-ink">{value}</p>
        <p className="mt-1 truncate text-xs text-zera-muted">{helper}</p>
      </div>
    </div>
  );
}

function SystemActivityPanel({ activity = [] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zera-line bg-white shadow-[0_10px_26px_rgba(20,31,27,0.045)]">
      <div className="divide-y divide-zera-line">
        {activity.length ? (
          activity.slice(0, 4).map((item) => (
            <div key={`${item.label}-${item.date}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-bold text-zera-ink">{item.label}</p>
                <p className="mt-0.5 truncate text-xs text-zera-muted">{item.description}</p>
              </div>
              <span className="text-right text-xs font-bold uppercase tracking-[0.08em] text-zera-muted">{formatShortDate(item.date)}</span>
            </div>
          ))
        ) : (
          <p className="px-4 py-5 text-sm text-zera-muted">No activity yet.</p>
        )}
      </div>
    </section>
  );
}

function SystemOrganizationsOverview({ businesses, businessTypeOptions, onOpenOrganizations, onSelectBusiness }) {
  const pageSize = 5;
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const matches = businesses.filter((business) => {
    const owner = getOwner(business);
    const matchesQuery = [business.name, business.type, owner?.user?.name, owner?.user?.email]
      .filter(Boolean).some((value) => value.toLowerCase().includes(query.trim().toLowerCase()));
    return matchesQuery && (status === "ALL" || (status === "ACTIVE" ? business.status === "ACTIVE" : business.status !== "ACTIVE"));
  });
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const visibleBusinesses = matches.slice(startIndex, startIndex + pageSize);
  const showPagination = matches.length > pageSize;

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  return (
    <section className="overflow-hidden rounded-2xl border border-zera-line bg-white shadow-[0_10px_26px_rgba(20,31,27,0.045)]">
      <div className="flex items-start justify-between gap-3 border-b border-zera-line px-4 py-3">
        <SectionTitle icon={Building2} title="Organizations" />
        <button
          type="button"
          className="h-9 shrink-0 rounded-xl border border-zera-line bg-white px-3 text-sm font-bold text-zera-ink transition hover:border-zera-green hover:text-zera-green"
          onClick={onOpenOrganizations}
        >
          Manage
        </button>
      </div>

      <div className="flex flex-wrap gap-3 border-b border-zera-line px-4 py-3">
        <input aria-label="Search organizations" placeholder="Search organizations or owners" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-lg border border-zera-line px-3 py-2 text-sm" />
        <select aria-label="Organization status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-zera-line bg-white px-3 py-2 text-sm">
          <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
        </select>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-zera-line bg-[#f7faf8] text-[10px] font-bold uppercase tracking-[0.12em] text-zera-muted">
            <tr>
              <th className="px-4 py-2.5">Organization</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Package</th>
              <th className="px-3 py-2.5">Setup</th>
              <th className="px-4 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {matches.length ? (
              visibleBusinesses.map((business) => {
                const owner = getOwner(business);
                const setup = getBusinessSetupSummary(business);
                const posMode = getBusinessPosMode(business, businessTypeOptions);

                return (
                  <tr key={business.id} className="transition hover:bg-[#f7faf8]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="max-w-[280px] text-left"
                        onClick={() => {
                          onSelectBusiness(business.id);
                          onOpenOrganizations();
                        }}
                      >
                        <span className="block truncate font-bold text-zera-ink">{business.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-zera-muted">{owner?.user?.email || "Owner not assigned"}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <p className="max-w-[180px] truncate font-semibold text-zera-ink">{business.type || "Not set"}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-xs font-semibold text-zera-green">{formatPosLabel(posMode, business.type)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-zera-ink">{business.platformPackage?.name || "Starter"}</p>
                      <p className="mt-0.5 text-xs text-zera-muted">{getPackageStatusLabel(business.packageStatus)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded-md bg-[#f7faf8] px-2 py-1 font-semibold text-zera-ink">{setup.activeBranches}/{setup.totalBranches} branches</span>
                        <span className="rounded-md bg-[#f7faf8] px-2 py-1 font-semibold text-zera-ink">{setup.activeUsers}/{setup.totalUsers} users</span>
                        <span className="rounded-md bg-[#f7faf8] px-2 py-1 font-semibold text-zera-ink">{setup.activeModules}/{setup.totalModules} modules</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusPill active={business.status === "ACTIVE"} label={business.status === "ACTIVE" ? "Active" : "Inactive"} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zera-muted">
                  {businesses.length ? "No organizations match your filters." : "No organizations yet. Create one to get started."}
                  {(query || status !== "ALL") && <button type="button" className="ml-2 font-semibold text-zera-green" onClick={() => { setQuery(""); setStatus("ALL"); setPage(1); }}>Clear filters</button>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showPagination ? (
        <div className="flex items-center justify-between gap-3 border-t border-zera-line bg-[#fbfdfb] px-4 py-2.5 text-sm">
          <p className="text-xs font-semibold text-zera-muted">
            {startIndex + 1}-{Math.min(startIndex + pageSize, matches.length)} of {matches.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zera-line bg-white text-zera-muted transition hover:border-zera-green hover:text-zera-green disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous organizations"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-12 text-center text-xs font-bold text-zera-ink">
              {page}/{pageCount}
            </span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zera-line bg-white text-zera-muted transition hover:border-zera-green hover:text-zera-green disabled:cursor-not-allowed disabled:opacity-45"
              disabled={page === pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              aria-label="Next organizations"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SystemAttentionPanel({ health, onOpenOrganizations, onSelectBusiness }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zera-line bg-white shadow-[0_10px_26px_rgba(20,31,27,0.045)]">
      <div className="flex items-start justify-between gap-3 border-b border-zera-line px-4 py-4">
        <SectionTitle icon={AlertTriangle} title="Needs attention" />
        {health.attention.length ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{health.attention.length}</span>
        ) : null}
      </div>

      {health.attention.length ? (
        <div className="divide-y divide-zera-line">
          {health.attention.slice(0, 5).map((item) => (
            <button
              key={`${item.businessId}-${item.label}`}
              type="button"
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f7faf8]"
              onClick={() => { onSelectBusiness?.(item.businessId); onOpenOrganizations(); }}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-zera-ink">{item.businessName}</span>
                <span className={`mt-0.5 block text-xs font-semibold ${item.severity === "critical" ? "text-red-700" : "text-amber-700"}`}>
                  {item.label}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-zera-muted" />
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6">
          <p className="rounded-xl border border-dashed border-zera-line bg-[#fbfdfb] px-4 py-5 text-sm text-zera-muted">
            No setup issues found.
          </p>
        </div>
      )}
    </section>
  );
}

function PackageSettingsSection({ businesses, onCreate, onSave, packageCreating, packageOptions, packageSavingKey, platformProducts, selectedBusiness }) {
  const [selectedPackageKey, setSelectedPackageKey] = useState(packageOptions[0]?.key || "STARTER");
  const selectedPackage = packageOptions.find((packageItem) => packageItem.key === selectedPackageKey) || packageOptions[0];
  const selectedBusinessPackageKey = selectedBusiness ? getBusinessPackageKey(selectedBusiness) : "";
  const selectedBusinessPackage = selectedBusinessPackageKey ? getPackageOption(selectedBusinessPackageKey, packageOptions) : null;
  const activePackageCount = packageOptions.filter((packageItem) => packageItem.active !== false).length;
  const customPackageCount = packageOptions.filter((packageItem) => isCustomPackage(packageItem)).length;
  const assignedPackageCount = businesses.filter((business) => business.platformPackage).length;

  useEffect(() => {
    if (packageOptions.some((packageItem) => packageItem.key === selectedPackageKey)) {
      return;
    }

    setSelectedPackageKey(packageOptions[0]?.key || "");
  }, [packageOptions, selectedPackageKey]);

  useEffect(() => {
    if (!selectedBusinessPackageKey || !packageOptions.some((packageItem) => packageItem.key === selectedBusinessPackageKey)) {
      return;
    }

    setSelectedPackageKey(selectedBusinessPackageKey);
  }, [packageOptions, selectedBusinessPackageKey]);

  async function handleCreatePackage() {
    const createdPackage = await onCreate();

    if (createdPackage?.key) {
      setSelectedPackageKey(createdPackage.key);
    }
  }

  return (
    <section className="space-y-4">
      <article className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-zera-line px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mt-1 text-xl font-bold text-zera-ink">Packages</h2>

          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-md border border-zera-line bg-[#f7faf8] px-3 py-2 text-sm text-zera-muted">
              <span className="font-bold text-zera-ink">{selectedBusiness?.name || "No organization selected"}</span>
              <span className="mx-2 text-zera-muted/70">uses</span>
              <span className="font-semibold text-zera-green">{selectedBusinessPackage?.name || "No package"}</span>
            </div>
            <Button type="button" className="h-10 rounded-xl px-3.5" onClick={handleCreatePackage} disabled={packageCreating}>
              <Plus className="h-4 w-4" />
              {packageCreating ? "Creating..." : "Create custom package"}
            </Button>
          </div>
        </div>

        <div className="grid divide-y divide-zera-line md:grid-cols-4 md:divide-x md:divide-y-0">
          <PackageMetric label="Total packages" value={packageOptions.length} />
          <PackageMetric label="Active packages" value={activePackageCount} />
          <PackageMetric label="Custom packages" value={customPackageCount} />
          <PackageMetric label="Assigned organizations" value={assignedPackageCount} />
        </div>
      </article>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="overflow-hidden rounded-xl border border-zera-line bg-white shadow-card">
          <div className="border-b border-zera-line bg-[#fbfdfb] px-4 py-3">
            <SectionTitle icon={CreditCard} title="Package directory" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Package</th>
                  <th className="px-4 py-3 font-bold">Price</th>
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
                        <button type="button" aria-pressed={selectedPackage?.key === packageItem.key} className="rounded text-left font-bold text-zera-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-zera-green" onClick={(event) => { event.stopPropagation(); setSelectedPackageKey(packageItem.key); }}>{packageItem.name}</button>
                        <p className="mt-1 max-w-[320px] truncate text-xs text-zera-muted">{packageItem.description}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-zera-ink">{formatPackagePrice(packageItem)}</td>
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

function PackageMetric({ label, value }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-bold uppercase text-zera-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zera-ink">{Number(value || 0).toLocaleString()}</p>
    </div>
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
          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusPill label={isCustomPackage(packageItem) ? "custom" : "standard"} muted={false} />
            <StatusPill label={form.active ? "active" : "inactive"} muted={!form.active} />
          </div>
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

        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Price" type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
          <Input label="Currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zera-ink">Billing</span>
            <select
              className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink outline-none transition hover:border-zera-lineStrong focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
              value={form.billingCycle}
              onChange={(event) => setForm({ ...form, billingCycle: event.target.value })}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
              <option value="ONE_TIME">One time</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <PackageNumberField label="Branches" value={form.maxBranches} onChange={(value) => setForm({ ...form, maxBranches: value })} />
          <PackageNumberField label="Users" value={form.maxUsers} onChange={(value) => setForm({ ...form, maxUsers: value })} />
          <PackageNumberField label="Products" value={form.maxProducts} onChange={(value) => setForm({ ...form, maxProducts: value })} />
        </div>
        <p className="-mt-2 text-xs leading-5 text-zera-muted">Leave a limit empty for a negotiated custom limit.</p>

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
            <span className="block text-xs text-zera-muted">Inactive packages can be edited here but cannot be assigned to an organization.</span>
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

function PlatformSettingsSection({
  businessTypeCreating,
  businessTypeSavingKey,
  businessTypeOptions,
  onBusinessTypeCreate,
  onBusinessTypeSave,
  packageOptions,
  platformProducts,
  selectedBusiness
}) {
  const selectedType = selectedBusiness ? getBusinessTypeOption(selectedBusiness.type, businessTypeOptions) : null;
  const [activeSettingsTab, setActiveSettingsTab] = useState("business-types");
  const [selectedBusinessTypeKey, setSelectedBusinessTypeKey] = useState(selectedType?.key || businessTypeOptions[0]?.key || "");
  const selectedBusinessType = businessTypeOptions.find((type) => type.key === selectedBusinessTypeKey) || selectedType || businessTypeOptions[0];

  useEffect(() => {
    if (!businessTypeOptions.some((type) => type.key === selectedBusinessTypeKey)) {
      setSelectedBusinessTypeKey(businessTypeOptions[0]?.key || "");
    }
  }, [businessTypeOptions, selectedBusinessTypeKey]);

  useEffect(() => {
    if (selectedType?.key) setSelectedBusinessTypeKey(selectedType.key);
  }, [selectedType?.key]);

  const tabs = [
    {
      id: "business-types",
      label: "Business types",
      icon: Building2,
      description: "Onboarding templates, POS workflow, default roles, and default modules."
    },
    {
      id: "modules",
      label: "Modules",
      icon: Boxes,
      description: "The product capabilities that packages and organizations can enable."
    },
    {
      id: "rules",
      label: "Rules",
      icon: ShieldCheck,
      description: "The setup order admins should follow when configuring a workspace."
    }
  ];
  const activeTab = tabs.find((tab) => tab.id === activeSettingsTab) || tabs[0];

  async function handleCreateBusinessType() {
    setActiveSettingsTab("business-types");
    const createdBusinessType = await onBusinessTypeCreate();

    if (createdBusinessType?.key) {
      setSelectedBusinessTypeKey(createdBusinessType.key);
    }
  }

  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zera-line bg-white px-4 py-3 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mt-1 text-xl font-bold text-zera-ink">Platform settings</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zera-muted">
              Defaults for new organizations.
            </p>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-zera-line bg-[#f7faf8] text-center text-sm">
            <div className="px-3 py-2">
              <span className="block font-bold text-zera-ink">{businessTypeOptions.length}</span>
              <span className="text-xs font-semibold text-zera-muted">Types</span>
            </div>
            <div className="border-x border-zera-line px-3 py-2">
              <span className="block font-bold text-zera-ink">{platformProducts.length}</span>
              <span className="text-xs font-semibold text-zera-muted">Modules</span>
            </div>
            <div className="px-3 py-2">
              <span className="block font-bold text-zera-ink">{packageOptions.length}</span>
              <span className="text-xs font-semibold text-zera-muted">Packages</span>
            </div>
          </div>
        </div>
      </article>

      <div className="grid overflow-hidden rounded-xl border border-zera-line bg-white shadow-card lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-zera-line bg-[#fbfdfb] lg:border-b-0 lg:border-r">
          <nav className="space-y-1 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
                  activeSettingsTab === tab.id ? "bg-zera-green text-white shadow-sm" : "text-zera-muted hover:bg-white hover:text-zera-ink"
                }`}
                onClick={() => setActiveSettingsTab(tab.id)}
              >
                <tab.icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <span className="block text-sm font-bold">{tab.label}</span>

                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-zera-line bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-zera-green">{activeTab.label}</p>

            </div>
            {activeSettingsTab === "business-types" ? (
              <Button type="button" className="h-9 rounded-xl px-3" onClick={handleCreateBusinessType} disabled={businessTypeCreating}>
                <Plus className="h-4 w-4" />
                {businessTypeCreating ? "Creating..." : "New business type"}
              </Button>
            ) : null}
          </div>

          {activeSettingsTab === "business-types" ? (
            <BusinessTypeSettingsPanel
              businessTypeOptions={businessTypeOptions}
              businessTypeSavingKey={businessTypeSavingKey}
              onSave={onBusinessTypeSave}
              platformProducts={platformProducts}
              selectedBusinessType={selectedBusinessType}
              selectedBusinessTypeKey={selectedBusinessTypeKey}
              onSelectBusinessType={setSelectedBusinessTypeKey}
            />
          ) : null}

          {activeSettingsTab === "modules" ? <ModuleCatalogPanel packageOptions={packageOptions} platformProducts={platformProducts} selectedBusiness={selectedBusiness} /> : null}

          {activeSettingsTab === "rules" ? (
            <PlatformRulesPanel
              businessTypeOptions={businessTypeOptions}
              packageOptions={packageOptions}
              platformProducts={platformProducts}
              selectedBusiness={selectedBusiness}
            />
          ) : null}
        </section>
      </div>
    </section>
  );
}

function BusinessTypeSettingsPanel({
  businessTypeOptions,
  businessTypeSavingKey,
  onSave,
  onSelectBusinessType,
  platformProducts,
  selectedBusinessType,
  selectedBusinessTypeKey
}) {
  return (
    <div className="grid min-h-[520px] gap-0 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="overflow-x-auto border-b border-zera-line xl:border-b-0 xl:border-r">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
            <tr>
              <th className="px-4 py-3 font-bold">Business type</th>
              <th className="px-4 py-3 font-bold">Workflow</th>
              <th className="px-4 py-3 font-bold">Default roles</th>
              <th className="px-4 py-3 font-bold">Default modules</th>
              <th className="px-4 py-3 text-right font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {businessTypeOptions.map((type) => (
              <tr
                key={type.key || type.value}
                className={`cursor-pointer transition hover:bg-[#f7faf8] ${selectedBusinessTypeKey === type.key ? "bg-zera-mint/70" : "bg-white"}`}
                onClick={() => onSelectBusinessType(type.key)}
              >
                <td className="px-4 py-3">
                  <button type="button" aria-pressed={selectedBusinessTypeKey === type.key} className="rounded text-left font-bold text-zera-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-zera-green" onClick={(event) => { event.stopPropagation(); onSelectBusinessType(type.key); }}>{type.label}</button>
                </td>
                <td className="px-4 py-3 font-semibold text-zera-green">{formatPOSMode(type.posMode, type.value)}</td>
                <td className="px-4 py-3 text-zera-muted">{[...new Set(["Owner", "Manager", ...(type.roles || []).map((role) => role.name)])].join(", ")}</td>
                <td className="px-4 py-3 text-zera-muted">{(type.defaultModuleKeys || ["POS"]).join(", ")}</td>
                <td className="px-4 py-3 text-right">
                  <StatusPill label={type.active === false ? "inactive" : "active"} muted={type.active === false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedBusinessType ? (
        <BusinessTypeEditor
          businessType={selectedBusinessType}
          onSave={onSave}
          platformProducts={platformProducts}
          saving={businessTypeSavingKey === selectedBusinessType.key}
        />
      ) : (
        <div className="p-4">
          <EmptyState text="Select a business type to configure its onboarding defaults." />
        </div>
      )}
    </div>
  );
}

function BusinessTypeEditor({ businessType, onSave, platformProducts, saving }) {
  const [form, setForm] = useState(() => getBusinessTypeForm(businessType));

  useEffect(() => {
    setForm(getBusinessTypeForm(businessType));
  }, [
    businessType.id,
    businessType.key,
    businessType.label,
    businessType.helper,
    businessType.posMode,
    businessType.defaultTableCount,
    businessType.active,
    businessType.defaultModuleKeys?.join("|"),
    (businessType.roles || []).map((role) => `${role.name}:${role.description}`).join("|")
  ]);

  function toggleDefaultModule(moduleKey) {
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

  function handleSubmit(event) {
    event.preventDefault();
    const roles = form.rolesText
      .split("\n")
      .map((line) => {
        const [name, ...descriptionParts] = line.split("-");
        return {
          name: name.trim(),
          description: descriptionParts.join("-").trim()
        };
      })
      .filter((role) => role.name);

    onSave(businessType, {
      ...form,
      defaultTableCount: form.defaultTableCount === "" ? null : Number(form.defaultTableCount),
      roles
    });
  }

  return (
    <form className="flex min-h-full flex-col bg-white" onSubmit={handleSubmit}>
      <div className="border-b border-zera-line bg-[#fbfdfb] p-4">
        <p className="text-xs font-bold uppercase text-zera-muted">{businessType.key}</p>
        <h3 className="mt-1 text-xl font-bold text-zera-ink">Configure business type</h3>
      </div>

      <div className="flex-1 space-y-4 p-4">
        <Input label="Display name" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required />

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zera-ink">Admin guidance</span>
          <textarea
            className="min-h-20 w-full resize-none rounded-md border border-zera-line bg-white px-3 py-2 text-sm leading-6 text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
            value={form.helper}
            onChange={(event) => setForm({ ...form, helper: event.target.value })}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zera-ink">POS workflow</span>
            <select
              className="min-h-10 w-full rounded-md border border-zera-line bg-white px-3 text-sm font-semibold text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
              value={form.posMode}
              onChange={(event) => setForm({ ...form, posMode: event.target.value })}
            >
              <option value="RETAIL_CHECKOUT">Checkout POS</option>
              <option value="TABLE_SERVICE">Table-service POS</option>
            </select>
          </label>
          <Input
            label="Default tables"
            min="0"
            type="number"
            value={form.defaultTableCount}
            onChange={(event) => setForm({ ...form, defaultTableCount: event.target.value })}
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-zera-ink">Default modules</p>
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
                  onClick={() => toggleDefaultModule(product.key)}
                >
                  <span>{product.title}</span>
                  <span className={`h-3 w-3 rounded-full ${active ? "bg-zera-green" : "bg-zera-line"}`} />
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zera-ink">Default staff roles</span>
          <textarea
            className="min-h-24 w-full resize-none rounded-md border border-zera-line bg-white px-3 py-2 text-sm leading-6 text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
            value={form.rolesText}
            onChange={(event) => setForm({ ...form, rolesText: event.target.value })}
            placeholder="Role name - Role responsibility"
          />
          <p className="mt-1 text-xs text-zera-muted">One role per line. Owner and Manager are always included by Zera.</p>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-md border border-zera-line bg-[#f7faf8] px-3 py-2">
          <span>
            <span className="block text-sm font-semibold text-zera-ink">Available for new organizations</span>
            <span className="block text-xs text-zera-muted">Inactive types are hidden during onboarding.</span>
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
          {saving ? "Saving setup..." : "Save business type"}
        </Button>
      </div>
    </form>
  );
}

function ModuleCatalogPanel({ packageOptions, platformProducts, selectedBusiness }) {
  const selectedModuleKeys = new Set((selectedBusiness?.modules || []).filter((module) => module.active).map((module) => module.key));

  return (
    <section className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
        <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
          <tr>
            <th className="px-4 py-3 font-bold">Module</th>
            <th className="px-4 py-3 font-bold">Purpose</th>
            <th className="px-4 py-3 font-bold">Used in packages</th>
            <th className="px-4 py-3 text-right font-bold">Selected org</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zera-line">
          {platformProducts.map((product) => {
            const includedPackages = packageOptions.filter((packageItem) => packageItem.defaultModuleKeys?.includes(product.key));

            return (
              <tr key={product.key} className="hover:bg-[#f7faf8]">
                <td className="px-4 py-3">
                  <p className="font-bold text-zera-ink">{product.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase text-zera-muted">{product.key}</p>
                </td>
                <td className="max-w-[460px] px-4 py-3 text-zera-muted">{product.summary || product.detail}</td>
                <td className="px-4 py-3 text-zera-muted">{includedPackages.map((packageItem) => packageItem.name).join(", ") || "No package"}</td>
                <td className="px-4 py-3 text-right">
                  <StatusPill label={selectedModuleKeys.has(product.key) ? "enabled" : "disabled"} muted={!selectedModuleKeys.has(product.key)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function PlatformRulesPanel({ businessTypeOptions, packageOptions, platformProducts, selectedBusiness }) {
  const selectedType = selectedBusiness ? getBusinessTypeOption(selectedBusiness.type, businessTypeOptions) : null;
  const selectedPackage = selectedBusiness ? getPackageOption(getBusinessPackageKey(selectedBusiness), packageOptions) : null;
  const rules = [
    {
      label: "Business type",
      value: selectedType?.label || "No organization selected",
      helper: "Sets the default POS workflow, onboarding guidance, table count, and staff role template."
    },
    {
      label: "Package",
      value: selectedPackage?.name || "No package selected",
      helper: "Controls plan limits and the module set that can be activated for the organization."
    },
    {
      label: "Organization configuration",
      value: selectedBusiness?.name || "No organization selected",
      helper: "Final workspace settings live in the Organizations tab: profile, modules, branches, and users."
    }
  ];

  return (
    <section className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-xl border border-zera-line">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[#f7faf8] text-xs uppercase text-zera-muted">
            <tr>
              <th className="px-4 py-3 font-bold">Rule</th>
              <th className="px-4 py-3 font-bold">Current context</th>
              <th className="px-4 py-3 font-bold">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zera-line">
            {rules.map((rule) => (
              <tr key={rule.label} className="hover:bg-[#f7faf8]">
                <td className="px-4 py-3 font-bold text-zera-ink">{rule.label}</td>
                <td className="px-4 py-3 font-semibold text-zera-green">{rule.value}</td>
                <td className="px-4 py-3 text-zera-muted">{rule.helper}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="rounded-xl border border-zera-line bg-[#fbfdfb] p-4">
        <SectionTitle icon={ShieldCheck} title="Setup order" />
        <ol className="mt-4 space-y-3 text-sm">
          {["Choose the organization", "Confirm business type", "Assign package", "Enable modules", "Create branches and users"].map((item, index) => (
            <li key={item} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zera-green text-xs font-bold text-white">{index + 1}</span>
              <span className="pt-0.5 font-semibold text-zera-ink">{item}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-md border border-zera-line bg-white p-3 text-sm text-zera-muted">
          {platformProducts.length} modules and {packageOptions.length} packages are available for workspace setup.
        </div>
      </aside>
    </section>
  );
}

function SettingsSection({
  branchSavingId,
  branchCreating,
  businessTypeOptions,
  deploymentDownloading,
  installerBuilding,
  installerDownloading,
  selectedBusiness,
  moduleSavingKey,
  onBranchStatusChange,
  onBusinessSave,
  onBuildInstaller,
  onCreateBranch,
  onCreateUser,
  onDownloadInstaller,
  onExportDeployment,
  onModuleToggle,
  onUserStatusChange,
  packageOptions,
  platformProducts,
  settingsSaving,
  userSaving,
  userSavingId,
}) {
  return (
    <section className="min-w-0">
      <BusinessWorkspace
        business={selectedBusiness}
        branchSavingId={branchSavingId}
        branchCreating={branchCreating}
        businessTypeOptions={businessTypeOptions}
        deploymentDownloading={deploymentDownloading}
        installerBuilding={installerBuilding}
        installerDownloading={installerDownloading}
        moduleSavingKey={moduleSavingKey}
        onBranchStatusChange={onBranchStatusChange}
        onBusinessSave={onBusinessSave}
        onBuildInstaller={onBuildInstaller}
        onCreateBranch={onCreateBranch}
        onCreateUser={onCreateUser}
        onDownloadInstaller={onDownloadInstaller}
        onExportDeployment={onExportDeployment}
        onModuleToggle={onModuleToggle}
        onUserStatusChange={onUserStatusChange}
        packageOptions={packageOptions}
        platformProducts={platformProducts}
        settingsSaving={settingsSaving}
        userSaving={userSaving}
        userSavingId={userSavingId}
      />
    </section>
  );
}

function BusinessWorkspace({
  business,
  branchSavingId,
  branchCreating,
  businessTypeOptions,
  deploymentDownloading,
  installerBuilding,
  installerDownloading,
  moduleSavingKey,
  onBranchStatusChange,
  onBusinessSave,
  onBuildInstaller,
  onCreateBranch,
  onCreateUser,
  onDownloadInstaller,
  onExportDeployment,
  onModuleToggle,
  onUserStatusChange,
  packageOptions,
  platformProducts,
  settingsSaving,
  userSaving,
  userSavingId,
}) {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("setup");

  useEffect(() => {
    setActiveWorkspaceTab("setup");
  }, [business?.id]);

  if (!business) {
    return (
      <section className="rounded-2xl border border-dashed border-zera-line bg-white p-6 text-center text-zera-muted">
        Select an organization to configure its business type, modules, branches, and access.
      </section>
    );
  }

  const summary = getBusinessSetupSummary(business);
  const owner = getOwner(business);
  const posMode = getBusinessPosMode(business, businessTypeOptions);
  const packageSummary = getPackageSummary(getBusinessPackageKey(business), packageOptions);
  const products = business?._count?.products || 0;
  const workspaceTabs = [
    {
      id: "identity",
      label: "Profile",
      helper: "Identity, package, status, branding, receipts, and tax.",
      complete: Boolean(business.name && business.type && business.platformPackage && business.currency)
    },
    {
      id: "modules",
      label: "Modules",
      helper: "Choose which Zera products this customer can use.",
      complete: summary.activeModules > 0
    },
    {
      id: "branches",
      label: "Branches",
      helper: "Set up operating locations and branch status.",
      complete: summary.activeBranches > 0
    },
    {
      id: "access",
      label: "Team",
      helper: "Create staff accounts and control access.",
      complete: summary.activeUsers > 0
    },
    {
      id: "deployment",
      label: "Installation",
      helper: "Build the configured Mac or Windows installer for this customer.",
      complete: getBusinessDeploymentReadiness(business).ready
    },
  ];
  const setupProgress = Math.round((workspaceTabs.filter((tab) => tab.complete).length / workspaceTabs.length) * 100);

  return (
    <section className="overflow-hidden rounded-2xl border border-zera-line bg-white shadow-[0_10px_26px_rgba(20,31,27,0.045)]">
      <div className="border-b border-zera-line px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold text-zera-ink">{business.name}</h2>
              <StatusPill active={business.status === "ACTIVE"} label={business.status === "ACTIVE" ? "Active" : "Inactive"} />
            </div>
            <p className="mt-1 text-sm text-zera-muted">
              {business.type || "Business"} / {formatPosLabel(posMode)} / {packageSummary?.name || "No package"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid min-w-0 grid-cols-4 overflow-hidden rounded-xl border border-zera-line bg-[#f7faf8] text-center text-sm">
              <span className="px-3 py-2"><strong className="block text-zera-ink">{summary.activeBranches}/{summary.totalBranches}</strong><span className="text-xs text-zera-muted">Branches</span></span>
              <span className="border-x border-zera-line px-3 py-2"><strong className="block text-zera-ink">{summary.activeUsers}/{summary.totalUsers}</strong><span className="text-xs text-zera-muted">Users</span></span>
              <span className="border-r border-zera-line px-3 py-2"><strong className="block text-zera-ink">{summary.activeModules}/{summary.totalModules}</strong><span className="text-xs text-zera-muted">Modules</span></span>
              <span className="px-3 py-2"><strong className="block text-zera-ink">{products}</strong><span className="text-xs text-zera-muted">Products</span></span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
          <div className="rounded-xl border border-zera-line bg-[#fbfdfb] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-zera-muted">Configuration</span>
              <span className="text-sm font-bold text-zera-ink">{setupProgress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zera-mint">
              <div className="h-full rounded-full bg-zera-green" style={{ width: `${setupProgress}%` }} />
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#f3f6f4] p-1">
            <button
              type="button"
              onClick={() => setActiveWorkspaceTab("setup")}
              className={`h-9 shrink-0 rounded-lg px-3.5 text-sm font-bold transition ${
                activeWorkspaceTab === "setup" ? "bg-white text-zera-ink shadow-[0_8px_18px_rgba(20,31,27,0.08)]" : "text-zera-muted hover:text-zera-ink"
              }`}
            >
              Setup
            </button>
            {workspaceTabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveWorkspaceTab(tab.id)}
                className={`h-9 shrink-0 rounded-lg px-3.5 text-sm font-bold transition ${
                  activeWorkspaceTab === tab.id
                    ? "bg-white text-zera-ink shadow-[0_8px_18px_rgba(20,31,27,0.08)]"
                    : "text-zera-muted hover:text-zera-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4">
        {activeWorkspaceTab === "setup" ? (
          <WorkspaceSetupOverview
            business={business}
            onOpenStep={setActiveWorkspaceTab}
            owner={owner}
            packageSummary={packageSummary}
            setupProgress={setupProgress}
            steps={workspaceTabs}
            summary={summary}
          />
        ) : null}
        {activeWorkspaceTab === "identity" ? (
          <BusinessSettingsCard
            business={business}
            businessTypeOptions={businessTypeOptions}
            onSave={onBusinessSave}
            packageOptions={packageOptions}
            saving={settingsSaving}
          />
        ) : null}
        {activeWorkspaceTab === "modules" ? (
          <ModulesCard
            business={business}
            moduleSavingKey={moduleSavingKey}
            onModuleToggle={onModuleToggle}
            platformProducts={platformProducts}
          />
        ) : null}
        {activeWorkspaceTab === "branches" ? (
          <BranchesCard
            branchCreating={branchCreating}
            branchSavingId={branchSavingId}
            business={business}
            onBranchCreate={onCreateBranch}
            onBranchStatusChange={onBranchStatusChange}
          />
        ) : null}
        {activeWorkspaceTab === "access" ? (
          <TeamCard
            business={business}
            businessTypeOptions={businessTypeOptions}
            onCreateUser={onCreateUser}
            onUserStatusChange={onUserStatusChange}
            owner={owner}
            userSaving={userSaving}
            userSavingId={userSavingId}
          />
        ) : null}
        {activeWorkspaceTab === "deployment" ? (
          <DeploymentPackagePanel
            business={business}
            deploymentDownloading={deploymentDownloading}
            installerBuilding={installerBuilding}
            installerDownloading={installerDownloading}
            onBuildInstaller={onBuildInstaller}
            onDownload={onExportDeployment}
            onDownloadInstaller={onDownloadInstaller}
            packageSummary={packageSummary}
            summary={summary}
          />
        ) : null}
      </div>
    </section>
  );
}

function WorkspaceSetupOverview({ onOpenStep, steps }) {
  const nextStep = steps.find(step => !step.complete);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-bold">Setup checklist</h3>
      <Button onClick={() => onOpenStep(nextStep?.id || "deployment")}>{nextStep ? "Continue setup" : "Open installation"}<ChevronRight size={16} /></Button>
    </div>
    <div className="divide-y divide-zera-line overflow-hidden rounded-xl border border-zera-line">
      {steps.map((step, index) => <button type="button" key={step.id} onClick={() => onOpenStep(step.id)} className="flex w-full items-center gap-3 bg-white p-4 text-left hover:bg-zera-mintSoft focus-visible:outline-zera-green">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zera-mintSoft text-sm font-bold text-zera-green">{index+1}</span>
        <span className="flex-1 font-semibold">{step.label}</span>
        <StatusPill active={step.complete} label={step.id === "deployment" ? (step.complete ? "Configured" : "Review") : step.complete ? "Done" : "Set up"} />
        <ChevronRight size={16} />
      </button>)}
    </div>
  </section>;
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
          <h2 className="text-2xl font-bold">New organization</h2>
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
            <SectionTitle icon={Building2} title="Organization" />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input
                label="Business name"
                placeholder="Business name"
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
            <SectionTitle icon={MapPin} title="First branch" />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Input label="Branch name" value={form.branchName} onChange={(event) => onChange({ ...form, branchName: event.target.value })} />
              <Input
                label="Branch location"
                placeholder="Branch location"
                value={form.branchLocation}
                onChange={(event) => onChange({ ...form, branchLocation: event.target.value })}
              />
            </div>
          </section>

          <section>
            <SectionTitle icon={KeyRound} title="Owner login" />
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
            <SectionTitle icon={ShieldCheck} title="Provisioning summary" />
            <dl className="mt-4 divide-y divide-zera-line rounded-md border border-zera-line bg-white text-sm">
              <SummaryRow label="POS experience" value={formatPOSMode(selectedType.posMode, selectedType.value)} />
              <SummaryRow label="Business type" value={selectedType.label} />
              <SummaryRow label="Package" value={selectedPackage.name} />
              <SummaryRow label="First branch" value={form.branchName || "Not set"} />
              <SummaryRow label="Owner email" value={form.ownerEmail || "Not set"} />
            </dl>
            <div className="mt-4 rounded-md border border-zera-line bg-white p-3">
              <p className="text-sm font-bold text-zera-ink">Operating model</p>

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
  const [logoPreparing, setLogoPreparing] = useState(false);
  const [settingsForm, setSettingsForm] = useState(() => getBusinessSettingsForm(business, businessTypeOptions));
  const [activeSettingsGroup, setActiveSettingsGroup] = useState("business");

  useEffect(() => {
    setSettingsForm(getBusinessSettingsForm(business, businessTypeOptions));
    setActiveSettingsGroup("business");
  }, [
    business?.id,
    business?.name,
    business?.type,
    business?.country,
    business?.currency,
    business?.logoUrl,
    business?.useBrandTheme,
    business?.brandPrimaryColor,
    business?.brandSecondaryColor,
    business?.contactPhone,
    business?.contactEmail,
    business?.address,
    business?.receiptHeader,
    business?.receiptFooter,
    business?.taxName,
    business?.taxRate,
    business?.taxEnabled,
    business?.status,
    business?.packageStatus,
    business?.posMode,
    business?.platformPackage?.key,
    businessTypeOptions
  ]);

  const selectedType = getBusinessTypeOption(settingsForm.type, businessTypeOptions);
  const selectedPackage = getPackageOption(settingsForm.packageKey, packageOptions);
  const packageUsage = getBusinessPackageUsage(business);
  const settingsGroups = [
    { id: "business", label: "Business setup", helper: "Type, package, country, currency, and status.", icon: Building2 },
    { id: "brand", label: "Branding", helper: "Logo, colors, phone, email, and address.", icon: Palette },
    { id: "receipt", label: "Receipt and tax", helper: "Receipt text and optional tax calculation.", icon: ReceiptText }
  ];

  function handleSubmit(event) {
    event.preventDefault();
    if (logoPreparing) return;
    onSave({
      ...settingsForm,
      posMode: selectedType.posMode
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SectionTitle icon={Settings} title="Business configuration" />
        <Button className="w-full md:w-auto" disabled={saving || logoPreparing}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <nav className="space-y-2 rounded-md border border-zera-line bg-[#f7faf8] p-2">
          {settingsGroups.map((group) => {
            const Icon = group.icon;
            const active = activeSettingsGroup === group.id;

            return (
              <button
                key={group.id}
                type="button"
                className={`grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md px-3 py-3 text-left transition ${
                  active ? "bg-white text-zera-ink shadow-[0_8px_18px_rgba(20,31,27,0.08)]" : "text-zera-muted hover:bg-white hover:text-zera-ink"
                }`}
                onClick={() => setActiveSettingsGroup(group.id)}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-md ${active ? "bg-zera-green text-white" : "bg-white text-zera-green"}`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold">{group.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-zera-muted">{group.helper}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-4">
          {activeSettingsGroup === "business" ? (
          <section className="rounded-md border border-zera-line bg-white">
          <div className="border-b border-zera-line px-4 py-3">
            <p className="font-bold text-zera-ink">Identity</p>

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
            <PackageStatusSelect value={settingsForm.packageStatus} onChange={(packageStatus) => setSettingsForm({ ...settingsForm, packageStatus })} />
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
          ) : null}

          {activeSettingsGroup === "brand" ? (
          <section className="rounded-md border border-zera-line bg-white">
          <div className="border-b border-zera-line px-4 py-3">
            <SectionTitle icon={Palette} title="Branding" />
          </div>
          <fieldset className="px-4 pt-4">
            <legend className="pt-4 text-sm font-semibold">Workspace appearance</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {[{ value: false, label: "Zera green & white" }, { value: true, label: "Organization branding" }].map((option) => (
                <label key={String(option.value)} className="flex items-center gap-2 rounded-lg border border-zera-line px-3 py-3 text-sm">
                  <input type="radio" name="useBrandTheme" checked={settingsForm.useBrandTheme === option.value} onChange={() => setSettingsForm({ ...settingsForm, useBrandTheme: option.value })} />{option.label}
                </label>
              ))}
            </div>

            <div style={brandTheme(settingsForm)} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zera-line bg-zera-mintSoft p-4" aria-label="Appearance preview">
              <div className="flex items-center gap-3">
                {settingsForm.useBrandTheme && settingsForm.logoUrl ? <img src={settingsForm.logoUrl} alt="Organization logo preview" className="h-10 w-10 rounded bg-white object-contain" /> : <Building2 className="text-zera-green" />}
                <span className="font-bold">{settingsForm.useBrandTheme ? settingsForm.name : "Zera Solutions"}</span>
              </div>
              <span className="rounded-lg bg-zera-green px-4 py-2 text-sm font-semibold text-white">Button preview</span>
            </div>
            <p className="mt-2 text-xs text-zera-muted">Light colors are adjusted for readable text.</p>
          </fieldset>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <LogoUpload key={business.id} value={settingsForm.logoUrl} disabled={saving} onBusyChange={setLogoPreparing} onChange={(logoUrl) => setSettingsForm((current) => ({ ...current, logoUrl }))} />
            <Input
              label="Contact email"
              type="email"
              value={settingsForm.contactEmail}
              onChange={(event) => setSettingsForm({ ...settingsForm, contactEmail: event.target.value })}
            />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zera-ink">Primary color</span>
              <div className="flex min-h-11 overflow-hidden rounded-md border border-zera-line bg-white focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
                <input
                  className="h-11 w-12 shrink-0 border-0 bg-transparent p-1"
                  type="color"
                  value={settingsForm.brandPrimaryColor || "#16823A"}
                  onChange={(event) => setSettingsForm({ ...settingsForm, brandPrimaryColor: event.target.value.toUpperCase() })}
                  aria-label="Primary color"
                />
                <input
                  className="min-w-0 flex-1 border-0 px-3 text-sm font-semibold uppercase outline-none"
                  value={settingsForm.brandPrimaryColor}
                  onChange={(event) => setSettingsForm({ ...settingsForm, brandPrimaryColor: event.target.value.toUpperCase() })}
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zera-ink">Secondary color</span>
              <div className="flex min-h-11 overflow-hidden rounded-md border border-zera-line bg-white focus-within:border-zera-green focus-within:ring-4 focus-within:ring-zera-green/10">
                <input
                  className="h-11 w-12 shrink-0 border-0 bg-transparent p-1"
                  type="color"
                  value={settingsForm.brandSecondaryColor || "#EEF7F1"}
                  onChange={(event) => setSettingsForm({ ...settingsForm, brandSecondaryColor: event.target.value.toUpperCase() })}
                  aria-label="Secondary color"
                />
                <input
                  className="min-w-0 flex-1 border-0 px-3 text-sm font-semibold uppercase outline-none"
                  value={settingsForm.brandSecondaryColor}
                  onChange={(event) => setSettingsForm({ ...settingsForm, brandSecondaryColor: event.target.value.toUpperCase() })}
                />
              </div>
            </label>
            <Input
              label="Phone"
              value={settingsForm.contactPhone}
              onChange={(event) => setSettingsForm({ ...settingsForm, contactPhone: event.target.value })}
            />
            <Input
              label="Address"
              value={settingsForm.address}
              onChange={(event) => setSettingsForm({ ...settingsForm, address: event.target.value })}
            />
          </div>
          </section>
          ) : null}

          {activeSettingsGroup === "receipt" ? (
          <section className="rounded-md border border-zera-line bg-white">
          <div className="border-b border-zera-line px-4 py-3">
            <SectionTitle icon={ReceiptText} title="Receipt & tax" />
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zera-ink">Receipt header</span>
              <textarea
                className="min-h-20 w-full rounded-md border border-zera-line bg-white px-3 py-2 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                placeholder="Optional short message shown below the store name."
                value={settingsForm.receiptHeader}
                onChange={(event) => setSettingsForm({ ...settingsForm, receiptHeader: event.target.value })}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-zera-ink">Receipt footer</span>
              <textarea
                className="min-h-20 w-full rounded-md border border-zera-line bg-white px-3 py-2 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                value={settingsForm.receiptFooter}
                onChange={(event) => setSettingsForm({ ...settingsForm, receiptFooter: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zera-ink">Tax collection</span>
              <select
                className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
                value={settingsForm.taxEnabled ? "enabled" : "disabled"}
                onChange={(event) => setSettingsForm({ ...settingsForm, taxEnabled: event.target.value === "enabled" })}
              >
                <option value="disabled">Do not calculate tax</option>
                <option value="enabled">Calculate tax on sales</option>
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Tax name"
                value={settingsForm.taxName}
                onChange={(event) => setSettingsForm({ ...settingsForm, taxName: event.target.value.toUpperCase() })}
              />
              <Input
                label="Tax rate %"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settingsForm.taxRate}
                onChange={(event) => setSettingsForm({ ...settingsForm, taxRate: event.target.value })}
              />
            </div>
          </div>
          </section>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-md border border-zera-line bg-[#f7faf8] p-4">
          <SectionTitle icon={SlidersHorizontal} title="Current setup" />
          <dl className="divide-y divide-zera-line rounded-md border border-zera-line bg-white text-sm">
            <SummaryRow label="POS experience" value={formatPOSMode(selectedType.posMode, selectedType.value)} />
            <SummaryRow label="Business type" value={selectedType.label} />
            <SummaryRow label="Package" value={selectedPackage.name} />
            <SummaryRow label="Package status" value={getPackageStatusLabel(settingsForm.packageStatus)} />
            <SummaryRow label="Brand color" value={settingsForm.brandPrimaryColor || "Zera default"} />
            <SummaryRow label="Tax" value={settingsForm.taxEnabled ? `${settingsForm.taxName || "VAT"} ${Number(settingsForm.taxRate || 0)}%` : "Not applied"} />
            <SummaryRow label="Status" value={settingsForm.status === "ACTIVE" ? "Active" : "Inactive"} />
          </dl>
          <PackageUsagePanel selectedPackage={selectedPackage} usage={packageUsage} />
        </aside>
      </div>
    </form>
  );
}

function DeploymentPackagePanel({ business, deploymentDownloading, installerBuilding, installerDownloading, onBuildInstaller, onDownload, onDownloadInstaller }) {
  const [deployment, setDeployment] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deploymentError, setDeploymentError] = useState('');
  useEffect(() => {
    let disposed = false;
    let timer;
    setDeployment(null);
    setEnrollment(null);
    const load = async () => {
      try {
        const data = await getSystemBusinessInstallations(business.id);
        if (!disposed) { setDeployment(data); setDeploymentError(''); }
      } catch (error) { if (!disposed) setDeploymentError(error.response?.data?.message || 'Unable to load installation status.'); }
      finally { if (!disposed) timer = setTimeout(load, 5000); }
    };
    load();
    return () => { disposed = true; clearTimeout(timer); };
  }, [business.id, installerBuilding]);
  const readiness = getBusinessDeploymentReadiness(business);
  const busy = Boolean(installerBuilding || installerDownloading || deploymentDownloading);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Install Zera</h3><StatusPill active={readiness.ready} label={readiness.ready ? "Configuration ready" : "Setup required"} /></div>
    {!readiness.ready && <div role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><ul className="list-inside list-disc">{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul></div>}
    {deploymentError && <p role="alert" className="text-sm text-red-700">{deploymentError}</p>}
    <div className="grid gap-4 md:grid-cols-2">{[{id:"windows",name:"Windows",format:".exe"}, {id:"mac",name:"macOS",format:".dmg"}].map(platform => <article key={platform.id} className="rounded-xl border border-zera-line p-5">
      <div className="flex items-center justify-between"><h4 className="text-lg font-bold">{platform.name}</h4><span className="text-xs text-zera-muted">{platform.format}</span></div>
      <p className="mt-1 truncate text-sm text-zera-muted">{business.name}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button disabled={!readiness.ready || busy || !deployment || !(deployment.supportedPlatforms || [deployment.supportedPlatform]).includes(platform.id) || deployment.builds.some(build => build.platform === platform.id && ['QUEUED','BUILDING'].includes(build.status))} onClick={() => onBuildInstaller(platform.id)}>{installerBuilding === platform.id ? "Requesting…" : "Build installer"}</Button>
        <Button variant="secondary" disabled={busy || !deployment?.builds.some(build => build.platform === platform.id && build.status === 'READY' && !build.outdated)} onClick={() => onDownloadInstaller(platform.id)}><Download size={16}/>{installerDownloading === platform.id ? "Downloading…" : "Download"}</Button>
      </div>
      {deployment && !(deployment.supportedPlatforms || [deployment.supportedPlatform]).includes(platform.id) && <p className="mt-2 text-xs text-zera-muted">{platform.id === 'windows' ? deployment.windowsBuilder?.message || 'Connect a Windows builder to build from this computer.' : 'A Mac builder is required.'}</p>}
      {platform.id === 'windows' && deployment?.windowsBuilder?.available && deployment.windowsBuilder.remote && <p className="mt-2 text-xs text-zera-muted">Windows builder connected · x64</p>}
      {platform.id === 'windows' && deployment?.windowsBuilder?.available && deployment.windowsBuilder.local && <p className="mt-2 text-xs text-zera-muted">Build on this computer · Windows x64</p>}
    </article>)}</div>
    <section className="rounded-xl border border-zera-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Installed computers</h4><Button variant="secondary" disabled={deviceBusy} onClick={async () => {setDeviceBusy(true); try {setEnrollment(await createInstallationEnrollment(business.id)); setDeploymentError('');} catch(error) {setDeploymentError(error.response?.data?.message || 'Unable to create enrollment code.');} finally {setDeviceBusy(false);}}}>Connect a computer</Button></div>
      {enrollment && <div className="mt-3 rounded-lg bg-zera-surface p-3 text-sm"><p>In the desktop app, open Application → Connection &amp; services. Enter the central server address and this one-use code.</p><label className="mt-2 block">Enrollment code<input className="mt-1 w-full rounded border border-zera-line p-2 font-mono" readOnly value={enrollment.code} onFocus={event => event.target.select()}/></label><p className="mt-1 text-xs text-zera-muted">Expires {new Date(enrollment.expiresAt).toLocaleTimeString()}</p><Button variant="secondary" onClick={() => setEnrollment(null)}>Hide code</Button></div>}
      {deployment && !deployment.devices?.length && <p className="mt-3 text-sm text-zera-muted">No computers connected.</p>}
      <ul className="mt-3 divide-y divide-zera-line">{deployment?.devices?.map(device => <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{device.name}</strong><p className="text-xs text-zera-muted">{device.platform === 'mac' ? 'macOS' : 'Windows'} · {device.architecture} · {device.appVersion} · {device.mode === 'SHARED_SERVER' ? 'Shared server' : 'Desktop'}</p><p className="text-xs text-zera-muted">{device.lastSeenAt ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}` : 'Awaiting first health report'}</p></div><div className="flex items-center gap-3"><span>{({ONLINE:'Online',OFFLINE:'Offline',INSTALLED:'Installed',REVOKED:'Disconnected',NEEDS_ATTENTION:'Needs attention'})[device.status]}{device.updateAvailable && ' · Update available'}</span>{device.status !== 'REVOKED' && <Button variant="secondary" disabled={deviceBusy} onClick={async () => {setDeviceBusy(true); try {await revokeInstallation(business.id,device.id); setDeployment(await getSystemBusinessInstallations(business.id));} catch(error) {setDeploymentError(error.response?.data?.message || 'Unable to disconnect computer.');} finally {setDeviceBusy(false);}}}>Disconnect reporting</Button>}</div></li>)}</ul>
      <p className="mt-2 text-xs text-zera-muted">Offline after 3 minutes without a report. Disconnecting reporting does not stop local business operations.</p>
    </section>
    <section className="rounded-xl border border-zera-line p-4"><h4 className="font-semibold">Build history</h4>
      {!deployment ? <p className="mt-3 text-sm text-zera-muted">Loading build history…</p> : !deployment.builds.length ? <p className="mt-3 text-sm text-zera-muted">No builds requested.</p> : <ul className="mt-3 divide-y divide-zera-line">{deployment.builds.map(build => <li key={build.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><strong>{build.platform === 'mac' ? 'macOS' : 'Windows'} · {build.architecture} · {build.appVersion}</strong><p className="text-xs text-zera-muted">{new Date(build.createdAt).toLocaleString()}</p>{build.error && <p className="text-red-700">{build.error}</p>}{build.status === 'READY' && <p className="text-xs text-amber-800">Signature verification pending</p>}</div><span>{build.outdated ? 'Configuration changed — rebuild' : ({QUEUED:'Build requested',BUILDING:'Building',READY:'Ready for download',FAILED:'Failed'})[build.status] || build.status}</span></li>)}</ul>}
    </section>
    <section className="rounded-xl border border-zera-line p-4">
      <h4 className="font-semibold">On the customer computer</h4>
      <ol className="mt-3 grid list-inside list-decimal gap-3 text-sm sm:grid-cols-3"><li>Install the app</li><li>Create the owner login</li><li>Sign in to the workspace</li></ol>
      <p className="mt-3 text-sm text-zera-muted">Includes products and opening stock captured when built. Imports once on a new installation. Sales history, customers, staff accounts and private cost prices are not transferred.</p>
    </section>
    <details className="rounded-xl border border-zera-line p-4"><summary className="cursor-pointer font-semibold">Advanced setup</summary>
      <div className="mt-4 flex flex-wrap gap-2">{[{id:"manifest",label:"Configuration file"},{id:"readme",label:"Setup guide"}].map(file => <Button key={file.id} variant="secondary" disabled={busy} onClick={() => onDownload(file.id)}><FileText size={16}/>{deploymentDownloading === file.id ? "Preparing…" : file.label}</Button>)}</div>
      <p className="mt-3 text-sm text-zera-muted">macOS distribution requires signing and notarization. Build again after configuration changes to update the installer.</p>
    </details>
  </section>;
}

function BusinessTypeSelect({ businessTypeOptions = fallbackBusinessTypeOptions, onChange, value }) {
  const selectedType = getBusinessTypeOption(value, businessTypeOptions);
  const visibleBusinessTypes = businessTypeOptions.filter(
    (option) => option.active !== false || option.value === selectedType.value || option.key === selectedType.key
  );

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zera-ink">Type of business</span>
      <select
        className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {visibleBusinessTypes.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.active === false ? " (inactive)" : ""}
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
  const visiblePackageOptions = packageOptions;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zera-ink">Customer package</span>
      <select
        className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        value={selectedPackage.key}
        onChange={(event) => onChange(event.target.value)}
      >
        {visiblePackageOptions.map((packageItem) => (
          <option key={packageItem.key} value={packageItem.key} disabled={packageItem.active === false && packageItem.key !== selectedPackage.key}>
            {packageItem.name}
            {packageItem.active === false ? " (inactive - activate in Packages)" : ""}
          </option>
        ))}
      </select>
      <div className="mt-1.5 space-y-1 text-xs leading-5 text-zera-muted">
        <p>{selectedPackage.description} {formatPackageLimits(selectedPackage)}</p>
        <p>Custom packages are created and activated in Packages, then assigned here.</p>
      </div>
    </label>
  );
}

function PackageStatusSelect({ onChange, value }) {
  const selectedStatus = packageStatusOptions.find((status) => status.value === value) || packageStatusOptions[1];

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zera-ink">Package status</span>
      <select
        className="min-h-11 w-full rounded-md border border-zera-line bg-white px-3 text-sm text-zera-ink outline-none transition focus:border-zera-green focus:ring-4 focus:ring-zera-green/10"
        value={selectedStatus.value}
        onChange={(event) => onChange(event.target.value)}
      >
        {packageStatusOptions.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs leading-5 text-zera-muted">{selectedStatus.helper}</p>
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
      <SectionTitle icon={Boxes} title="Modules" />
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

function BranchesCard({ branchCreating, branchSavingId, business, onBranchCreate, onBranchStatusChange }) {
  const [form, setForm] = useState(defaultBranchForm);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const selectedPackage = business.platformPackage || getPackageOption(getBusinessPackageKey(business));
  const usage = getBusinessPackageUsage(business);
  const branchLimit = selectedPackage.maxBranches;
  const branchLimitReached = branchLimit !== null && branchLimit !== undefined && usage.branches >= branchLimit;

  useEffect(() => {
    setForm(defaultBranchForm);
    setShowCreatePanel(false);
  }, [business.id]);

  async function handleSubmit(event) {
    event.preventDefault();

    await onBranchCreate(form);
    setForm(defaultBranchForm);
    setShowCreatePanel(false);
  }

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle icon={MapPin} title="Branches" />
        <Button
          type="button"
          variant="secondary"
          className="h-9 justify-center px-3"
          disabled={branchLimitReached}
          onClick={() => setShowCreatePanel((current) => !current)}
        >
          <Plus size={15} />
          Add branch
        </Button>
      </div>

      {branchLimitReached ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          This package allows {branchLimit} active {branchLimit === 1 ? "branch" : "branches"}. Upgrade the package or deactivate a branch before adding another one.
        </p>
      ) : null}

      {showCreatePanel ? (
        <form className="mt-4 rounded-md border border-zera-line bg-[#fbfdfb] p-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <Input
              label="Branch name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Branch name"
              required
            />
            <Input
              label="Location"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="Area, street, or town"
            />
            <div className="flex gap-2">
              <Button className="h-10 px-4" disabled={branchCreating}>
                {branchCreating ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 px-4"
                disabled={branchCreating}
                onClick={() => {
                  setForm(defaultBranchForm);
                  setShowCreatePanel(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      ) : null}

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
  const activeUsers = business.memberships?.filter((membership) => membership.user?.status === "ACTIVE").length || 0;
  const filteredMemberships = (business.memberships || []).filter((membership) => {
    const searchTerm = search.trim().toLowerCase();

    if (!searchTerm) {
      return true;
    }

    return [membership.user?.name, membership.user?.email, membership.role?.name, membership.user?.status]
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
        <SectionTitle icon={Users} title="Access" />
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
                const isActive = membership.user?.status === "ACTIVE";
                const isOwner = membership.role?.name === "Owner";

                return (
                  <tr key={membership.id} className="hover:bg-[#f7faf8]">
                    <td className="px-4 py-3">
                      <p className="truncate font-bold">{membership.user?.name || "User not found"}</p>
                      <p className="mt-0.5 truncate text-xs text-zera-muted">{membership.user?.email || "Account record missing"}</p>
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
                        disabled={isOwner || !membership.user || userSavingId === membership.id}
                        onClick={() => onUserStatusChange(membership)}
                      >
                        {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                        {isOwner ? "Protected" : !membership.user ? "Unavailable" : isActive ? "Disable" : "Reactivate"}
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


      {showCreatePanel ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20 no-print">
          <form className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onSubmit={handleSubmit}>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zera-line bg-white p-5">
              <div>
                <p className="text-xs font-bold uppercase text-zera-green">Create user</p>
                <h3 className="mt-1 text-xl font-bold">{business.name}</h3>

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

              <div className="rounded-md bg-[#f7faf8] p-3 text-sm leading-6 text-zera-muted">This account will be available in the selected organization.</div>
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

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef7f1] text-zera-green">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-zera-ink">{title}</h3>
      </div>
    </div>
  );
}

function StatusPill({ active = true, label, muted = false }) {
  const inactive = muted || active === false;

  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold capitalize ${
        inactive ? "border-zera-line bg-white text-zera-muted" : "border-green-100 bg-zera-mint text-zera-green"
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

function formatDeploymentPlatform(platform = "manifest") {
  const labels = {
    mac: "Mac desktop app",
    windows: "Windows desktop app",
    manifest: "deployment manifest",
    readme: "setup notes"
  };

  return labels[platform] || "deployment";
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

function getNextPackageName(packageOptions = []) {
  const baseName = "Custom package";
  const existingNames = new Set(packageOptions.map((packageItem) => packageItem.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;

  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}

function getNextBusinessTypeName(businessTypeOptions = []) {
  const baseName = "Custom business";
  const existingNames = new Set(businessTypeOptions.map((businessType) => businessType.label || businessType.value));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;

  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix += 1;
  }

  return `${baseName} ${suffix}`;
}

function getBusinessTypeForm(businessType = fallbackBusinessTypeOptions[1]) {
  return {
    label: businessType.label || businessType.value || "",
    helper: businessType.helper || "",
    posMode: businessType.posMode || "RETAIL_CHECKOUT",
    defaultTableCount: businessType.defaultTableCount ?? "",
    defaultModuleKeys: businessType.defaultModuleKeys?.length ? businessType.defaultModuleKeys : ["POS"],
    rolesText: (businessType.roles || []).map((role) => `${role.name}${role.description ? ` - ${role.description}` : ""}`).join("\n"),
    active: businessType.active !== false
  };
}

function getBusinessSettingsForm(business, businessTypeOptions = fallbackBusinessTypeOptions) {
  return {
    name: business?.name || "",
    type: business?.type || "Retail shop",
    packageKey: business?.platformPackage?.key || "STARTER",
    packageStatus: business?.packageStatus || "ACTIVE",
    country: business?.country || "Uganda",
    currency: business?.currency || "UGX",
    logoUrl: business?.logoUrl || "",
    useBrandTheme: Boolean(business?.useBrandTheme),
    brandPrimaryColor: business?.brandPrimaryColor || "#16823A",
    brandSecondaryColor: business?.brandSecondaryColor || "#EEF7F1",
    contactPhone: business?.contactPhone || "",
    contactEmail: business?.contactEmail || "",
    address: business?.address || "",
    receiptHeader: business?.receiptHeader || "",
    receiptFooter: business?.receiptFooter || "Thank you for your purchase.",
    taxName: business?.taxName || "VAT",
    taxRate: business?.taxRate ?? 0,
    taxEnabled: Boolean(business?.taxEnabled),
    status: business?.status || "ACTIVE",
    posMode: business?.posMode || getBusinessTypeOption(business?.type, businessTypeOptions).posMode
  };
}

function getPackageStatusLabel(value = "ACTIVE") {
  return packageStatusOptions.find((status) => status.value === value)?.label || "Active";
}

function isPackageStatusHealthy(value = "ACTIVE") {
  return ["ACTIVE", "TRIAL"].includes(value || "ACTIVE");
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
  const attention = getAttentionItems(businesses);
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
    attention,
    readyToOperate: readyOrganizations,
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

    if (business.packageStatus === "PAST_DUE") {
      items.push({ businessId: business.id, businessName: business.name, label: "Payment due", severity: "review" });
    }

    if (["SUSPENDED", "CANCELLED"].includes(business.packageStatus)) {
      items.push({ businessId: business.id, businessName: business.name, label: `Package ${getPackageStatusLabel(business.packageStatus).toLowerCase()}`, severity: "critical" });
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

function isCustomPackage(packageItem) {
  return packageItem?.key === "CUSTOM" || packageItem?.name?.toLowerCase().includes("custom") || [packageItem?.maxBranches, packageItem?.maxUsers, packageItem?.maxProducts].some((limit) => limit === null || limit === undefined);
}

function formatPackagePrice(packageItem = fallbackPackageOptions[0]) {
  if (packageItem.price === null || packageItem.price === undefined || packageItem.price === "") {
    return "Custom";
  }

  const amount = Number(packageItem.price || 0).toLocaleString();
  const cycle = packageItem.billingCycle ? ` / ${packageItem.billingCycle.toLowerCase().replace("_", " ")}` : "";

  return `${packageItem.currency || "UGX"} ${amount}${cycle}`;
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

function slugifyFileName(value = "zera-business") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "zera-business";
}
