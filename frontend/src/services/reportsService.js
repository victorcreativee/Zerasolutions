import { api } from "./api.js";

export async function getReportSummary(businessId, params = {}) {
  const response = await api.get(`/reports/business/${businessId}/summary`, { params });
  return response.data.report;
}

export async function downloadReportCsv(businessId, params = {}) {
  const response = await api.get(`/reports/business/${businessId}/export`, { params, responseType: "blob" });
  return response.data;
}
