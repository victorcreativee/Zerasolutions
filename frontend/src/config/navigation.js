import {
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Home,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Wallet
} from "lucide-react";

const salesRoles = ["Owner", "Manager", "Cashier", "Waiter", "Store Keeper", "Pharmacist", "Front Desk"];
const cashierRoles = ["Owner", "Manager", "Cashier"];
const productRoles = ["Owner", "Manager", "Store Keeper", "Pharmacist"];
const reportRoles = ["Owner", "Manager", "Cashier"];

export const businessNavigation = [
  {
    label: "Work",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: Home, roles: salesRoles },
      { label: "POS", path: "/pos", icon: ReceiptText, roles: salesRoles, modules: ["POS"] }
    ]
  },
  {
    label: "Commerce",
    items: [
      { label: "Settle bills", path: "/open-bills", icon: ClipboardList, roles: cashierRoles, modules: ["POS"], tableServiceOnly: true },
      { label: "Sales", path: "/sales", icon: BarChart3, roles: salesRoles, modules: ["POS"] },
      { label: "Customers", path: "/customers", icon: UserRound, roles: salesRoles, modules: ["POS"] },
      { label: "Products", path: "/products", icon: Package, roles: productRoles, modules: ["POS", "INVENTORY"] }
    ]
  },
  {
    label: "Operations",
    items: [
      { label: "Purchasing", path: "/purchasing", icon: Package, roles: ["Owner", "Manager", "Store Keeper", "Pharmacist"], modules: ["INVENTORY"] },
      { label: "Inventory", path: "/inventory", icon: Boxes, roles: ["Owner", "Manager", "Store Keeper", "Pharmacist"], modules: ["INVENTORY"] },
      { label: "Operations", path: "/operations", icon: ClipboardList, roles: ["Owner", "Manager"], modules: ["OPERATIONS"] }
    ]
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", path: "/reports", icon: BarChart3, roles: reportRoles, modules: ["REPORTS", "POS"] },
      { label: "Finance", path: "/finance", icon: Wallet, roles: ["Owner", "Store Keeper"], modules: ["FINANCE"] },
    ]
  },
  {
    label: "Administration",
    items: [
      { label: "Team", path: "/users", icon: Users, roles: ["Owner"] },
      { label: "Business settings", path: "/settings", icon: Settings, roles: ["Owner"] }
    ]
  }
];

export const systemAdminNavigation = [
  {
    label: "Platform",
    items: [
      {
        label: "System Control",
        path: "/system-admin",
        icon: ShieldCheck,
        children: [
          { label: "Organizations", path: "/system-admin?section=organizations", icon: Building2 },
          { label: "Packages", path: "/system-admin?section=packages", icon: Package },
          { label: "Settings", path: "/system-admin?section=platform", icon: SlidersHorizontal }
        ]
      }
    ]
  }
];

const routeMetadata = {
  "/purchasing": { title: "Suppliers & Purchases", section: "Inventory" },
  "/account": { title: "Account", section: "Personal settings" },
  "/dashboard": { title: "Dashboard", section: "Workspace" },
  "/pos": { title: "Point of Sale", section: "Work" },
  "/open-bills": { title: "Settle Bills", section: "Commerce" },
  "/sales": { title: "Sales", section: "Commerce" },
  "/customers": { title: "Customers", section: "Commerce" },
  "/products": { title: "Products", section: "Commerce" },
  "/inventory": { title: "Inventory", section: "Operations" },
  "/operations": { title: "Operations", section: "Operations" },
  "/reports": { title: "Reports", section: "Insights" },
  "/finance/accounts": { title: "Money accounts", section: "Finance" },
  "/finance/expenses": { title: "Expenses", section: "Finance" },
  "/finance/income": { title: "Income", section: "Finance" },
  "/finance/payments": { title: "Payments", section: "Finance" },
  "/finance/payroll": { title: "Payroll", section: "Finance" },
  "/finance/reports": { title: "Financial reports", section: "Finance" },
  "/finance": { title: "Finance", section: "Insights" },
  "/expenses": { title: "Expenses", section: "Operations" },
  "/money": { title: "Money accounts", section: "Insights" },
  "/users": { title: "Team", section: "Administration" },
  "/settings": { title: "Business Settings", section: "Administration" },
  "/system-admin": { title: "System Control", section: "Zera Platform" }
};

export function getRouteMetadata(pathname) {
  return routeMetadata[pathname] || { title: "Zera Solutions", section: "Workspace" };
}

export function getVisibleNavigation(groups, roleName, activeModuleKeys, business) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.path === "/finance" && roleName === "Store Keeper" && business?.features?.typeKey !== "RETAIL_SHOP") return false;
        const roleAllowed = !item.roles || item.roles.includes(roleName || "Cashier");
        const moduleAllowed = !item.modules || item.modules.some((module) => activeModuleKeys.includes(module));
        return roleAllowed && moduleAllowed;
      })
    }))
    .filter((group) => group.items.length);
}
