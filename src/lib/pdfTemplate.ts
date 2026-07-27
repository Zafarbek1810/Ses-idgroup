export type PdfTextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  align?: "left" | "center" | "right";
};

export type PdfElementType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "text"
  | "image"
  | "table"
  | "dynamic";

/** Keys that resolve from order / patient / result / user at fill time */
export type PdfDynamicFieldKey =
  | "order_number"
  | "order_created_at"
  | "result_date"
  | "patient_full_name"
  | "patient_address"
  | "patient_birth_day"
  | "patient_phone"
  | "lab_doctor"
  | "analysis_name"
  | "laboratory_name";

export type PdfDynamicFieldDef = {
  key: PdfDynamicFieldKey;
  /** Cyrillic label as on official form */
  label: string;
  /** Sample preview value in template editor */
  sample: string;
  hint: string;
};

export const DYNAMIC_FIELDS: PdfDynamicFieldDef[] = [
  {
    key: "order_number",
    label: "Мижоз тартиб рақами",
    sample: "Raqam #",
    hint: "Buyurtma raqami",
  },
  {
    key: "order_created_at",
    label: "Мурожаат",
    sample: "Sanasi/vaqti",
    hint: "Murojaat sanasi/vaqti",
  },
  {
    key: "patient_full_name",
    label: "Мижоз Ф.И.Ш.",
    sample: "Familiya Ismi Sharif",
    hint: "Bemor F.I.Sh.",
  },
  {
    key: "result_date",
    label: "Натижа",
    sample: "Sanasi/vaqti",
    hint: "Natija sanasi/vaqti",
  },
  {
    key: "patient_address",
    label: "Яшаш манзили",
    sample: "Manzil",
    hint: "Yashash manzili",
  },
  {
    key: "patient_birth_day",
    label: "Туғилган санаси",
    sample: "Sanasi/vaqti",
    hint: "Tug'ilgan sana",
  },
  {
    key: "patient_phone",
    label: "Телефон рақами",
    sample: "Raqam #",
    hint: "Telefon raqami",
  },
  {
    key: "lab_doctor",
    label: "Врач лаборант",
    sample: "Laborant / direktor",
    hint: "Laborant / direktor",
  },
  {
    key: "analysis_name",
    label: "Анализ",
    sample: "Analiz nomi",
    hint: "Analiz nomi",
  },
  {
    key: "laboratory_name",
    label: "Лаборатория",
    sample: "Laboratoriya nomi",
    hint: "Laboratoriya nomi",
  },
];

export function getDynamicFieldDef(key: PdfDynamicFieldKey | null | undefined) {
  return DYNAMIC_FIELDS.find(f => f.key === key) ?? null;
}

/** Context used when filling a template for a real order/result */
export type PdfDynamicContext = {
  orderId?: number | null;
  orderCreatedAt?: string | null;
  resultDate?: string | null;
  patientFullName?: string | null;
  patientAddress?: string | null;
  patientBirthDay?: string | null;
  patientPhone?: string | null;
  labDoctor?: string | null;
  analysisName?: string | null;
  laboratoryName?: string | null;
};

export function formatPdfDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatPdfDate(iso?: string | null): string {
  if (!iso) return "";
  // Already DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}/.test(iso.trim())) return iso.trim().slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function resolveDynamicValue(
  key: PdfDynamicFieldKey,
  ctx: PdfDynamicContext,
  forPreview = false,
): string {
  const def = getDynamicFieldDef(key);
  const sample = def?.sample ?? "…";

  const pick = (v: string | number | null | undefined) => {
    if (v == null || String(v).trim() === "") return forPreview ? sample : "—";
    return String(v).trim();
  };

  switch (key) {
    case "order_number":
      return pick(ctx.orderId);
    case "order_created_at":
      return pick(formatPdfDateTime(ctx.orderCreatedAt) || null);
    case "result_date":
      return pick(formatPdfDateTime(ctx.resultDate) || formatPdfDateTime(ctx.orderCreatedAt) || null);
    case "patient_full_name":
      return pick(ctx.patientFullName);
    case "patient_address":
      return pick(ctx.patientAddress);
    case "patient_birth_day":
      return pick(formatPdfDate(ctx.patientBirthDay) || null);
    case "patient_phone":
      return pick(ctx.patientPhone);
    case "lab_doctor":
      return pick(ctx.labDoctor);
    case "analysis_name":
      return pick(ctx.analysisName);
    case "laboratory_name":
      return pick(ctx.laboratoryName);
    default:
      return forPreview ? sample : "—";
  }
}

