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

export function analysisHasOnlineStorage(a: Analysis | null | undefined): boolean {
  if (!a || typeof a !== "object") return false;
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

function normalizeLaboratory(raw: unknown): AnalysisLaboratory {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(o.name ?? ""),
    createdAt: String(o.createdAt ?? o.created_at ?? ""),
    lab_director: o.lab_director ?? null,
  };
}

function normalizeAnalysisRecord(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const laboratory =
    normalizeLaboratory(o.laboratory ?? o.lab) ??
    (() => {
      const labId = Number(o.laboratory_id ?? o.laboratoryId ?? o.lab_id ?? o.labId);
      if (!Number.isFinite(labId) || labId <= 0) {
        // ba'zi API lar laboratory ni oddiy id (number) qilib qaytaradi
        if (typeof o.laboratory === "number" || typeof o.lab === "number") {
          const bare = Number(o.laboratory ?? o.lab);
          if (Number.isFinite(bare) && bare > 0) {
            return { id: bare, name: "", createdAt: "", lab_director: null };
          }
        }
        return null;
      }
      return {
        id: labId,
        name: String(o.laboratory_name ?? o.laboratoryName ?? ""),
        createdAt: "",
        lab_director: null,
      };
    })();

  return {
    id,
    name: String(o.name ?? ""),
    shortname: String(o.shortname ?? o.shortName ?? ""),
    price: String(o.price ?? ""),
    createdAt: String(o.createdAt ?? o.created_at ?? ""),
    laboratory,
    onlinestorage: analysisHasOnlineStorage(o as unknown as Analysis),
  };
}

function normalizeAnalysisList(raw: unknown): Analysis[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.analyses ?? obj.items ?? obj.result;
    if (Array.isArray(data)) list = data;
  }
  return list
    .map(normalizeAnalysisRecord)
    .filter((a): a is Analysis => a != null);
}

function normalizeFullResponse(
  raw: unknown,
  params: AnalysesFullParams,
): AnalysesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    const data = normalizeAnalysisList(raw);
    return { data, total: data.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = normalizeAnalysisList(
      obj.data ?? obj.analyses ?? obj.items ?? obj.result ?? [],
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
      page: typeof obj.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
      limit: typeof obj.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
    };
  }

  return { data: [], total: 0, page, limit };
}

export async function getAllAnalyses() {
  const raw = await apiRequest<unknown>("/analysis/getall", {
    method: "GET",
    fallbackError: "Analizlarni yuklab bo'lmadi",
  });
  return normalizeAnalysisList(raw);
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
  const body: AnalysisUpdatePayload = { ...payload };
  if (payload.laboratory_id != null) {
    const labId = Number(payload.laboratory_id);
    if (Number.isFinite(labId) && labId > 0) {
      body.laboratory_id = labId;
    }
  }
  return apiRequest<Analysis>(`/analysis/update/${id}`, {
    method: "PATCH",
    body,
    fallbackError: "Analizni yangilab bo'lmadi",
  });
}

export function deleteAnalysis(id: number) {
  return apiRequest<unknown>(`/analysis/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Analizni o'chirib bo'lmadi",
  });
}
