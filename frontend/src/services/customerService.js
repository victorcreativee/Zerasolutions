import { api } from "./api.js";

export async function getCustomers(businessId, params = {}) {
  const response = await api.get(`/customers/business/${businessId}`, { params });
  return response.data.customers;
}

export async function createCustomer(businessId, payload) {
  const response = await api.post(`/customers/business/${businessId}`, payload);
  return response.data.customer;
}

export async function updateCustomer(businessId, customerId, payload) {
  const response = await api.patch(`/customers/business/${businessId}/${customerId}`, payload);
  return response.data.customer;
}

export async function updateCustomerStatus(businessId, customerId, status) {
  const response = await api.patch(`/customers/business/${businessId}/${customerId}/status`, { status });
  return response.data.customer;
}
