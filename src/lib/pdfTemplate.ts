import {
  addOnlineStorage,
  deleteOnlineStorage,
  extractOnlineStorageId,
  getAllOnlineStorages,
  updateOnlineStorage,
  type OnlineStorage,
} from "@/api/onlineStorage";
import {
  addGlobalStorage,
  deleteGlobalStorage,
  extractGlobalStorageId,
  getAllGlobalStorages,
  updateGlobalStorage,
  type GlobalStorage,
} from "@/api/globalStorage";
import { getStoredCompanyId } from "@/api/session";

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
  | "result_id"
  | "result_date"
  | "patient_full_name"
  | "patient_address"
  | "patient_birth_day"
  | "patient_phone"
  | "lab_doctor"
  | "lab_assistant"
  | "analysis_name"
  | "laboratory_name";

export type PdfDynamicFieldDef = {
  key: PdfDynamicFieldKey;
  /** Lotincha yorliq (PDF shablonda ko'rinadi) */
  label: string;
  /** Sample preview value in template editor */
  sample: string;
  hint: string;
};

export const DYNAMIC_FIELDS: PdfDynamicFieldDef[] = [
  {
    key: "order_number",
    label: "Mijoz tartib raqami",
    sample: "Raqam #",
    hint: "Buyurtma raqami",
  },
  {
    key: "order_created_at",
    label: "Murojaat",
    sample: "Sanasi/vaqti",
    hint: "Murojaat sanasi/vaqti",
  },
  {
    key: "result_id",
    label: "Natija ID",
    sample: "Raqam #",
    hint: "Result id",
  },
  {
    key: "patient_full_name",
    label: "Mijoz F.I.Sh.",
    sample: "Familiya Ismi Sharif",
    hint: "Bemor F.I.Sh.",
  },
  {
    key: "result_date",
    label: "Natija",
    sample: "Sanasi/vaqti",
    hint: "Natija sanasi/vaqti",
  },
  {
    key: "patient_address",
    label: "Yashash manzili",
    sample: "Manzil",
    hint: "Yashash manzili",
  },
  {
    key: "patient_birth_day",
    label: "Tug'ilgan sanasi",
    sample: "Sanasi/vaqti",
    hint: "Tug'ilgan sana",
  },
  {
    key: "patient_phone",
    label: "Telefon raqami",
    sample: "Raqam #",
    hint: "Telefon raqami",
  },
  {
    key: "lab_doctor",
    label: "Vrach laborant",
    sample: "Laborant / direktor",
    hint: "Laborant / direktor",
  },
  {
    key: "lab_assistant",
    label: "Laboratoriya assistenti",
    sample: "Assistent F.I.Sh.",
    hint: "Laboratoriya assistenti",
  },
  {
    key: "analysis_name",
    label: "Analiz",
    sample: "Analiz nomi",
    hint: "Analiz nomi",
  },
  {
    key: "laboratory_name",
    label: "Laboratoriya",
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
  resultId?: number | null;
  resultDate?: string | null;
  patientFullName?: string | null;
  patientAddress?: string | null;
  patientBirthDay?: string | null;
  patientPhone?: string | null;
  labDoctor?: string | null;
  labAssistant?: string | null;
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
    case "result_id":
      return pick(ctx.resultId);
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
    case "lab_assistant":
      return pick(ctx.labAssistant);
    case "analysis_name":
      return pick(ctx.analysisName);
    case "laboratory_name":
      return pick(ctx.laboratoryName);
    default:
      return forPreview ? sample : "—";
  }
}

/** One cell in the editable table */
export type PdfCellValueMode = "static" | "dynamic";

export type PdfTableCell = {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  /** Hidden — covered by another cell's span */
  covered?: boolean;
  /**
   * static — faqat PDF shablon sahifasida tahrirlanadi
   * dynamic — Natijalar sahifasida to'ldiriladi / o'zgartiriladi
   */
  valueMode?: PdfCellValueMode;
};

export function normalizeCellValueMode(
  mode: PdfCellValueMode | null | undefined,
): PdfCellValueMode {
  return mode === "dynamic" ? "dynamic" : "static";
}

export function isDynamicCell(cell: Pick<PdfTableCell, "valueMode"> | null | undefined) {
  return normalizeCellValueMode(cell?.valueMode) === "dynamic";
}

