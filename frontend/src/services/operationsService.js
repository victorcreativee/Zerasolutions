import { api } from "./api.js";

export async function getOperationsSummary(businessId, params = {}) {
  const response = await api.get(`/operations/business/${businessId}/summary`, { params });
  return response.data.operations;
}
