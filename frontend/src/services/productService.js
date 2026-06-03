import { api } from "./api.js";

export async function getProducts(businessId, params = {}) {
  const response = await api.get(`/products/business/${businessId}`, { params });
  return response.data.products;
}

export async function createProduct(businessId, payload) {
  const response = await api.post(`/products/business/${businessId}`, payload);
  return response.data.product;
}

export async function updateProduct(businessId, productId, payload) {
  const response = await api.patch(`/products/business/${businessId}/${productId}`, payload);
  return response.data.product;
}

export async function updateProductStatus(businessId, productId, status) {
  const response = await api.patch(`/products/business/${businessId}/${productId}/status`, { status });
  return response.data.product;
}
