import { api } from "./api.js";

export async function getSyncStatus(businessId) {
  const response = await api.get("/sync/status", {
    params: businessId ? { businessId } : {}
  });

  return response.data.sync;
}

export async function getSyncOperations(businessId) {
  const response = await api.get("/sync/operations", {
    params: businessId ? { businessId } : {}
  });

  return response.data.operations || [];
}

export async function prepareSyncRun(businessId) {
  const response = await api.post("/sync/prepare", { businessId });

  return response.data.sync;
}
