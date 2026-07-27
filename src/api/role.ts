import { apiRequest } from "./client";

export type Role = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  user: unknown[];
};

export type RolePayload = {
  name: string;
  description: string;
};

export function getAllRoles() {
  return apiRequest<Role[]>("/role/getall", {
    method: "GET",
    fallbackError: "Rollarni yuklab bo'lmadi",
  });
}

export function getRoleById(id: number) {
  return apiRequest<Role>(`/role/getby/${id}`, {
    method: "GET",
    fallbackError: "Rolni yuklab bo'lmadi",
  });
}

export function addRole(payload: RolePayload) {
  return apiRequest<Role>("/role/add", {
    method: "POST",
    body: payload,
    fallbackError: "Rol qo'shib bo'lmadi",
  });
}

export function updateRole(id: number, payload: RolePayload) {
  return apiRequest<Role>(`/role/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Rolni yangilab bo'lmadi",
  });
}

export function deleteRole(id: number) {
  return apiRequest<unknown>(`/role/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Rolni o'chirib bo'lmadi",
  });
}