/** One cell in the editable table header */
export type PdfTableCell = {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  /** Hidden — covered by another cell's span */
  covered?: boolean;
};

/** Header-only table config; body rows come from analysis patterns */
export type PdfTableData = {
  cols: number;
  headerRows: number;
  headerCells: PdfTableCell[][];
};

/** Rectangular selection in the header (Excel-like) */
export type PdfTableSelection = {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
};

export type PdfElement = {
  id: string;
  type: PdfElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  imageSrc?: string;
  /** Required for body patterns */
  analysisId?: number | null;
  analysisName?: string;
  /** Header grid drawn by user */
  tableData?: PdfTableData;
  dynamicKey?: PdfDynamicFieldKey | null;
  showDynamicLabel?: boolean;
  style: PdfTextStyle;
};

export type PdfTemplate = {
  id: string;
  name: string;
  elements: PdfElement[];
  updatedAt: string;
  createdAt: string;
};

export const PDF_TEMPLATE_STORAGE_KEY = "ses-pdf-templates";
export const ACTIVE_PDF_TEMPLATE_KEY = "ses-pdf-active-template-id";

/** A4 at ~0.75 scale for on-screen preview (210×297 mm → px @ 96dpi * 0.75) */
export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
export const A4_PREVIEW_SCALE = 0.72;
export const A4_PREVIEW_WIDTH = Math.round(A4_WIDTH * A4_PREVIEW_SCALE);
export const A4_PREVIEW_HEIGHT = Math.round(A4_HEIGHT * A4_PREVIEW_SCALE);

const MIN_TABLE_COLS = 1;
const MAX_TABLE_COLS = 12;
const MIN_HEADER_ROWS = 1;
const MAX_HEADER_ROWS = 6;

export function emptyTableCell(text = ""): PdfTableCell {
  return { text, colSpan: 1, rowSpan: 1, covered: false };
}

