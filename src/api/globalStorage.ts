import { apiRequest } from "./client";

export type GlobalStorage = {
  id: number;
  name: string;
  /** Template elements JSON — API may return array, object, or string */
  text: unknown;
  analysis_id?: number;
  analysisId?: number;
  company_id?: number;
  companyId?: number;
  createdAt?: string;
  updatedAt?: string;
  analysis?: {
    id: number;
    name: string;
  } | null;
  company?: {
    id: number;
    name: string;
  } | null;
};

export type GlobalStoragePayload = {
  name: string;
  text: unknown;
  analysis_id: number;
  company_id: number;
};

export type GlobalStorageFullParams = {
  page?: number;
  limit?: number;
  search?: string;
  analysis_id?: number;
};

export type GlobalStorageFullResponse = {
  data: GlobalStorage[];
  total: number;
  page: number;
  limit: number;
};

/** Token talab qilinmaydi — global shablonlar ochiq API */
const GLOBAL_AUTH = false;

export function resolveGlobalStorageAnalysisId(item: {
  analysis_id?: number | string | null;
  analysisId?: number | string | null;
  analysis?: { id?: number | string | null } | null;
}): number | null {
  const raw = item.analysis_id ?? item.analysisId ?? item.analysis?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveGlobalStorageCompanyId(item: {
  company_id?: number | string | null;
  companyId?: number | string | null;
  company?: { id?: number | string | null } | null;
}): number | null {
  const raw = item.company_id ?? item.companyId ?? item.company?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeList(raw: unknown): GlobalStorage[] {
  let list: GlobalStorage[] = [];
  if (Array.isArray(raw)) list = raw as GlobalStorage[];
  else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data =
      obj.data ??
      obj.items ??
      obj.result ??
      obj.globalstorages ??
      obj.globalStorages;
    if (Array.isArray(data)) list = data as GlobalStorage[];
  }

  return list.map(item => {
    const analysis_id = resolveGlobalStorageAnalysisId(item);
    const company_id = resolveGlobalStorageCompanyId(item);
    return {
      ...item,
      ...(analysis_id != null ? { analysis_id } : {}),
      ...(company_id != null ? { company_id } : {}),
    };
  });
}

function normalizeFullResponse(
  raw: unknown,
  params: GlobalStorageFullParams,
): GlobalStorageFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    const data = normalizeList(raw);
    return { data, total: data.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = normalizeList(
      obj.data ??
        obj.items ??
        obj.result ??
        obj.globalstorages ??
        obj.globalStorages ??
        [],
    );
    const total =
      typeof obj.total === "number"
        ? obj.total
        : typeof obj.count === "number"
          ? obj.count
          : typeof obj.totalCount === "number"
            ? obj.totalCount
            : data.length;
    const meta = (obj.meta ?? obj.pagination) as Record<string, unknown> | undefined;

    return {
      data,
      total: typeof meta?.total === "number" ? meta.total : total,
      page:
        typeof obj.page === "number"
          ? obj.page
          : typeof meta?.page === "number"
            ? meta.page
            : page,
      limit:
        typeof obj.limit === "number"
          ? obj.limit
          : typeof meta?.limit === "number"
            ? meta.limit
            : limit,
    };
  }

  return { data: [], total: 0, page, limit };
}

export function extractGlobalStorageId(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const nested =
    (obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>).id
      : undefined) ??
    (obj.globalstorage && typeof obj.globalstorage === "object"
      ? (obj.globalstorage as Record<string, unknown>).id
      : undefined) ??
    (obj.globalStorage && typeof obj.globalStorage === "object"
      ? (obj.globalStorage as Record<string, unknown>).id
      : undefined);
  const candidate = obj.id ?? nested;
  const n = Number(candidate);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getAllGlobalStorages() {
  const raw = await apiRequest<unknown>("/globalstorage/getall", {
    method: "GET",
    auth: GLOBAL_AUTH,
    fallbackError: "Global PDF shablonlarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export async function getGlobalStoragesFull(
  params: GlobalStorageFullParams = {},
): Promise<GlobalStorageFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.analysis_id != null && params.analysis_id > 0) {
    q.set("analysis_id", String(params.analysis_id));
  }

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/globalstorage/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    auth: GLOBAL_AUTH,
    fallbackError: "Global PDF shablonlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getGlobalStorageById(id: number) {
  return apiRequest<GlobalStorage>(`/globalstorage/getby/${id}`, {
    method: "GET",
    auth: GLOBAL_AUTH,
    fallbackError: "Global PDF shablonni yuklab bo'lmadi",
  }).then(raw => {
    const analysis_id = resolveGlobalStorageAnalysisId(raw);
    const company_id = resolveGlobalStorageCompanyId(raw);
    return {
      ...raw,
      ...(analysis_id != null ? { analysis_id } : {}),
      ...(company_id != null ? { company_id } : {}),
    };
  });
}

export function addGlobalStorage(payload: GlobalStoragePayload) {
  return apiRequest<GlobalStorage>("/globalstorage/add", {
    method: "POST",
    body: payload,
    auth: GLOBAL_AUTH,
    fallbackError: "Global PDF shablon qo'shib bo'lmadi",
  });
}

export function updateGlobalStorage(id: number, payload: GlobalStoragePayload) {
  return apiRequest<GlobalStorage>(`/globalstorage/update/${id}`, {
    method: "PATCH",
    body: payload,
    auth: GLOBAL_AUTH,
    fallbackError: "Global PDF shablonni yangilab bo'lmadi",
  });
}

export function deleteGlobalStorage(id: number) {
  return apiRequest<unknown>(`/globalstorage/delete/${id}`, {
    method: "DELETE",
    auth: GLOBAL_AUTH,
    fallbackError: "Global PDF shablonni o'chirib bo'lmadi",
  });
}
