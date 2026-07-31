import { apiRequest } from "./client";

export type OnlineStorage = {
  id: number;
  name: string;
  /** Template elements JSON — API may return array, object, or string */
  text: unknown;
  analysis_id?: number;
  analysisId?: number;
  createdAt?: string;
  updatedAt?: string;
  analysis?: {
    id: number;
    name: string;
  } | null;
};

export type OnlineStoragePayload = {
  name: string;
  text: unknown;
  analysis_id: number;
};

export type OnlineStorageFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type OnlineStorageFullResponse = {
  data: OnlineStorage[];
  total: number;
  page: number;
  limit: number;
};

export function resolveOnlineStorageAnalysisId(item: {
  analysis_id?: number | string | null;
  analysisId?: number | string | null;
  analysis?: { id?: number | string | null } | null;
}): number | null {
  const raw = item.analysis_id ?? item.analysisId ?? item.analysis?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeList(raw: unknown): OnlineStorage[] {
  let list: OnlineStorage[] = [];
  if (Array.isArray(raw)) list = raw as OnlineStorage[];
  else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.items ?? obj.result ?? obj.onlinestorages ?? obj.onlineStorages;
    if (Array.isArray(data)) list = data as OnlineStorage[];
  }

  return list.map(item => {
    const analysis_id = resolveOnlineStorageAnalysisId(item);
    return analysis_id != null ? { ...item, analysis_id } : item;
  });
}

function normalizeFullResponse(
  raw: unknown,
  params: OnlineStorageFullParams,
): OnlineStorageFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    const data = normalizeList(raw);
    return { data, total: data.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = normalizeList(
      obj.data ?? obj.items ?? obj.result ?? obj.onlinestorages ?? obj.onlineStorages ?? [],
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

export function extractOnlineStorageId(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const nested =
    (obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>).id
      : undefined) ??
    (obj.onlinestorage && typeof obj.onlinestorage === "object"
      ? (obj.onlinestorage as Record<string, unknown>).id
      : undefined) ??
    (obj.onlineStorage && typeof obj.onlineStorage === "object"
      ? (obj.onlineStorage as Record<string, unknown>).id
      : undefined);
  const candidate = obj.id ?? nested;
  const n = Number(candidate);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getAllOnlineStorages() {
  const raw = await apiRequest<unknown>("/onlinestorage/getall", {
    method: "GET",
    fallbackError: "PDF shablonlarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export async function getOnlineStoragesFull(
  params: OnlineStorageFullParams = {},
): Promise<OnlineStorageFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/onlinestorage/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "PDF shablonlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getOnlineStorageById(id: number) {
  return apiRequest<OnlineStorage>(`/onlinestorage/getby/${id}`, {
    method: "GET",
    fallbackError: "PDF shablonni yuklab bo'lmadi",
  });
}

export function addOnlineStorage(payload: OnlineStoragePayload) {
  return apiRequest<OnlineStorage>("/onlinestorage/add", {
    method: "POST",
    body: payload,
    fallbackError: "PDF shablon qo'shib bo'lmadi",
  });
}

export function updateOnlineStorage(id: number, payload: OnlineStoragePayload) {
  return apiRequest<OnlineStorage>(`/onlinestorage/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "PDF shablonni yangilab bo'lmadi",
  });
}

export function deleteOnlineStorage(id: number) {
  return apiRequest<unknown>(`/onlinestorage/delete/${id}`, {
    method: "DELETE",
    fallbackError: "PDF shablonni o'chirib bo'lmadi",
  });
}