/** Full editable table: header + body (manual), optional per-column widths */
export type PdfTableData = {
  cols: number;
  headerRows: number;
  headerCells: PdfTableCell[][];
  bodyRows: number;
  bodyCells: PdfTableCell[][];
  /** Relative column widths in %; length === cols; sum ≈ 100 */
  colWidths: number[];
};

/** Rectangular selection in header or body (Excel-like) */
export type PdfTableSelection = {
  section: "header" | "body";
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
  /** Bind template table to an analysis (Results page matching) */
  analysisId?: number | null;
  analysisName?: string;
  /** Header + body grid drawn by user */
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
  /** Backend `/onlinestorage` record id when persisted remotely */
  storageId?: number | null;
  /** Backend `/globalstorage` record id when persisted globally */
  globalStorageId?: number | null;
  /** Company that published this global template (if known) */
  companyId?: number | null;
  companyName?: string;
  /** Analysis this template belongs to (`/onlinestorage` analysis_id) */
  analysisId?: number | null;
  analysisName?: string;
};

export const PDF_TEMPLATE_STORAGE_KEY = "ses-pdf-templates";
export const ACTIVE_PDF_TEMPLATE_KEY = "ses-pdf-active-template-id";

/** A4 at ~0.75 scale for on-screen preview (210×297 mm → px @ 96dpi * 0.75) */
export const A4_WIDTH = 595;
export const A4_HEIGHT = 842;
export const A4_PREVIEW_SCALE = 0.72;
export const A4_PREVIEW_WIDTH = Math.round(A4_WIDTH * A4_PREVIEW_SCALE);
export const A4_PREVIEW_HEIGHT = Math.round(A4_HEIGHT * A4_PREVIEW_SCALE);
/** Soft cap for very long templates (keeps editor usable) */
export const PDF_MAX_PAGES = 10;
/** Top/bottom margin on each printed page (pt) so table splits aren't flush to edges */
export const PDF_PAGE_MARGIN = 44;

const MIN_TABLE_COLS = 1;
const MAX_TABLE_COLS = 12;
const MIN_HEADER_ROWS = 1;
const MAX_HEADER_ROWS = 6;
const MIN_BODY_ROWS = 0;
const MAX_BODY_ROWS = 80;
const MIN_COL_WIDTH_PCT = 5;

export function emptyTableCell(
  text = "",
  valueMode: PdfCellValueMode = "static",
): PdfTableCell {
  return { text, colSpan: 1, rowSpan: 1, covered: false, valueMode };
}

export function equalColWidths(cols: number): number[] {
  const c = Math.max(1, cols);
  const base = Math.floor((10000 / c)) / 100;
  const widths = Array.from({ length: c }, () => base);
  const sum = widths.reduce((a, b) => a + b, 0);
  widths[c - 1] = Math.round((widths[c - 1] + (100 - sum)) * 100) / 100;
  return widths;
}

export function normalizeColWidths(widths: number[] | null | undefined, cols: number): number[] {
  const c = Math.max(1, cols);
  if (!widths || widths.length === 0) return equalColWidths(c);
  const next = Array.from({ length: c }, (_, i) => {
    const v = Number(widths[i]);
    return Number.isFinite(v) && v > 0 ? v : 100 / c;
  });
  const sum = next.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equalColWidths(c);
  return next.map(w => Math.round((w / sum) * 10000) / 100);
}

/** Drag resize between col `leftCol` and `leftCol+1`; deltaPct is change to left column */
export function resizeAdjacentColWidths(
  widths: number[],
  leftCol: number,
  deltaPct: number,
): number[] {
  const next = [...widths];
  const rightCol = leftCol + 1;
  if (leftCol < 0 || rightCol >= next.length) return next;
  const left = next[leftCol];
  const right = next[rightCol];
  const pair = left + right;
  let newLeft = left + deltaPct;
  newLeft = Math.max(MIN_COL_WIDTH_PCT, Math.min(pair - MIN_COL_WIDTH_PCT, newLeft));
  next[leftCol] = Math.round(newLeft * 100) / 100;
  next[rightCol] = Math.round((pair - newLeft) * 100) / 100;
  return next;
}

