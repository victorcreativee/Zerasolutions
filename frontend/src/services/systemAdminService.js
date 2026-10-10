import { api } from "./api.js";

export async function getSystemBusinesses() {
  const response = await api.get("/system-admin/businesses");
  return response.data.businesses;
}

export async function getSystemSetupCatalog() {
  const response = await api.get("/system-admin/setup-catalog");
  return response.data;
}

export async function provisionBusiness(payload) {
  const response = await api.post("/system-admin/businesses", payload);
  return response.data.business;
}

export async function updateSystemBusinessSettings(businessId, payload) {
  const response = await api.patch(`/system-admin/businesses/${businessId}/system-settings`, payload);
  return response.data.business;
}

export async function createSystemBusinessBranch(businessId, payload) {
  const response = await api.post(`/system-admin/businesses/${businessId}/branches`, payload);
  return response.data.branch;
}

export async function updateSystemBusinessBranchStatus(businessId, branchId, status) {
  const response = await api.patch(`/system-admin/businesses/${businessId}/branches/${branchId}/status`, { status });
  return response.data.branch;
}

export async function createSystemBusinessUser(businessId, payload) {
  const response = await api.post(`/system-admin/businesses/${businessId}/users`, payload);
  return response.data.businessUser;
}

export async function updateSystemBusinessUserStatus(businessId, membershipId, status) {
  const response = await api.patch(`/system-admin/businesses/${businessId}/users/${membershipId}/status`, { status });
  return response.data.businessUser;
}

export async function getSystemBusinessDeploymentManifest(businessId) {
  const response = await api.get(`/system-admin/businesses/${businessId}/deployment-manifest`);
  return response.data.manifest;
}

export async function downloadSystemBusinessDeploymentPackage(businessId, platform) {
  const response = await api.get(`/system-admin/businesses/${businessId}/deployment-package`, {
    params: { platform },
    responseType: "blob"
  });
  const disposition = response.headers["content-disposition"] || "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/);

  return {
    blob: response.data,
    filename: filenameMatch?.[1] || `zera-${platform}-setup`
  };
}

export async function buildSystemBusinessDesktopInstaller(businessId, platform) {
  const response = await api.post(`/system-admin/businesses/${businessId}/desktop-installers`, { platform });
  return response.data.installer;
}

export async function getSystemBusinessInstallations(businessId) {
  return (await api.get(`/system-admin/businesses/${businessId}/installations`)).data;
}

export async function createInstallationEnrollment(businessId) {
  return (await api.post(`/system-admin/businesses/${businessId}/installations/enrollment`)).data;
}
export async function revokeInstallation(businessId, installationId) {
  return (await api.delete(`/system-admin/businesses/${businessId}/installations/${installationId}`)).data;
}

export async function downloadSystemBusinessDesktopInstaller(businessId, platform) {
  const response = await api.get(`/system-admin/businesses/${businessId}/desktop-installers/${platform}/download`, {
    responseType: "blob"
  });
  const disposition = response.headers["content-disposition"] || "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/);

  return {
    blob: response.data,
    filename: filenameMatch?.[1] || `zera-${platform}-installer.${platform === 'windows' ? 'exe' : 'dmg'}`
  };
}

export async function updatePlatformPackage(packageId, payload) {
  const response = await api.patch(`/system-admin/packages/${packageId}`, payload);
  return response.data;
}

export async function createPlatformPackage(payload) {
  const response = await api.post("/system-admin/packages", payload);
  return response.data;
}

export async function updatePlatformBusinessType(businessTypeId, payload) {
  const response = await api.patch(`/system-admin/business-types/${businessTypeId}`, payload);
  return response.data;
}

export async function createPlatformBusinessType(payload) {
  const response = await api.post("/system-admin/business-types", payload);
  return response.data;
}
