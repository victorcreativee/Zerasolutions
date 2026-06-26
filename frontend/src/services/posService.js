import { api } from "./api.js";

export async function getPOSReadiness(businessId, branchId) {
  const response = await api.get(`/pos/readiness/${businessId}/${branchId}`);
  return response.data.readiness;
}

export async function getRecentSales(businessId, params = {}) {
  const response = await api.get(`/pos/sales/business/${businessId}`, { params });
  return response.data.sales;
}

export async function getPOSTables(businessId, branchId) {
  const response = await api.get(`/pos/tables/business/${businessId}`, { params: { branchId } });
  return response.data.tables;
}

export async function createPOSTable(payload) {
  const response = await api.post("/pos/tables", payload);
  return response.data.table;
}

export async function getActivePOSOrders(businessId, branchId, params = {}) {
  const response = await api.get(`/pos/orders/business/${businessId}`, {
    params: {
      branchId,
      status: "ACTIVE",
      ...params
    }
  });
  return response.data.orders;
}

export async function getActiveTableOrder(businessId, branchId, tableId) {
  const response = await api.get(`/pos/orders/table/${tableId}/active`, {
    params: {
      businessId,
      branchId
    }
  });
  return response.data.order;
}

export async function createPOSOrder(payload) {
  const response = await api.post("/pos/orders", payload);
  return response.data.order;
}

export async function markPOSOrderBillPrinted(orderId) {
  const response = await api.patch(`/pos/orders/${orderId}/bill-printed`);
  return response.data.order;
}

export async function payPOSOrder(orderId, payload) {
  const response = await api.patch(`/pos/orders/${orderId}/pay`, payload);
  return response.data.sale;
}

export async function createSale(payload) {
  const response = await api.post("/pos/sales", payload);
  return response.data.sale;
}

export async function voidSale(businessId, saleId) {
  const response = await api.patch(`/pos/sales/business/${businessId}/${saleId}/void`);
  return response.data.sale;
}