export function setColWidthAt(data: PdfTableData, col: number, pct: number): PdfTableData {
  const prev = normalizeTableData(data);
  if (col < 0 || col >= prev.cols) return prev;
  const widths = [...prev.colWidths];
  const others = widths.reduce((s, w, i) => (i === col ? s : s + w), 0);
  const clamped = Math.max(
    MIN_COL_WIDTH_PCT,
    Math.min(100 - MIN_COL_WIDTH_PCT * (prev.cols - 1), Number(pct) || MIN_COL_WIDTH_PCT),
  );
  widths[col] = clamped;
  // Scale remaining columns to fill 100 - clamped
  const targetOthers = 100 - clamped;
  if (others > 0) {
    for (let i = 0; i < widths.length; i++) {
      if (i === col) continue;
      widths[i] = Math.round((widths[i] / others) * targetOthers * 100) / 100;
    }
  }
  return { ...prev, colWidths: normalizeColWidths(widths, prev.cols) };
}

function makeCellGrid(rows: number, cols: number, seed?: PdfTableCell[][]): PdfTableCell[][] {
  const out: PdfTableCell[][] = [];
  for (let i = 0; i < rows; i++) {
    const src = seed?.[i] ?? [];
    const row: PdfTableCell[] = [];
    for (let j = 0; j < cols; j++) {
      const cell = src[j];
      row.push({
        text: typeof cell?.text === "string" ? cell.text : "",
        colSpan: Math.max(1, Number(cell?.colSpan) || 1),
        rowSpan: Math.max(1, Number(cell?.rowSpan) || 1),
        covered: Boolean(cell?.covered),
        valueMode: normalizeCellValueMode(cell?.valueMode),
      });
    }
    out.push(row);
  }
  return out;
}

