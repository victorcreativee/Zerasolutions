export const moduleCatalog = [
  {
    key: "POS",
    name: "POS",
    title: "Zera POS",
    summary: "Fast sales for retail, electronics, supermarkets, pharmacies, bars, and restaurants.",
    description: "Sales, open bills, receipts, and daily checkout.",
    activeByDefault: true
  },
  {
    key: "INVENTORY",
    name: "Inventory",
    title: "Inventory",
    summary: "Products, stock visibility, branches, and warehouse foundations.",
    description: "Products, stock, transfers, and warehouse control.",
    activeByDefault: false
  },
  {
    key: "FINANCE",
    name: "Finance",
    title: "Finance",
    summary: "Cash, expenses, payment tracking, and business reporting.",
    description: "Cash, expenses, invoices, and financial reports.",
    activeByDefault: false
  },
  {
    key: "OPERATIONS",
    name: "Operations",
    title: "Operations",
    summary: "Business-type workflows for restaurants, hotels, pharmacies, and services.",
    description: "Restaurant, hotel, pharmacy, or workflow operations.",
    activeByDefault: false
  },
  {
    key: "REPORTS",
    name: "Reports",
    title: "Reports",
    summary: "Daily, weekly, and monthly summaries for owners and managers.",
    description: "Daily, weekly, monthly, and manager reporting.",
    activeByDefault: false
  }
];

export const businessTypeCatalog = [
  {
    key: "BAR_RESTAURANT",
    value: "Bar and restaurant",
    label: "Bar and restaurant",
    posMode: "TABLE_SERVICE",
    defaultModuleKeys: ["POS", "REPORTS"],
    defaultTableCount: 8,
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
    defaultModuleKeys: ["POS", "INVENTORY", "REPORTS"],
    helper: "Simple counter sales, stock control, and daily shop reporting.",
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
    defaultModuleKeys: ["POS", "INVENTORY", "REPORTS"],
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
    defaultModuleKeys: ["POS", "INVENTORY", "REPORTS"],
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
    defaultModuleKeys: ["POS", "INVENTORY", "REPORTS"],
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
    defaultModuleKeys: ["POS", "OPERATIONS", "REPORTS"],
    helper: "Front-desk service sales now, room and folio workflows later.",
    roles: [
      { name: "Front Desk", description: "Serve guest-facing hotel workflows and record service sales." },
      { name: "Cashier", description: "Receive payments and close service bills." }
    ]
  }
];

export const packageCatalog = [
  {
    key: "STARTER",
    name: "Starter",
    description: "For one branch that needs simple selling, receipts, and basic daily reports.",
    price: 0,
    currency: "UGX",
    billingCycle: "MONTHLY",
    maxBranches: 1,
    maxUsers: 3,
    maxProducts: 300,
    defaultModuleKeys: ["POS", "REPORTS"]
  },
  {
    key: "GROWTH",
    name: "Growth",
    description: "For shops that need POS, product control, stock visibility, and stronger reports.",
    price: 0,
    currency: "UGX",
    billingCycle: "MONTHLY",
    maxBranches: 3,
    maxUsers: 10,
    maxProducts: 2000,
    defaultModuleKeys: ["POS", "INVENTORY", "REPORTS"]
  },
  {
    key: "BUSINESS",
    name: "Business",
    description: "For growing businesses that need all current Zera foundations enabled.",
    price: 0,
    currency: "UGX",
    billingCycle: "MONTHLY",
    maxBranches: 10,
    maxUsers: 50,
    maxProducts: 10000,
    defaultModuleKeys: ["POS", "INVENTORY", "FINANCE", "OPERATIONS", "REPORTS"]
  }
];

export const baseBusinessRoles = [
  { name: "Owner", description: "Full access to business setup, modules, and team accounts." },
  { name: "Manager", description: "Manage daily operations, staff, and branch oversight." }
];

export function getBusinessTypeDefinition(type = "") {
  const normalizedType = type.toLowerCase();

  return (
    businessTypeCatalog.find((option) => option.value === type || option.key === type) ||
    businessTypeCatalog.find((option) => normalizedType && (normalizedType.includes(option.value.toLowerCase()) || option.value.toLowerCase().includes(normalizedType))) ||
    businessTypeCatalog.find((option) => option.key === "RETAIL_SHOP")
  );
}

export function normalizePOSMode(value, businessType = "") {
  if (["RETAIL_CHECKOUT", "TABLE_SERVICE"].includes(value)) {
    return value;
  }

  return getBusinessTypeDefinition(businessType).posMode;
}

export function getPackageDefinition(packageKey = "STARTER") {
  return packageCatalog.find((option) => option.key === packageKey) || packageCatalog[0];
}

export function getDefaultModulesForBusiness(type = "", packageDefinition = null) {
  const typeDefinition = getBusinessTypeDefinition(type);
  const activeKeys = new Set(packageDefinition?.defaultModuleKeys || typeDefinition.defaultModuleKeys || ["POS"]);

  return moduleCatalog.map((moduleItem) => ({
    key: moduleItem.key,
    active: activeKeys.has(moduleItem.key)
  }));
}

export function getMissingPlatformModules(existingModules = []) {
  const existingModuleKeys = new Set(existingModules.map((moduleItem) => moduleItem.key));

  return moduleCatalog
    .filter((moduleItem) => !existingModuleKeys.has(moduleItem.key))
    .map((moduleItem) => ({
      key: moduleItem.key,
      active: moduleItem.activeByDefault
    }));
}

export function getPlatformSetupCatalog() {
  return {
    businessTypes: businessTypeCatalog,
    modules: moduleCatalog,
    packages: packageCatalog
  };
}
