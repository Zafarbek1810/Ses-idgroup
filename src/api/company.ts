import { apiRequest } from "./client";

export type CompanyUser = {
  id: number;
  username: string;
  surname: string;
  email: string;
  createdAt?: string;
};

export type Company = {
  id: number;
  name: string;
  description: string;
  address: string;
  phone: string;
  active: boolean;
  user?: CompanyUser[];
  createdAt: string;
};

export type CompanyPayload = {
  name: string;
  description: string;
  address: string;
  phone: string;
  active: boolean;
};

export type CompaniesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type CompaniesFullResponse = {
  data: Company[];
  total: number;
  page: number;
  limit: number;
};

function normalizeFullResponse(
  raw: unknown,
  params: CompaniesFullParams,
): CompaniesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Company[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.companies ?? obj.items ?? obj.result) as
      | Company[]
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

export function extractCompanyId(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidate =
    obj.id ??
    (obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>).id : undefined) ??
    (obj.company && typeof obj.company === "object" ? (obj.company as Record<string, unknown>).id : undefined);
  return typeof candidate === "number" ? candidate : null;
}

export function getAllCompanies() {
  return apiRequest<Company[]>("/company/getall", {
    method: "GET",
    fallbackError: "Tashkilotlarni yuklab bo'lmadi",
  });
}

export async function getCompaniesFull(
  params: CompaniesFullParams = {},
): Promise<CompaniesFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/company/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Tashkilotlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getCompanyById(id: number) {
  return apiRequest<Company>(`/company/getby/${id}`, {
    method: "GET",
    fallbackError: "Tashkilotni yuklab bo'lmadi",
  });
}

export function addCompany(payload: CompanyPayload) {
  return apiRequest<Company>("/company/add", {
    method: "POST",
    body: payload,
    fallbackError: "Tashkilot qo'shib bo'lmadi",
  });
}

export function updateCompany(id: number, payload: CompanyPayload) {
  return apiRequest<Company>(`/company/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Tashkilotni yangilab bo'lmadi",
  });
}

export function deleteCompany(id: number) {
  return apiRequest<unknown>(`/company/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Tashkilotni o'chirib bo'lmadi",
  });
}
