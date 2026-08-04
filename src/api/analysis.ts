import { apiRequest } from "./client";

export type AnalysisLaboratory = {
  id: number;
  name: string;
  createdAt: string;
  lab_director: unknown;
} | null;

export type Analysis = {
  id: number;
  name: string;
  shortname: string;
  price: string;
  createdAt: string;
  laboratory: AnalysisLaboratory;
  /** PDF shablon mavjudligi (`/onlinestorage`) */
  onlinestorage?: boolean;
  onlineStorage?: boolean;
};

export type AnalysisPayload = {
  name: string;
  shortname: string;
  price: string;
  laboratory_id: number;
};

/** Partial PATCH body — e.g. only `{ onlinestorage: true }` after template save */
export type AnalysisUpdatePayload = Partial<AnalysisPayload> & {
  onlinestorage?: boolean;
};

export function analysisHasOnlineStorage(a: Analysis): boolean {
  const v = (a as Record<string, unknown>).onlinestorage
    ?? (a as Record<string, unknown>).onlineStorage
    ?? (a as Record<string, unknown>).online_storage;
  if (v === true || v === 1) return true;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return false;
}

export type AnalysesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type AnalysesFullResponse = {
  data: Analysis[];
  total: number;
  page: number;
  limit: number;
};

function normalizeFullResponse(
  raw: unknown,
  params: AnalysesFullParams,
): AnalysesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Analysis[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.analyses ?? obj.items ?? obj.result) as
      | Analysis[]
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

export function getAllAnalyses() {
  return apiRequest<Analysis[]>("/analysis/getall", {
    method: "GET",
    fallbackError: "Analizlarni yuklab bo'lmadi",
  });
}

export async function getAnalysesFull(
  params: AnalysesFullParams = {},
): Promise<AnalysesFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/analysis/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Analizlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getAnalysisById(id: number) {
  return apiRequest<Analysis>(`/analysis/getby/${id}`, {
    method: "GET",
    fallbackError: "Analizni yuklab bo'lmadi",
  });
}

export function addAnalysis(payload: AnalysisPayload) {
  return apiRequest<Analysis>("/analysis/add", {
    method: "POST",
    body: payload,
    fallbackError: "Analiz qo'shib bo'lmadi",
  });
}

export function updateAnalysis(id: number, payload: AnalysisUpdatePayload) {
  return apiRequest<Analysis>(`/analysis/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Analizni yangilab bo'lmadi",
  });
}

export function deleteAnalysis(id: number) {
  return apiRequest<unknown>(`/analysis/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Analizni o'chirib bo'lmadi",
  });
}
