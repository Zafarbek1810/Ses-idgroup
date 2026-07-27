import { apiRequest } from "./client";

/** One measured row inside a result (matches backend `result_item[]`) */
export type ResultItemPayload = {
  analysis_id: number;
  name: string;
  have_or_not: boolean | null;
  unit: string | null;
  norm: string | null;
  min: number | null;
  max: number | null;
  standard: string | null;
  have_or_notValue: boolean | null;
  unitValue: string | null;
  normValue: string | null;
  minValue: number | null;
  maxValue: number | null;
  standardValue: string | null;
};

export type ResultPayload = {
  order_id: number;
  lab_director_id: number;
  result_item: ResultItemPayload[];
};

export type ResultRecord = {
  id: number;
  order_id?: number;
  orderId?: number;
  lab_director_id?: number;
  labDirectorId?: number;
  result_item?: ResultItemPayload[];
  resultItems?: ResultItemPayload[];
  items?: ResultItemPayload[];
  order?: {
    id: number;
    name?: string | null;
    patient?: {
      id?: number;
      first_name?: string;
      last_name?: string;
    } | null;
  } | null;
  lab_director?: {
    id: number;
    username?: string;
    surname?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type SeverityValues = {
  mild: string;
  moderate: string;
  severe: string;
};

export function resolveResultOrderId(
  r: Pick<ResultRecord, "order_id" | "orderId" | "order">,
): number | null {
  const raw = r.order_id ?? r.orderId ?? r.order?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getResultItems(r: ResultRecord): ResultItemPayload[] {
  const list = r.result_item ?? r.resultItems ?? r.items;
  return Array.isArray(list) ? list : [];
}

function normalizeList(raw: unknown): ResultRecord[] {
  if (Array.isArray(raw)) return raw as ResultRecord[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.results ?? obj.items ?? obj.result;
    if (Array.isArray(data)) return data as ResultRecord[];
  }
  return [];
}

export async function getAllResults() {
  const raw = await apiRequest<unknown>("/result/getall", {
    method: "GET",
    fallbackError: "Natijalarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export function getResultById(id: number) {
  return apiRequest<ResultRecord>(`/result/getby/${id}`, {
    method: "GET",
    fallbackError: "Natijani yuklab bo'lmadi",
  });
}

export function deleteResult(id: number) {
  return apiRequest<unknown>(`/result/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Natijani o'chirib bo'lmadi",
  });
}

export function findResultByOrderId(
  results: ResultRecord[],
  orderId: number,
): ResultRecord | null {
  return results.find(r => resolveResultOrderId(r) === orderId) ?? null;
}

const SEV_PREFIX = "__sev__:";
const GRID_PREFIX = "__grid__:";
export const PDF_TABLE_RESULT_NAME = "__pdf_table__";

/** Pack mild/moderate/severe into normValue (string), keep other Value fields API-compatible */
export function encodeSeverityToNormValue(sev: SeverityValues): string | null {
  const mild = sev.mild.trim();
  const moderate = sev.moderate.trim();
  const severe = sev.severe.trim();
  if (!mild && !moderate && !severe) return null;
  // Single moderate-only → plain string (compatible with sample API style)
  if (!mild && !severe && moderate) return moderate;
  return `${SEV_PREFIX}${JSON.stringify({ mild, moderate, severe })}`;
}

export function decodeSeverityFromItem(item: ResultItemPayload): SeverityValues {
  const raw = item.normValue?.trim() || "";
  if (raw.startsWith(SEV_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(SEV_PREFIX.length)) as Partial<SeverityValues>;
      return {
        mild: parsed.mild ?? "",
        moderate: parsed.moderate ?? "",
        severe: parsed.severe ?? "",
      };
    } catch {
      return { mild: "", moderate: raw, severe: "" };
    }
  }
  // Plain normValue → ўрта column (classic lab result)
  return { mild: "", moderate: raw, severe: "" };
}

/** Free-form PDF table fill values keyed by "row:col" */
export function encodeGridFill(values: Record<string, string>): string {
  return `${GRID_PREFIX}${JSON.stringify(values)}`;
}

export function decodeGridFillFromItems(
  items: ResultItemPayload[],
  analysisId: number,
): Record<string, string> {
  const meta = items.find(
    i =>
      Number(i.analysis_id) === analysisId &&
      (i.name === PDF_TABLE_RESULT_NAME || String(i.normValue || "").startsWith(GRID_PREFIX)),
  );
  const raw = meta?.normValue?.trim() || "";
  if (!raw.startsWith(GRID_PREFIX)) return {};
  try {
    const parsed = JSON.parse(raw.slice(GRID_PREFIX.length)) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function buildResultItemFromGrid(
  analysisId: number,
  fillValues: Record<string, string>,
): ResultItemPayload {
  const any = Object.values(fillValues).some(v => String(v || "").trim());
  return {
    analysis_id: Number(analysisId),
    name: PDF_TABLE_RESULT_NAME,
    have_or_not: null,
    unit: null,
    norm: null,
    min: 0,
    max: 0,
    standard: null,
    have_or_notValue: any ? true : null,
    unitValue: null,
    normValue: encodeGridFill(fillValues),
    minValue: 0,
    maxValue: 0,
    standardValue: null,
  };
}

export function buildResultItemFromPattern(
  analysisId: number,
  pattern: {
    name: string;
    have_or_not: boolean;
    unit: string | null;
    norm: string | null;
    min: number | string | null;
    max: number | string | null;
    standard: string | null;
  },
  sev: SeverityValues,
): ResultItemPayload {
  const mild = sev.mild.trim();
  const moderate = sev.moderate.trim();
  const severe = sev.severe.trim();
  const any = Boolean(mild || moderate || severe);
  const normValue = encodeSeverityToNormValue(sev);
  const measured =
    toApiNumber(moderate) ?? toApiNumber(mild) ?? toApiNumber(severe);

  // Pattern range — must be real numbers for NestJS @IsNumber()
  let min = toApiNumber(pattern.min);
  let max = toApiNumber(pattern.max);

  // Fallback: parse from norm like "120-140" or "3.9-4.7"
  if (min == null || max == null) {
    const fromNorm = parseNormRange(pattern.norm);
    if (min == null) min = fromNorm.min;
    if (max == null) max = fromNorm.max;
  }

  // Last resort: use measured value so fields are never null/NaN
  if (min == null) min = measured ?? 0;
  if (max == null) max = measured ?? min;

  return {
    analysis_id: Number(analysisId),
    name: pattern.name,
    have_or_not: pattern.have_or_not ?? null,
    unit: pattern.unit ?? null,
    norm: pattern.norm ?? null,
    min,
    max,
    standard: pattern.standard ?? null,
    have_or_notValue: any ? true : null,
    unitValue: pattern.unit ?? null,
    normValue,
    minValue: measured ?? min,
    maxValue: measured ?? max,
    standardValue: pattern.standard ?? null,
  };
}

/** Coerce unknown → finite number, else null (never NaN/string) */
export function toApiNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v).trim().replace(",", ".").replace(/[^\d.+-]/g, "");
  if (!t || t === "+" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseNormRange(norm: string | null | undefined): { min: number | null; max: number | null } {
  if (!norm?.trim()) return { min: null, max: null };
  const m = norm.trim().match(/(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return { min: null, max: null };
  return {
    min: toApiNumber(m[1]),
    max: toApiNumber(m[2]),
  };
}

/** Ensure every result_item has numeric min/max/minValue/maxValue before API call */
export function sanitizeResultPayload(payload: ResultPayload): ResultPayload {
  return {
    order_id: Number(payload.order_id),
    lab_director_id: Number(payload.lab_director_id),
    result_item: payload.result_item.map(item => {
      let min = toApiNumber(item.min);
      let max = toApiNumber(item.max);
      let minValue = toApiNumber(item.minValue);
      let maxValue = toApiNumber(item.maxValue);

      if (min == null || max == null) {
        const fromNorm = parseNormRange(item.norm);
        if (min == null) min = fromNorm.min;
        if (max == null) max = fromNorm.max;
      }

      const measured =
        minValue ??
        maxValue ??
        toApiNumber(item.normValue) ??
        min ??
        max ??
        0;

      if (min == null) min = measured;
      if (max == null) max = measured;
      if (minValue == null) minValue = measured;
      if (maxValue == null) maxValue = measured;

      return {
        analysis_id: Number(item.analysis_id),
        name: item.name,
        have_or_not: item.have_or_not ?? null,
        unit: item.unit ?? null,
        norm: item.norm ?? null,
        min,
        max,
        standard: item.standard ?? null,
        have_or_notValue: item.have_or_notValue ?? null,
        unitValue: item.unitValue ?? null,
        normValue: item.normValue ?? null,
        minValue,
        maxValue,
        standardValue: item.standardValue ?? null,
      };
    }),
  };
}

export function addResult(payload: ResultPayload) {
  return apiRequest<ResultRecord>("/result/add", {
    method: "POST",
    body: sanitizeResultPayload(payload),
    fallbackError: "Natijani qo'shib bo'lmadi",
  });
}

export function updateResult(id: number, payload: ResultPayload) {
  return apiRequest<ResultRecord>(`/result/update/${id}`, {
    method: "PATCH",
    body: sanitizeResultPayload(payload),
    fallbackError: "Natijani yangilab bo'lmadi",
  });
}
