import { api } from "./api.js";

export async function getFinanceSummary(businessId, params = {}) {
  const response = await api.get(`/finance/business/${businessId}/summary`, { params });
  return response.data.finance;
}

export async function createFinanceExpense(businessId, payload) {
  const response = await api.post(`/finance/business/${businessId}/expenses`, payload);
  return response.data.expense;
}

export async function updateFinanceExpenseStatus(businessId, expenseId, status) {
  const response = await api.patch(`/finance/business/${businessId}/expenses/${expenseId}/status`, { status });
  return response.data.expense;
}
