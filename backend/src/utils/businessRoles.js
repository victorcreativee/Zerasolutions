import { baseBusinessRoles, getBusinessTypeDefinition } from "../config/platformCatalog.js";

export function getDefaultRolesForBusiness(type = "", posMode = "RETAIL_CHECKOUT") {
  const roles = [...baseBusinessRoles];
  const typeDefinition = getBusinessTypeDefinition(type);

  return [...roles, ...typeDefinition.roles];
}

export function getMissingDefaultRoles(existingRoles = [], type = "", posMode = "RETAIL_CHECKOUT") {
  const existingRoleNames = new Set(existingRoles.map((role) => role.name));
  return getDefaultRolesForBusiness(type, posMode).filter((role) => !existingRoleNames.has(role.name));
}

export function getDefaultStaffRoleName(business = {}) {
  const posMode = business.posMode || "RETAIL_CHECKOUT";
  const roles = getBusinessTypeDefinition(business.type).roles || [];

  if (posMode === "TABLE_SERVICE") {
    return roles.find((role) => role.name === "Waiter")?.name || roles[0]?.name || "Cashier";
  }

  return roles[0]?.name || "Cashier";
}

export function canRecordSale(roleName, business = {}) {
  const allowedRoles = new Set(["Owner", "Manager", "Cashier", getDefaultStaffRoleName(business)]);
  return allowedRoles.has(roleName);
}
