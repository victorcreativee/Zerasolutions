import { api } from "./api.js";

export async function getSystemBusinesses() {
  const response = await api.get("/system-admin/businesses");
  return response.data.businesses;
}

export async function provisionBusiness(payload) {
  const response = await api.post("/system-admin/businesses", payload);
  return response.data.business;
}

export async function updateSystemBusinessSettings(businessId, payload) {
  const response = await api.patch(`/system-admin/businesses/${businessId}/system-settings`, payload);
  return response.data.business;
}
