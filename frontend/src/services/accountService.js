import { api } from "./api.js";

export async function changePassword(payload) {
  const response = await api.patch("/auth/password", payload);
  return response.data;
}