export function createEmptyTableData(cols = 4, headerRows = 1, bodyRows = 3): PdfTableData {
  const c = clampInt(cols, MIN_TABLE_COLS, MAX_TABLE_COLS);
  const hr = clampInt(headerRows, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const br = clampInt(bodyRows, MIN_BODY_ROWS, MAX_BODY_ROWS);
  const headerCells: PdfTableCell[][] = [];
  for (let i = 0; i < hr; i++) {
    const row: PdfTableCell[] = [];
    for (let j = 0; j < c; j++) {
      row.push(emptyTableCell(i === 0 && j === 0 ? "Ko'rsatkich" : ""));
    }
    headerCells.push(row);
  }
  const bodyCells = makeCellGrid(br, c);
  return {
    cols: c,
    headerRows: hr,
    headerCells,
    bodyRows: br,
    bodyCells,
    colWidths: equalColWidths(c),
  };
}

/** Body fill key: row index + column index */
export function bodyCellKey(row: number | string, col: number) {
  return `${row}:${col}`;
}

/** Header fill key for dynamic header cells on Results */
export function headerCellKey(row: number, col: number) {
  return `h:${row}:${col}`;
}

export function normalizeSelection(sel: PdfTableSelection): PdfTableSelection {
  return {
    section: sel.section === "body" ? "body" : "header",
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
  // Migrate legacy full-grid format { rows, cells } and header-only templates
  const legacy = data as
    | (PdfTableData & { rows?: number; cells?: PdfTableCell[][] })
    | null
    | undefined;

  if (!legacy) return createEmptyTableData();

  let headerCells = legacy.headerCells;
  let headerRows = legacy.headerRows;
  let cols = legacy.cols;
  let bodyCells = legacy.bodyCells;
  let bodyRows = legacy.bodyRows;

  if ((!headerCells || headerCells.length === 0) && Array.isArray(legacy.cells)) {
    headerRows = 1;
    cols = legacy.cols || Math.max(...legacy.cells.map(r => r?.length ?? 0), 1);
    headerCells = [
      (legacy.cells[0] ?? []).map(c =>
        emptyTableCell(typeof c?.text === "string" ? c.text : ""),
      ),
    ];
    // Remaining legacy rows become body
    if (legacy.cells.length > 1) {
      bodyCells = legacy.cells.slice(1);
      bodyRows = bodyCells.length;
    }
  }

  if (!headerCells || headerCells.length === 0) return createEmptyTableData();

  const hr = clampInt(headerRows || headerCells.length, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const c = clampInt(
    cols || Math.max(...headerCells.map(r => r?.length ?? 0), 1),
    MIN_TABLE_COLS,
    MAX_TABLE_COLS,
  );

  const outHeader = makeCellGrid(hr, c, headerCells);

  // Legacy templates without body: start with 3 empty body rows
  const hasBody = Array.isArray(bodyCells);
  const br = clampInt(
    hasBody ? bodyRows ?? bodyCells!.length : 3,
    MIN_BODY_ROWS,
    MAX_BODY_ROWS,
  );
  const outBody = makeCellGrid(br, c, hasBody ? bodyCells : undefined);

  return {
    cols: c,
    headerRows: hr,
    headerCells: outHeader,
    bodyRows: br,
    bodyCells: outBody,
    colWidths: normalizeColWidths(legacy.colWidths, c),
  };
}

export function resizeTableCols(data: PdfTableData, nextCols: number): PdfTableData {
  const prev = normalizeTableData(data);
  const cols = clampInt(nextCols, MIN_TABLE_COLS, MAX_TABLE_COLS);
  const headerCells = makeCellGrid(prev.headerRows, cols, prev.headerCells);
  const bodyCells = makeCellGrid(prev.bodyRows, cols, prev.bodyCells);
  const colWidths =
    cols === prev.cols
      ? prev.colWidths
      : cols > prev.cols
        ? normalizeColWidths(
            [...prev.colWidths, ...Array.from({ length: cols - prev.cols }, () => 100 / cols)],
            cols,
          )
        : normalizeColWidths(prev.colWidths.slice(0, cols), cols);
  return sanitizeMerges({
    cols,
    headerRows: prev.headerRows,
    headerCells,
    bodyRows: prev.bodyRows,
    bodyCells,
    colWidths,
  });
}

export function resizeHeaderRows(data: PdfTableData, nextHeaderRows: number): PdfTableData {
  const prev = normalizeTableData(data);
  const hr = clampInt(nextHeaderRows, MIN_HEADER_ROWS, MAX_HEADER_ROWS);
  const headerCells = makeCellGrid(hr, prev.cols, prev.headerCells);
  return sanitizeMerges({
    cols: prev.cols,
    headerRows: hr,
    headerCells,
    bodyRows: prev.bodyRows,
    bodyCells: prev.bodyCells.map(r => r.map(c => ({ ...c }))),
    colWidths: prev.colWidths,
  });
}

export function resizeBodyRows(data: PdfTableData, nextBodyRows: number): PdfTableData {
  const prev = normalizeTableData(data);
  const br = clampInt(nextBodyRows, MIN_BODY_ROWS, MAX_BODY_ROWS);
  return sanitizeMerges({
    cols: prev.cols,
    headerRows: prev.headerRows,
    headerCells: prev.headerCells.map(r => r.map(c => ({ ...c }))),
    bodyRows: br,
    bodyCells: makeCellGrid(br, prev.cols, prev.bodyCells),
    colWidths: [...prev.colWidths],
  });
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
  return { ...next, headerCells };
}

export function updateBodyCell(
  data: PdfTableData,
  row: number,
  col: number,
  patch: Partial<PdfTableCell>,
): PdfTableData {
  const next = normalizeTableData(data);
  if (row < 0 || col < 0 || row >= next.bodyRows || col >= next.cols) return next;
  if (next.bodyCells[row][col].covered) return next;
  const bodyCells = next.bodyCells.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? { ...c, ...patch } : { ...c })),
  );
  return { ...next, bodyCells };
}

export function updateColWidths(data: PdfTableData, colWidths: number[]): PdfTableData {
  const next = normalizeTableData(data);
  return { ...next, colWidths: normalizeColWidths(colWidths, next.cols) };
}

/** Find the master cell that covers (row,col) in header, or the cell itself */
export function findMergeMaster(
  data: PdfTableData,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const d = normalizeTableData(data);
  return findGridMergeMaster(d.headerCells, d.headerRows, d.cols, row, col);
}

export function findBodyMergeMaster(
  data: PdfTableData,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const d = normalizeTableData(data);
  return findGridMergeMaster(d.bodyCells, d.bodyRows, d.cols, row, col);
}

