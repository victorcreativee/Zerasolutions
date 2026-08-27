const baseRoles = [
  { name: "Owner", description: "Full access to business setup, modules, and team accounts." },
  { name: "Manager", description: "Manage daily operations, staff, and branch oversight." }
];

export function getDefaultRolesForBusiness(type = "", posMode = "RETAIL_CHECKOUT") {
  const normalizedType = type.toLowerCase();
  const roles = [...baseRoles];

  if (posMode === "TABLE_SERVICE" || normalizedType.includes("bar") || normalizedType.includes("restaurant")) {
    roles.push(
      { name: "Waiter", description: "Take table orders and record table-service bills." },
      { name: "Cashier", description: "Receive payments and close customer bills." }
    );
    return roles;
  }

  if (normalizedType.includes("pharmacy")) {
    roles.push(
      { name: "Pharmacist", description: "Serve pharmacy customers and record medicine sales." },
      { name: "Cashier", description: "Receive payments and run checkout." }
    );
    return roles;
  }

  if (normalizedType.includes("retail")) {
    roles.push(
      { name: "Store Keeper", description: "Support stock-facing shop duties and retail checkout." },
      { name: "Cashier", description: "Run retail checkout and receive payments." }
    );
    return roles;
  }

  if (normalizedType.includes("electronic")) {
    roles.push(
      { name: "Cashier", description: "Run device and accessory checkout and receive payments." },
      { name: "Store Keeper", description: "Receive stock, monitor device quantities, and keep product records clean." },
      { name: "Technician", description: "Support repair and device-service workflows when the service module is enabled." }
    );
    return roles;
  }

  if (normalizedType.includes("supermarket")) {
    roles.push(
      { name: "Cashier", description: "Run fast checkout and receive payments." },
      { name: "Store Keeper", description: "Support product and stock-facing supermarket work." }
    );
    return roles;
  }

  if (normalizedType.includes("hotel")) {
    roles.push(
      { name: "Front Desk", description: "Serve guest-facing hotel workflows and record service sales." },
      { name: "Cashier", description: "Receive payments and close service bills." }
    );
    return roles;
  }

  roles.push({ name: "Cashier", description: "Run checkout and receive payments." });
  return roles;
}

export function getMissingDefaultRoles(existingRoles = [], type = "", posMode = "RETAIL_CHECKOUT") {
  const existingRoleNames = new Set(existingRoles.map((role) => role.name));
  return getDefaultRolesForBusiness(type, posMode).filter((role) => !existingRoleNames.has(role.name));
}

export function getDefaultStaffRoleName(business = {}) {
  const normalizedType = (business.type || "").toLowerCase();
  const posMode = business.posMode || "RETAIL_CHECKOUT";

  if (posMode === "TABLE_SERVICE" || normalizedType.includes("bar") || normalizedType.includes("restaurant")) {
    return "Waiter";
  }

  if (normalizedType.includes("pharmacy")) {
    return "Pharmacist";
  }

  if (normalizedType.includes("retail")) {
    return "Store Keeper";
  }

  if (normalizedType.includes("electronic")) {
    return "Cashier";
  }

  if (normalizedType.includes("hotel")) {
    return "Front Desk";
  }

  return "Cashier";
}

export function canRecordSale(roleName, business = {}) {
  const allowedRoles = new Set(["Owner", "Manager", "Cashier", getDefaultStaffRoleName(business)]);
  return allowedRoles.has(roleName);
}