export function createEmptyTableData(cols = 4, headerRows = 1): PdfTableData {
  const c = clampInt(cols, MIN_TABLE_COLS, MAX_TABLE_COLS);
  const hr = clampInt(headerRows, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const headerCells: PdfTableCell[][] = [];
  for (let i = 0; i < hr; i++) {
    const row: PdfTableCell[] = [];
    for (let j = 0; j < c; j++) {
      row.push(emptyTableCell(i === 0 && j === 0 ? "Pattern" : ""));
    }
    headerCells.push(row);
  }
  return { cols: c, headerRows: hr, headerCells };
}

/** Body fill key: patternId + column index (col 0 is pattern name, not filled) */
export function bodyCellKey(patternId: number | string, col: number) {
  return `${patternId}:${col}`;
}

export function normalizeSelection(sel: PdfTableSelection): PdfTableSelection {
  return {
    r1: Math.min(sel.r1, sel.r2),
    c1: Math.min(sel.c1, sel.c2),
    r2: Math.max(sel.r1, sel.r2),
    c2: Math.max(sel.c1, sel.c2),
  };
}

export function isInSelection(
  row: number,
  col: number,
  sel: PdfTableSelection | null | undefined,
): boolean {
  if (!sel) return false;
  const b = normalizeSelection(sel);
  return row >= b.r1 && row <= b.r2 && col >= b.c1 && col <= b.c2;
}

export function normalizeTableData(data?: PdfTableData | null): PdfTableData {
  // Migrate legacy full-grid format { rows, cells }
  const legacy = data as
    | (PdfTableData & { rows?: number; cells?: PdfTableCell[][] })
    | null
    | undefined;

  if (!legacy) return createEmptyTableData();

  let headerCells = legacy.headerCells;
  let headerRows = legacy.headerRows;
  let cols = legacy.cols;

  if ((!headerCells || headerCells.length === 0) && Array.isArray(legacy.cells)) {
    headerRows = 1;
    cols = legacy.cols || Math.max(...legacy.cells.map(r => r?.length ?? 0), 1);
    headerCells = [
      (legacy.cells[0] ?? []).map(c =>
        emptyTableCell(typeof c?.text === "string" ? c.text : ""),
      ),
    ];
  }

  if (!headerCells || headerCells.length === 0) return createEmptyTableData();

  const hr = clampInt(headerRows || headerCells.length, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const c = clampInt(
    cols || Math.max(...headerCells.map(r => r?.length ?? 0), 1),
    MIN_TABLE_COLS,
    MAX_TABLE_COLS,
  );

  const out: PdfTableCell[][] = [];
  for (let i = 0; i < hr; i++) {
    const src = headerCells[i] ?? [];
    const row: PdfTableCell[] = [];
    for (let j = 0; j < c; j++) {
      const cell = src[j];
      row.push({
        text: typeof cell?.text === "string" ? cell.text : "",
        colSpan: Math.max(1, Number(cell?.colSpan) || 1),
        rowSpan: Math.max(1, Number(cell?.rowSpan) || 1),
        covered: Boolean(cell?.covered),
      });
    }
    out.push(row);
  }
  return { cols: c, headerRows: hr, headerCells: out };
}

export function resizeTableCols(data: PdfTableData, nextCols: number): PdfTableData {
  const prev = normalizeTableData(data);
  const cols = clampInt(nextCols, MIN_TABLE_COLS, MAX_TABLE_COLS);
  const headerCells = prev.headerCells.map(row => {
    const next: PdfTableCell[] = [];
    for (let j = 0; j < cols; j++) {
      next.push(row[j] ? { ...row[j] } : emptyTableCell());
    }
    return next;
  });
  // Clear broken merges that overflow
  return sanitizeMerges({ cols, headerRows: prev.headerRows, headerCells });
}

export function resizeHeaderRows(data: PdfTableData, nextHeaderRows: number): PdfTableData {
  const prev = normalizeTableData(data);
  const hr = clampInt(nextHeaderRows, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const headerCells: PdfTableCell[][] = [];
  for (let i = 0; i < hr; i++) {
    if (prev.headerCells[i]) {
      headerCells.push(prev.headerCells[i].map(c => ({ ...c })));
    } else {
      headerCells.push(Array.from({ length: prev.cols }, () => emptyTableCell()));
    }
  }
  return sanitizeMerges({ cols: prev.cols, headerRows: hr, headerCells });
}

export function updateHeaderCell(
  data: PdfTableData,
  row: number,
  col: number,
  patch: Partial<PdfTableCell>,
): PdfTableData {
  const next = normalizeTableData(data);
  if (row < 0 || col < 0 || row >= next.headerRows || col >= next.cols) return next;
  if (next.headerCells[row][col].covered) return next;
  const headerCells = next.headerCells.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? { ...c, ...patch } : { ...c })),
  );
  return { cols: next.cols, headerRows: next.headerRows, headerCells };
}

/** Find the master cell that covers (row,col), or the cell itself */
export function findMergeMaster(
  data: PdfTableData,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const d = normalizeTableData(data);
  if (row < 0 || col < 0 || row >= d.headerRows || col >= d.cols) return null;
  const cell = d.headerCells[row][col];
  if (!cell.covered) return { row, col };
  for (let r = 0; r <= row; r++) {
    for (let c = 0; c <= col; c++) {
      const m = d.headerCells[r][c];
      if (m.covered) continue;
      const rs = m.rowSpan ?? 1;
      const cs = m.colSpan ?? 1;
      if (r <= row && row < r + rs && c <= col && col < c + cs) {
        return { row: r, col: c };
      }
    }
  }
  return { row, col };
}

function clearMergeAt(data: PdfTableData, row: number, col: number): PdfTableData {
  const d = normalizeTableData(data);
  const master = findMergeMaster(d, row, col);
  if (!master) return d;
  const m = d.headerCells[master.row][master.col];
  const rs = m.rowSpan ?? 1;
  const cs = m.colSpan ?? 1;
  const headerCells = d.headerCells.map(r => r.map(c => ({ ...c })));
  for (let r = master.row; r < master.row + rs && r < d.headerRows; r++) {
    for (let c = master.col; c < master.col + cs && c < d.cols; c++) {
      headerCells[r][c] = {
        ...headerCells[r][c],
        colSpan: 1,
        rowSpan: 1,
        covered: false,
      };
    }
  }
  return { cols: d.cols, headerRows: d.headerRows, headerCells };
}