function findGridMergeMaster(
  cells: PdfTableCell[][],
  rows: number,
  cols: number,
  row: number,
  col: number,
): { row: number; col: number } | null {
  if (row < 0 || col < 0 || row >= rows || col >= cols) return null;
  const cell = cells[row][col];
  if (!cell.covered) return { row, col };
  for (let r = 0; r <= row; r++) {
    for (let c = 0; c <= col; c++) {
      const m = cells[r][c];
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

function clearHeaderMergeAt(data: PdfTableData, row: number, col: number): PdfTableData {
  const d = normalizeTableData(data);
  const master = findGridMergeMaster(d.headerCells, d.headerRows, d.cols, row, col);
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
  return { ...d, headerCells };
}

function clearBodyMergeAt(data: PdfTableData, row: number, col: number): PdfTableData {
  const d = normalizeTableData(data);
  const master = findGridMergeMaster(d.bodyCells, d.bodyRows, d.cols, row, col);
  if (!master) return d;
  const m = d.bodyCells[master.row][master.col];
  const rs = m.rowSpan ?? 1;
  const cs = m.colSpan ?? 1;
  const bodyCells = d.bodyCells.map(r => r.map(c => ({ ...c })));
  for (let r = master.row; r < master.row + rs && r < d.bodyRows; r++) {
    for (let c = master.col; c < master.col + cs && c < d.cols; c++) {
      bodyCells[r][c] = {
        ...bodyCells[r][c],
        colSpan: 1,
        rowSpan: 1,
        covered: false,
      };
    }
  }
  return { ...d, bodyCells };
}

export function unmergeHeaderSelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection(sel);
  let next = normalizeTableData(data);
  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      next = clearHeaderMergeAt(next, r, c);
    }
  }
  return next;
}

export function unmergeBodySelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection({ ...sel, section: "body" });
  let next = normalizeTableData(data);
  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      next = clearBodyMergeAt(next, r, c);
    }
  }
  return next;
}

export function mergeHeaderSelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection({ ...sel, section: "header" });
  if (b.r1 === b.r2 && b.c1 === b.c2) return normalizeTableData(data);

  let next = unmergeHeaderSelection(data, b);
  const headerCells = next.headerCells.map(r => r.map(c => ({ ...c })));
  const master = headerCells[b.r1][b.c1];
  const text = master.text;
  const valueMode = normalizeCellValueMode(master.valueMode);
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
          valueMode,
        };
      } else {
        headerCells[r][c] = {
          text: "",
          colSpan: 1,
          rowSpan: 1,
          covered: true,
          valueMode: "static",
        };
      }
    }
  }
  return { ...next, headerCells };
}

export function mergeBodySelection(
  data: PdfTableData,
  sel: PdfTableSelection,
): PdfTableData {
  const b = normalizeSelection({ ...sel, section: "body" });
  if (b.r1 === b.r2 && b.c1 === b.c2) return normalizeTableData(data);

  let next = unmergeBodySelection(data, b);
  const bodyCells = next.bodyCells.map(r => r.map(c => ({ ...c })));
  const master = bodyCells[b.r1][b.c1];
  const text = master.text;
  const valueMode = normalizeCellValueMode(master.valueMode);
  const rowSpan = b.r2 - b.r1 + 1;
  const colSpan = b.c2 - b.c1 + 1;

  for (let r = b.r1; r <= b.r2; r++) {
    for (let c = b.c1; c <= b.c2; c++) {
      if (r === b.r1 && c === b.c1) {
        bodyCells[r][c] = {
          text,
          colSpan,
          rowSpan,
          covered: false,
          valueMode,
        };
      } else {
        bodyCells[r][c] = {
          text: "",
          colSpan: 1,
          rowSpan: 1,
          covered: true,
          valueMode: "static",
        };
      }
    }
  }
  return { ...next, bodyCells };
}

