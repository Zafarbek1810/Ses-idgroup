import { apiRequest } from "./client";

export type LabAssistant = {
  id: number;
  username?: string;
  surname?: string;
  email?: string;
  [key: string]: unknown;
};

export type LabDirector = LabAssistant | null;

export type Laboratory = {
  id: number;
  name: string;
  createdAt: string;
  analysis: unknown[];
  lab_director: LabDirector;
  lab_assistants: LabAssistant[];
};

export type LaboratoryPayload = {
  name: string;
};

export type LaboratoryUpdatePayload = {
  name?: string;
  lab_director_id?: number | null;
};

export type LaboratoriesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type LaboratoriesFullResponse = {
  data: Laboratory[];
  total: number;
  page: number;
  limit: number;
};

function normalizeFullResponse(
  raw: unknown,
  params: LaboratoriesFullParams,
): LaboratoriesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Laboratory[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.laboratories ?? obj.items ?? obj.result) as
      | Laboratory[]
      | undefined;
    const total =
      typeof obj.total === "number"
        ? obj.total
        : typeof obj.count === "number"
          ? obj.count
          : typeof obj.totalCount === "number"
            ? obj.totalCount
            : Array.isArray(data)
              ? data.length
              : 0;
    const meta = (obj.meta ?? obj.pagination) as Record<string, unknown> | undefined;

    return {
      data: Array.isArray(data) ? data : [],
      total: typeof meta?.total === "number" ? meta.total : total,
      page: typeof obj.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
      limit: typeof obj.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
    };
  }

  return { data: [], total: 0, page, limit };
}

export function getAllLaboratories() {
  return apiRequest<Laboratory[]>("/laboratory/getall", {
    method: "GET",
    fallbackError: "Laboratoriyalarni yuklab bo'lmadi",
  });
}

export async function getLaboratoriesFull(
  params: LaboratoriesFullParams = {},
): Promise<LaboratoriesFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/laboratory/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Laboratoriyalarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getLaboratoryById(id: number) {
  return apiRequest<Laboratory>(`/laboratory/getby/${id}`, {
    method: "GET",
    fallbackError: "Laboratoriyani yuklab bo'lmadi",
  });
}

export function addLaboratory(payload: LaboratoryPayload) {
  return apiRequest<Laboratory>("/laboratory/add", {
    method: "POST",
    body: payload,
    fallbackError: "Laboratoriya qo'shib bo'lmadi",
  });
}

export function updateLaboratory(id: number, payload: LaboratoryUpdatePayload) {
  return apiRequest<Laboratory>(`/laboratory/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Laboratoriyani yangilab bo'lmadi",
  });
}

export function deleteLaboratory(id: number) {
  return apiRequest<unknown>(`/laboratory/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Laboratoriyani o'chirib bo'lmadi",
  });
}

export function attachLabAssistant(labId: number, assistantId: number) {
  return apiRequest<unknown>(`/laboratory/assistant/${labId}/${assistantId}`, {
    method: "POST",
    fallbackError: "Assistentni biriktirib bo'lmadi",
  });
}

export function detachLabAssistant(labId: number, assistantId: number) {
  return apiRequest<unknown>(`/laboratory/assistant/${labId}/${assistantId}`, {
    method: "DELETE",
    fallbackError: "Assistentni olib tashlab bo'lmadi",
  });
}
