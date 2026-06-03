import { api } from "./api.js";

export async function getPOSReadiness(businessId, branchId) {
  const response = await api.get(`/pos/readiness/${businessId}/${branchId}`);
  return response.data.readiness;
}

export async function getRecentSales(businessId, params = {}) {
  const response = await api.get(`/pos/sales/business/${businessId}`, { params });
  return response.data.sales;
}

export async function createSale(payload) {
  const response = await api.post("/pos/sales", payload);
  return response.data.sale;
}

export async function voidSale(businessId, saleId) {
  const response = await api.patch(`/pos/sales/business/${businessId}/${saleId}/void`);
  return response.data.sale;
}