function sanitizeGridMerges(
  cells: PdfTableCell[][],
  rows: number,
  cols: number,
): PdfTableCell[][] {
  const masters: Array<{
    r: number;
    c: number;
    text: string;
    rs: number;
    cs: number;
    valueMode: PdfCellValueMode;
  }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r]?.[c];
      if (!cell || cell.covered) continue;
      const cs = Math.min(Math.max(1, cell.colSpan ?? 1), cols - c);
      const rs = Math.min(Math.max(1, cell.rowSpan ?? 1), rows - r);
      masters.push({
        r,
        c,
        text: cell.text,
        rs,
        cs,
        valueMode: normalizeCellValueMode(cell.valueMode),
      });
    }
  }

  const out = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cell = cells[r]?.[c];
      return emptyTableCell(
        cell?.covered ? "" : (cell?.text ?? ""),
        normalizeCellValueMode(cell?.valueMode),
      );
    }),
  );

  for (const m of masters) {
    out[m.r][m.c] = {
      text: m.text,
      colSpan: m.cs,
      rowSpan: m.rs,
      covered: false,
      valueMode: m.valueMode,
    };
    for (let rr = m.r; rr < m.r + m.rs; rr++) {
      for (let cc = m.c; cc < m.c + m.cs; cc++) {
        if (rr === m.r && cc === m.c) continue;
        out[rr][cc] = {
          text: "",
          colSpan: 1,
          rowSpan: 1,
          covered: true,
          valueMode: "static",
        };
      }
    }
  }
  return out;
}

function sanitizeMerges(data: PdfTableData): PdfTableData {
  const d = normalizeTableData(data);
  return {
    ...d,
    headerCells: sanitizeGridMerges(d.headerCells, d.headerRows, d.cols),
    bodyCells: sanitizeGridMerges(d.bodyCells, d.bodyRows, d.cols),
    colWidths: [...d.colWidths],
  };
}

export function tableHeightForRows(headerRows: number, bodyRows: number, compact = false): number {
  const h = compact ? 20 : 26;
  const b = compact ? 18 : 24;
  return Math.max(80, headerRows * h + Math.max(bodyRows, 1) * b + 8);
}

/** Effective painted height of an element (tables grow with row count). */
export function getElementRenderHeight(el: PdfElement): number {
  if (el.type === "table") {
    const grid = normalizeTableData(el.tableData);
    return Math.max(el.height, tableHeightForRows(grid.headerRows, grid.bodyRows, true));
  }
  return el.height;
}

/** Lowest Y (A4 points) occupied by template content. */
export function getPdfContentBottom(template: PdfTemplate): number {
  let bottom = 0;
  for (const el of template.elements) {
    bottom = Math.max(bottom, el.y + getElementRenderHeight(el));
  }
  return bottom;
}

/** Content area height inside one A4 page (excludes top/bottom margins when enabled). */
export function getPdfUsablePageHeight(withMargins = false): number {
  if (!withMargins) return A4_HEIGHT;
  return Math.max(120, A4_HEIGHT - 2 * PDF_PAGE_MARGIN);
}

export function getPdfPageMarginPreview(): number {
  return PDF_PAGE_MARGIN * A4_PREVIEW_SCALE;
}

export function getPdfUsablePreviewHeight(withMargins = false): number {
  if (!withMargins) return A4_PREVIEW_HEIGHT;
  return A4_PREVIEW_HEIGHT - 2 * getPdfPageMarginPreview();
}

/**
 * How many A4 pages the template needs (at least 1).
 * withMargins=true — used for result preview/export so content doesn't touch page edges.
 */
export function getPdfPageCount(template: PdfTemplate, withMargins = false): number {
  const bottom = getPdfContentBottom(template);
  if (bottom <= 0) return 1;
  const usable = getPdfUsablePageHeight(withMargins);
  return Math.max(1, Math.min(PDF_MAX_PAGES, Math.ceil(bottom / usable - 0.001)));
}

/** Full document height in A4 points (N × A4). */
export function getPdfDocumentHeight(template: PdfTemplate, withMargins = false): number {
  return getPdfPageCount(template, withMargins) * A4_HEIGHT;
}

