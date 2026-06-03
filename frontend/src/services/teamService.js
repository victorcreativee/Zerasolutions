import { api } from "./api.js";

export async function getBusinessUsers(businessId) {
  const response = await api.get(`/users/business/${businessId}`);
  return response.data.users;
}

export async function createBusinessUser(businessId, payload) {
  const response = await api.post(`/users/business/${businessId}`, payload);
  return response.data.businessUser;
}

export async function updateBusinessUserStatus(businessId, membershipId, status) {
  const response = await api.patch(`/users/business/${businessId}/${membershipId}/status`, { status });
  return response.data.businessUser;
}
