import {
  BarChart3,
  Boxes,
  ClipboardList,
  Home,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
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
      { label: "Inventory", path: "/inventory", icon: Boxes, roles: ["Owner", "Manager", "Store Keeper", "Pharmacist"], modules: ["INVENTORY"] },
      { label: "Operations", path: "/operations", icon: ClipboardList, roles: ["Owner", "Manager"], modules: ["OPERATIONS"] }
    ]
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", path: "/reports", icon: BarChart3, roles: reportRoles, modules: ["REPORTS", "POS"] },
      { label: "Finance", path: "/finance", icon: Wallet, roles: ["Owner"], modules: ["FINANCE"] }
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
    items: [{ label: "System Admin", path: "/system-admin", icon: ShieldCheck }]
  }
];

const routeMetadata = {
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
  "/finance": { title: "Finance", section: "Insights" },
  "/users": { title: "Team", section: "Administration" },
  "/settings": { title: "Business Settings", section: "Administration" },
  "/system-admin": { title: "System Admin", section: "Zera Platform" }
};

export function getRouteMetadata(pathname) {
  return routeMetadata[pathname] || { title: "Zera Solutions", section: "Workspace" };
}

export function getVisibleNavigation(groups, roleName, activeModuleKeys) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const roleAllowed = !item.roles || item.roles.includes(roleName || "Cashier");
        const moduleAllowed = !item.modules || item.modules.some((module) => activeModuleKeys.includes(module));
        return roleAllowed && moduleAllowed;
      })
    }))
    .filter((group) => group.items.length);
}