/** Full document height in preview pixels (exact N × A4 preview). */
export function getPdfPreviewHeight(template: PdfTemplate, withMargins = false): number {
  return getPdfPageCount(template, withMargins) * A4_PREVIEW_HEIGHT;
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
    y: Math.max(0, Math.min(y, A4_HEIGHT * PDF_MAX_PAGES - 20)),
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

/** Logout / login: company shablonlarini local cache dan tozalash */
export function clearPdfTemplatesStorage() {
  try {
    localStorage.removeItem(PDF_TEMPLATE_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_PDF_TEMPLATE_KEY);
  } catch {
    /* ignore */
  }
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

/** Prefer template-level analysis, then table-bound; used as `/onlinestorage` analysis_id */
export function resolvePdfTemplateAnalysisId(template: PdfTemplate): number | null {
  const top = Number(template.analysisId);
  if (Number.isFinite(top) && top > 0) return top;

  for (const el of template.elements) {
    if (el.type !== "table") continue;
    const n = Number(el.analysisId);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function pdfTemplateToStoragePayload(template: PdfTemplate): { elements: PdfElement[] } {
  return { elements: template.elements };
}

export function parsePdfTemplateFromStorageText(
  text: unknown,
  fallbackName: string,
): PdfTemplate | null {
  let parsed: unknown = text;
  if (typeof text === "string") {
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (parsed == null) return null;

  const now = new Date().toISOString();

  // Current format: { elements: [...] }
  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.elements)) {
      const analysisIdRaw = Number(obj.analysisId);
      return {
        id: typeof obj.id === "string" && obj.id ? obj.id : createTemplateId(),
        name:
          (typeof obj.name === "string" && obj.name.trim()) ||
          fallbackName ||
          "PDF shablon",
        elements: obj.elements as PdfElement[],
        createdAt: typeof obj.createdAt === "string" ? obj.createdAt : now,
        updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : now,
        storageId:
          typeof obj.storageId === "number" && Number.isFinite(obj.storageId)
            ? obj.storageId
            : null,
        globalStorageId:
          typeof obj.globalStorageId === "number" && Number.isFinite(obj.globalStorageId)
            ? obj.globalStorageId
            : null,
        analysisId: Number.isFinite(analysisIdRaw) && analysisIdRaw > 0 ? analysisIdRaw : null,
        analysisName: typeof obj.analysisName === "string" ? obj.analysisName : "",
      };
    }
  }

  // Legacy: bare elements array
  if (Array.isArray(parsed)) {
    return {
      id: createTemplateId(),
      name: fallbackName || "PDF shablon",
      elements: parsed as PdfElement[],
      createdAt: now,
      updatedAt: now,
      storageId: null,
      analysisId: null,
      analysisName: "",
    };
  }

  return null;
}

export function onlineStorageRecordToPdfTemplate(
  record: OnlineStorage,
): PdfTemplate | null {
  const tpl = parsePdfTemplateFromStorageText(record.text, record.name);
  if (!tpl) return null;

  const analysisId =
    Number(record.analysis_id ?? record.analysisId ?? record.analysis?.id) ||
    Number(tpl.analysisId) ||
    null;
  const analysisName =
    record.analysis?.name?.trim() || tpl.analysisName?.trim() || "";

  if (analysisId && analysisId > 0) {
    const table = tpl.elements.find(el => el.type === "table");
    if (table && !table.analysisId) {
      table.analysisId = analysisId;
      if (analysisName) table.analysisName = analysisName;
    }
  }

  return {
    ...tpl,
    id: `storage-${record.id}`,
    name: record.name?.trim() || tpl.name,
    storageId: record.id,
    analysisId: analysisId && analysisId > 0 ? analysisId : null,
    analysisName,
    createdAt: record.createdAt || tpl.createdAt,
    updatedAt: record.updatedAt || tpl.updatedAt,
  };
}

export async function fetchPdfTemplatesFromApi(): Promise<PdfTemplate[]> {
  const records = await getAllOnlineStorages();
  const templates = records
    .map(onlineStorageRecordToPdfTemplate)
    .filter((t): t is PdfTemplate => t != null);

  // Always mirror API (company-scoped) into session cache — never keep another company's drafts
  savePdfTemplates(templates);

  const activeId = getActiveTemplateId();
  if (activeId && !templates.some(t => t.id === activeId)) {
    setActiveTemplateId(templates[0]?.id ?? null);
  } else if (!activeId && templates[0]) {
    setActiveTemplateId(templates[0].id);
  } else if (templates.length === 0) {
    setActiveTemplateId(null);
  }

  return templates;
}

export async function upsertPdfTemplateRemote(template: PdfTemplate): Promise<PdfTemplate> {
  const analysisId = resolvePdfTemplateAnalysisId(template);
  if (analysisId == null) {
    throw new Error("Shablon uchun analiz tanlang, keyin saqlang");
  }

  const now = new Date().toISOString();
  const next: PdfTemplate = {
    ...template,
    name: template.name.trim() || "PDF shablon",
    updatedAt: now,
    createdAt: template.createdAt || now,
  };

  const payload = {
    name: next.name,
    text: pdfTemplateToStoragePayload(next),
    analysis_id: analysisId,
  };

  let storageId = next.storageId ?? null;
  if (storageId != null && storageId > 0) {
    await updateOnlineStorage(storageId, payload);
  } else {
    const created = await addOnlineStorage(payload);
    storageId = extractOnlineStorageId(created);
    if (storageId == null) {
      throw new Error("Server yangi shablon id qaytarmadi");
    }
  }

  const saved: PdfTemplate = { ...next, storageId };
  upsertPdfTemplate(saved);
  return saved;
}

export async function deletePdfTemplateRemote(template: PdfTemplate): Promise<void> {
  if (template.storageId != null && template.storageId > 0) {
    await deleteOnlineStorage(template.storageId);
  }
  deletePdfTemplate(template.id);
}

export function globalStorageRecordToPdfTemplate(
  record: GlobalStorage,
): PdfTemplate | null {
  const tpl = parsePdfTemplateFromStorageText(record.text, record.name);
  if (!tpl) return null;

  const analysisId =
    Number(record.analysis_id ?? record.analysisId ?? record.analysis?.id) ||
    Number(tpl.analysisId) ||
    null;
  const analysisName =
    record.analysis?.name?.trim() || tpl.analysisName?.trim() || "";
  const companyId =
    Number(record.company_id ?? record.companyId ?? record.company?.id) || null;
  const companyName = record.company?.name?.trim() || tpl.companyName?.trim() || "";

  if (analysisId && analysisId > 0) {
    const table = tpl.elements.find(el => el.type === "table");
    if (table && !table.analysisId) {
      table.analysisId = analysisId;
      if (analysisName) table.analysisName = analysisName;
    }
  }

  return {
    ...tpl,
    id: `global-${record.id}`,
    name: record.name?.trim() || tpl.name,
    storageId: null,
    globalStorageId: record.id,
    companyId: companyId && companyId > 0 ? companyId : null,
    companyName,
    analysisId: analysisId && analysisId > 0 ? analysisId : null,
    analysisName,
    createdAt: record.createdAt || tpl.createdAt,
    updatedAt: record.updatedAt || tpl.updatedAt,
  };
}

/** Clone a global template so PDF tab can save it into this company's online storage */
export function cloneGlobalTemplateForLocalEdit(template: PdfTemplate): PdfTemplate {
  const now = new Date().toISOString();
  const cloned = structuredClone(template);
  return {
    ...cloned,
    id: createTemplateId(),
    storageId: null,
    globalStorageId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function fetchGlobalPdfTemplates(): Promise<PdfTemplate[]> {
  const records = await getAllGlobalStorages();
  return records
    .map(globalStorageRecordToPdfTemplate)
    .filter((t): t is PdfTemplate => t != null);
}

export async function upsertPdfTemplateGlobal(template: PdfTemplate): Promise<PdfTemplate> {
  const analysisId = resolvePdfTemplateAnalysisId(template);
  if (analysisId == null) {
    throw new Error("Shablon uchun analiz tanlang, keyin saqlang");
  }

  const companyId = getStoredCompanyId();
  if (companyId == null) {
    throw new Error("Kompaniya aniqlanmadi — qayta kiring");
  }

  const now = new Date().toISOString();
  const next: PdfTemplate = {
    ...template,
    name: template.name.trim() || "PDF shablon",
    updatedAt: now,
    createdAt: template.createdAt || now,
  };

  const payload = {
    name: next.name,
    text: pdfTemplateToStoragePayload(next),
    analysis_id: analysisId,
    company_id: companyId,
  };

  let globalStorageId = next.globalStorageId ?? null;
  if (globalStorageId != null && globalStorageId > 0) {
    await updateGlobalStorage(globalStorageId, payload);
  } else {
    const created = await addGlobalStorage(payload);
    globalStorageId = extractGlobalStorageId(created);
    if (globalStorageId == null) {
      throw new Error("Server yangi global shablon id qaytarmadi");
    }
  }

  return {
    ...next,
    globalStorageId,
    companyId,
  };
}

export async function deletePdfTemplateGlobal(template: PdfTemplate): Promise<void> {
  if (template.globalStorageId != null && template.globalStorageId > 0) {
    await deleteGlobalStorage(template.globalStorageId);
  }
}
