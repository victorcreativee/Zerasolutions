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

export const businessNavigation = [
  {
    label: "Work",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: Home, roles: ["Owner", "Manager", "Cashier"] },
      { label: "POS", path: "/pos", icon: ReceiptText, roles: ["Owner", "Manager", "Cashier"], modules: ["POS"] }
    ]
  },
  {
    label: "Commerce",
    items: [
      { label: "Sales", path: "/sales", icon: BarChart3, roles: ["Owner", "Manager", "Cashier"], modules: ["POS"] },
      { label: "Customers", path: "/customers", icon: UserRound, roles: ["Owner", "Manager", "Cashier"], modules: ["POS"] },
      { label: "Products", path: "/products", icon: Package, roles: ["Owner", "Manager"], modules: ["POS"] }
    ]
  },
  {
    label: "Operations",
    items: [
      { label: "Inventory", path: "/inventory", icon: Boxes, roles: ["Owner", "Manager"], modules: ["INVENTORY"] },
      { label: "Operations", path: "/operations", icon: ClipboardList, roles: ["Owner", "Manager"], modules: ["OPERATIONS"] }
    ]
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", path: "/reports", icon: BarChart3, roles: ["Owner", "Manager"], modules: ["REPORTS", "POS"] },
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