export function unmergeHeaderSelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection(sel);
  let next = normalizeTableData(data);
  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      next = clearMergeAt(next, r, c);
    }
  }
  return next;
}

export function mergeHeaderSelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection(sel);
  if (b.r1 === b.r2 && b.c1 === b.c2) return normalizeTableData(data);

  // Unmerge anything overlapping the range first
  let next = unmergeHeaderSelection(data, b);
  const headerCells = next.headerCells.map(r => r.map(c => ({ ...c })));
  const text = headerCells[b.r1][b.c1].text;
  const rowSpan = b.r2 - b.r1 + 1;
  const colSpan = b.c2 - b.c1 + 1;

  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      if (r === b.r1 && c === b.c1) {
        headerCells[r][c] = {
          text,
          colSpan,
          rowSpan,
          covered: false,
        };
      } else {
        headerCells[r][c] = {
          text: "",
          colSpan: 1,
          rowSpan: 1,
          covered: true,
        };
      }
    }
  }
  return { cols: next.cols, headerRows: next.headerRows, headerCells };
}

function sanitizeMerges(data: PdfTableData): PdfTableData {
  const d = normalizeTableData(data);
  // Snapshot master cells before reset
  const masters: Array<{ r: number; c: number; text: string; rs: number; cs: number }> = [];
  for (let r = 0; r < d.headerRows; r++) {
    for (let c = 0; c < d.cols; c++) {
      const cell = d.headerCells[r][c];
      if (cell.covered) continue;
      const cs = Math.min(Math.max(1, cell.colSpan ?? 1), d.cols - c);
      const rs = Math.min(Math.max(1, cell.rowSpan ?? 1), d.headerRows - r);
      masters.push({ r, c, text: cell.text, rs, cs });
    }
  }

  const headerCells = d.headerCells.map(row =>
    row.map(cell => emptyTableCell(cell.covered ? "" : cell.text)),
  );
  for (const m of masters) {
    headerCells[m.r][m.c] = {
      text: m.text,
      colSpan: m.cs,
      rowSpan: m.rs,
      covered: false,
    };
    for (let rr = m.r; rr < m.r + m.rs; rr++) {
      for (let cc = m.c; cc < m.c + m.cs; cc++) {
        if (rr === m.r && cc === m.c) continue;
        headerCells[rr][cc] = { text: "", colSpan: 1, rowSpan: 1, covered: true };
      }
    }
  }
  return { cols: d.cols, headerRows: d.headerRows, headerCells };
}

export function tableHeightForRows(headerRows: number, bodyRows: number, compact = false): number {
  const h = compact ? 20 : 26;
  const b = compact ? 18 : 24;
  return Math.max(80, headerRows * h + Math.max(bodyRows, 1) * b + 8);
}

