import { api } from './api.js';
const base = id => `/purchasing/business/${id}`;
export const getSuppliers = async id => (await api.get(`${base(id)}/suppliers`)).data.suppliers;
export const saveSupplier = async (id, data, supplierId) => (await api[supplierId ? 'patch' : 'post'](`${base(id)}/suppliers${supplierId ? `/${supplierId}` : ''}`, data)).data.supplier;
export const getPurchaseOrders = async (id, params) => (await api.get(`${base(id)}/orders`, { params })).data;
export const createPurchaseOrder = async (id, data) => (await api.post(`${base(id)}/orders`, data)).data.order;
export const actOnPurchaseOrder = async (id, orderId, action, payload = {}) => (await api.post(`${base(id)}/orders/${orderId}/${action}`, payload)).data.order;

export const updatePurchaseOrder = async (id, orderId, data) => (await api.patch(`${base(id)}/orders/${orderId}`, data)).data.order;

export const downloadPurchaseOrders = async (id, params) => (await api.get(`${base(id)}/orders/export`, { params, responseType: 'blob' })).data;
