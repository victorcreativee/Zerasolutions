import { api } from "./api.js";

export async function getInventoryStock(businessId, branchId) {
  const response = await api.get(`/inventory/business/${businessId}/branch/${branchId}`);
  return response.data;
}

export async function updateInventoryStock(businessId, branchId, productId, payload) {
  const response = await api.patch(`/inventory/business/${businessId}/branch/${branchId}/products/${productId}/stock`, payload);
  return response.data.stock;
}

export async function receiveInventoryStock(businessId, branchId, productId, payload) {
  const response = await api.post(`/inventory/business/${businessId}/branch/${branchId}/products/${productId}/receive`, payload);
  return response.data.stock;
}
