import { api } from "./api.js";

export async function getBusinesses() {
  const response = await api.get("/businesses");
  return response.data.businesses;
}

export async function updateBusinessProfile(businessId, payload) {
  const response = await api.patch(`/businesses/${businessId}`, payload);
  return response.data.business;
}

export async function createBranch(payload) {
  const response = await api.post("/branches", payload);
  return response.data.branch;
}

export async function updateBranchStatus(businessId, branchId, status) {
  const response = await api.patch(`/branches/${businessId}/${branchId}/status`, { status });
  return response.data.branch;
}

export async function updateBusinessModule(businessId, key, active) {
  const response = await api.patch(`/modules/${businessId}/${key}`, { active });
  return response.data.module;
}