function clampInt(n: number, min: number, max: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** @deprecated use resizeTableCols / resizeHeaderRows */
export function resizeTableData(
  data: PdfTableData,
  nextCols: number,
  _nextRows?: number,
): PdfTableData {
  return resizeTableCols(data, nextCols);
}

/** @deprecated use updateHeaderCell */
export function updateTableCell(
  data: PdfTableData,
  row: number,
  col: number,
  patch: Partial<PdfTableCell>,
): PdfTableData {
  return updateHeaderCell(data, row, col, patch);
}

export function createElementId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTemplateId() {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultStyleForType(type: PdfElementType): PdfTextStyle {
  switch (type) {
    case "heading1":
      return { bold: true, fontSize: 22, align: "left" };
    case "heading2":
      return { bold: true, fontSize: 18, align: "left" };
    case "heading3":
      return { bold: true, fontSize: 14, align: "left" };
    case "text":
    case "dynamic":
      return { fontSize: 11, align: "left" };
    default:
      return { fontSize: 12, align: "left" };
  }
}

export function defaultContentForType(type: PdfElementType): string {
  switch (type) {
    case "heading1":
      return "Sarlavha 1";
    case "heading2":
      return "Sarlavha 2";
    case "heading3":
      return "Sarlavha 3";
    case "text":
      return "Matn yozing...";
    case "image":
      return "";
    case "table":
      return "Jadval";
    case "dynamic":
      return "";
    default:
      return "";
  }
}

export function defaultSizeForType(type: PdfElementType): { width: number; height: number } {
  switch (type) {
    case "heading1":
      return { width: 500, height: 36 };
    case "heading2":
      return { width: 460, height: 30 };
    case "heading3":
      return { width: 420, height: 26 };
    case "text":
      return { width: 460, height: 48 };
    case "image":
      return { width: 180, height: 140 };
    case "table":
      return { width: 540, height: 220 };
    case "dynamic":
      return { width: 260, height: 22 };
    default:
      return { width: 200, height: 40 };
  }
}

export function createPdfElement(
  type: PdfElementType,
  x: number,
  y: number,
  extras?: Partial<PdfElement>,
): PdfElement {
  const size = defaultSizeForType(type);
  const dynamicKey = extras?.dynamicKey ?? null;
  const def = dynamicKey ? getDynamicFieldDef(dynamicKey) : null;
  return {
    id: createElementId(),
    type,
    x: Math.max(0, Math.min(x, A4_WIDTH - size.width)),
    y: Math.max(0, Math.min(y, A4_HEIGHT - 20)),
    width: size.width,
    height: size.height,
    content: def?.label ?? defaultContentForType(type),
    analysisId: null,
    analysisName: "",
    tableData: type === "table" ? createEmptyTableData(4, 1) : undefined,
    dynamicKey: type === "dynamic" ? dynamicKey : null,
    showDynamicLabel: type === "dynamic" ? true : undefined,
    style: defaultStyleForType(type),
    ...extras,
  };
}

export function createDynamicElement(
  key: PdfDynamicFieldKey,
  x: number,
  y: number,
): PdfElement {
  const def = getDynamicFieldDef(key)!;
  return createPdfElement("dynamic", x, y, {
    dynamicKey: key,
    content: def.label,
    showDynamicLabel: true,
  });
}

export function formatDynamicDisplay(
  el: PdfElement,
  ctx: PdfDynamicContext | null,
  forPreview: boolean,
): { label: string; value: string; full: string } {
  const key = el.dynamicKey;
  const def = key ? getDynamicFieldDef(key) : null;
  const label = (el.content || def?.label || "").trim();
  const value = key
    ? resolveDynamicValue(key, ctx ?? {}, forPreview || !ctx)
    : forPreview
      ? "…"
      : "—";
  const showLabel = el.showDynamicLabel !== false;
  const full = showLabel && label ? `${label}: ${value}` : value;
  return { label, value, full };
}

export function loadPdfTemplates(): PdfTemplate[] {
  try {
    const raw = localStorage.getItem(PDF_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PdfTemplate[]) : [];
  } catch {
    return [];
  }
}

export function savePdfTemplates(templates: PdfTemplate[]) {
  localStorage.setItem(PDF_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function getActiveTemplateId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PDF_TEMPLATE_KEY);
  } catch {
    return null;
  }
}

export function setActiveTemplateId(id: string | null) {
  if (id == null) {
    localStorage.removeItem(ACTIVE_PDF_TEMPLATE_KEY);
  } else {
    localStorage.setItem(ACTIVE_PDF_TEMPLATE_KEY, id);
  }
}

export function getActivePdfTemplate(): PdfTemplate | null {
  const templates = loadPdfTemplates();
  if (templates.length === 0) return null;
  const activeId = getActiveTemplateId();
  if (activeId) {
    const found = templates.find(t => t.id === activeId);
    if (found) return found;
  }
  return templates[0];
}

export function upsertPdfTemplate(template: PdfTemplate) {
  const list = loadPdfTemplates();
  const idx = list.findIndex(t => t.id === template.id);
  if (idx >= 0) list[idx] = template;
  else list.unshift(template);
  savePdfTemplates(list);
  setActiveTemplateId(template.id);
  return template;
}

export function deletePdfTemplate(id: string) {
  const list = loadPdfTemplates().filter(t => t.id !== id);
  savePdfTemplates(list);
  if (getActiveTemplateId() === id) {
    setActiveTemplateId(list[0]?.id ?? null);
  }
}
