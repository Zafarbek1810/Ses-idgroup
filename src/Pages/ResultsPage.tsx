import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Search, RefreshCw, FileBarChart2, X, Loader2, CheckCircle, AlertCircle,
  ArrowLeft, Save, FileText, Lock, Download, ZoomIn, ZoomOut,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import {
  getAllOrders,
  getOrderById,
  resolveOrderItemAnalysisId,
  type Order,
  type OrderItem,
  type OrderPatient,
} from "@/api/order";
import {
  addResult,
  buildResultItemFromGrid,
  decodeGridFillFromItems,
  findResultByOrderId,
  getAllResults,
  getResultById,
  getResultItems,
  resolveResultItemAnalysisId,
  updateResult,
  type ResultRecord,
} from "@/api/result";
import { getStoredUser } from "@/api/auth";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { statusLabel } from "@/lib/orderStatus";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import {
  A4_HEIGHT,
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_WIDTH,
  A4_WIDTH,
  bodyCellKey,
  fetchPdfTemplatesFromApi,
  getActivePdfTemplate,
  headerCellKey,
  isDynamicCell,
  loadPdfTemplates,
  normalizeTableData,
  type PdfDynamicContext,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

const PDF_ZOOM_MIN = 0.5;
const PDF_ZOOM_MAX = 2;
const PDF_ZOOM_STEP = 0.1;
const PDF_ZOOM_DEFAULT = 1;

type OrderAnalysisRow = {
  key: string;
  orderId: number;
  orderItemId: number;
  analysisId: number;
  analysisName: string;
  laboratoryName: string;
  laboratoryId: number | null;
  itemStatus: string;
  patientName: string;
  orderCreatedAt?: string;
  resultId: number | null;
  hasSavedValues: boolean;
};

function patientNameFromOrder(patient: OrderPatient | null | undefined, fallback?: string | null) {
  if (!patient) return fallback?.trim() || "—";
  return `${patient.last_name ?? ""} ${patient.first_name ?? ""}`.trim() || "—";
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "pending":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "in_progress":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
    case "canceled":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

function flattenOrderAnalyses(
  orders: Order[],
  results: ResultRecord[],
): OrderAnalysisRow[] {
  const rows: OrderAnalysisRow[] = [];
  for (const order of orders) {
    const existing = findResultByOrderId(results, order.id);
    const savedItems = existing ? getResultItems(existing) : [];
    const orderItems = (order.items ?? []) as OrderItem[];
    for (const item of orderItems) {
      const analysisId = resolveOrderItemAnalysisId(item);
      if (!analysisId) continue;
      const savedForAnalysis = savedItems.some(
        ri => resolveResultItemAnalysisId(ri) === analysisId,
      );
      rows.push({
        key: `${order.id}-${item.id}`,
        orderId: order.id,
        orderItemId: item.id,
        analysisId,
        analysisName: item.analysis?.name ?? `Analiz #${analysisId}`,
        laboratoryName: item.laboratory?.name ?? "—",
        laboratoryId: item.laboratory?.id ?? null,
        itemStatus: String(item.status || "pending"),
        patientName: patientNameFromOrder(order.patient, order.name),
        orderCreatedAt: item.createdAt || order.createdAt,
        resultId: existing?.id ?? null,
        hasSavedValues: savedForAnalysis,
      });
    }
  }
  rows.sort((a, b) => {
    const ta = a.orderCreatedAt ? Date.parse(a.orderCreatedAt) : 0;
    const tb = b.orderCreatedAt ? Date.parse(b.orderCreatedAt) : 0;
    return tb - ta;
  });
  return rows;
}

function buildAddress(order: Order, patient: OrderPatient | null | undefined) {
  const parts = [
    patient?.village || order.village,
    patient?.street || order.street,
    order.district?.name,
  ].filter(Boolean);
  return parts.join(", ") || "—";
}

function buildDynamicContext(
  row: OrderAnalysisRow,
  order: Order | null,
  result: ResultRecord | null,
): PdfDynamicContext {
  const patient = order?.patient;
  const user = getStoredUser();
  const doctorName = user
    ? `${(user.username || "").charAt(0).toUpperCase()}.${user.surname || ""}`.replace(/^\./, "").replace(/\.$/, "") ||
      null
    : null;

  return {
    orderId: row.orderId,
    orderCreatedAt: order?.createdAt || row.orderCreatedAt || null,
    resultDate: result?.updatedAt || result?.createdAt || new Date().toISOString(),
    patientFullName: patientNameFromOrder(patient, order?.name),
    patientAddress: order ? buildAddress(order, patient) : null,
    patientBirthDay: patient?.birth_day ?? null,
    patientPhone: patient?.phone ?? null,
    labDoctor: doctorName,
    analysisName: row.analysisName,
    laboratoryName: row.laboratoryName !== "—" ? row.laboratoryName : null,
  };
}

function bindTemplateToAnalysis(
  base: PdfTemplate,
  analysisId: number,
  analysisName: string,
): PdfTemplate {
  const cloned = structuredClone(base) as PdfTemplate;
  const table = cloned.elements.find(el => el.type === "table");
  if (table) {
    table.analysisId = analysisId;
    table.analysisName = analysisName;
  }
  return cloned;
}

function resolveTemplateForAnalysis(
  analysisId: number,
  analysisName: string,
  list: PdfTemplate[] = loadPdfTemplates(),
): PdfTemplate | null {
  const active = getActivePdfTemplate();
  const candidates = active ? [active, ...list.filter(t => t.id !== active.id)] : list;

  const base =
    candidates.find(t => t.analysisId === analysisId) ||
    candidates.find(t => t.elements.some(el => el.type === "table" && el.analysisId === analysisId)) ||
    candidates.find(t => t.elements.some(el => el.type === "table")) ||
    active ||
    list[0] ||
    null;

  if (!base) return null;
  return bindTemplateToAnalysis(base, analysisId, analysisName);
}

/** Seed fill map from dynamic cells only; saved values win when present */
function seedFillFromTemplate(
  tpl: PdfTemplate | null,
  saved: Record<string, string> = {},
): Record<string, string> {
  const table = tpl?.elements.find(el => el.type === "table");
  const grid = normalizeTableData(table?.tableData);
  const next: Record<string, string> = {};

  for (let r = 0; r < grid.headerRows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.headerCells[r][c];
      if (cell.covered || !isDynamicCell(cell)) continue;
      const key = headerCellKey(r, c);
      next[key] = Object.prototype.hasOwnProperty.call(saved, key)
        ? String(saved[key] ?? "")
        : "";
    }
  }

  for (let r = 0; r < grid.bodyRows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.bodyCells[r][c];
      if (cell.covered || !isDynamicCell(cell)) continue;
      const key = bodyCellKey(r, c);
      next[key] = Object.prototype.hasOwnProperty.call(saved, key)
        ? String(saved[key] ?? "")
        : "";
    }
  }
  return next;
}

export function ResultsPage({ primaryColor }: { primaryColor: string }) {
  const [rows, setRows] = useState<OrderAnalysisRow[]>([]);
  const [resultsCache, setResultsCache] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [selected, setSelected] = useState<OrderAnalysisRow | null>(null);
  const [template, setTemplate] = useState<PdfTemplate | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<PdfTemplate[]>([]);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [dynamicCtx, setDynamicCtx] = useState<PdfDynamicContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(PDF_ZOOM_DEFAULT);
  const pdfRef = useRef<HTMLDivElement>(null);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [ordersRaw, results] = await Promise.all([
        getAllOrders(),
        getAllResults().catch(() => [] as ResultRecord[]),
      ]);
      const orders = Array.isArray(ordersRaw)
        ? ordersRaw
        : ((ordersRaw as { data?: Order[]; orders?: Order[] })?.data ??
          (ordersRaw as { orders?: Order[] })?.orders ??
          []);
      setResultsCache(results);
      setRows(flattenOrderAnalyses(orders, results));
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const hay = [
        String(r.orderId),
        String(r.orderItemId),
        r.patientName,
        r.analysisName,
        r.laboratoryName,
        r.itemStatus,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const openRow = async (row: OrderAnalysisRow) => {
    setOpening(true);
    setSelected(row);
    setPdfZoom(PDF_ZOOM_DEFAULT);
    try {
      const allTemplates = await fetchPdfTemplatesFromApi().catch(() => [] as PdfTemplate[]);
      setAvailableTemplates(allTemplates);
      const tpl = resolveTemplateForAnalysis(row.analysisId, row.analysisName, allTemplates);
      setTemplate(tpl);

      let order: Order | null = null;
      try {
        order = await getOrderById(row.orderId);
      } catch {
        /* optional */
      }

      let resultRec: ResultRecord | null = null;
      let savedItems: ReturnType<typeof getResultItems> = [];
      const cachedRec = findResultByOrderId(resultsCache, row.orderId);

      if (row.resultId) {
        try {
          resultRec = await getResultById(row.resultId);
          savedItems = getResultItems(resultRec);
        } catch {
          resultRec = cachedRec;
          savedItems = resultRec ? getResultItems(resultRec) : [];
        }
      } else {
        resultRec = cachedRec;
        savedItems = resultRec ? getResultItems(resultRec) : [];
      }

      // getby sometimes omits nested items — fall back to cache for fills
      if (savedItems.length === 0 && cachedRec) {
        const cachedItems = getResultItems(cachedRec);
        if (cachedItems.length > 0) {
          savedItems = cachedItems;
          if (!resultRec) resultRec = cachedRec;
        }
      }

      setDynamicCtx(buildDynamicContext(row, order, resultRec));
      const saved = decodeGridFillFromItems(savedItems, row.analysisId);
      setFillValues(seedFillFromTemplate(tpl, saved));

      if (!tpl?.elements.some(el => el.type === "table")) {
        pushToast(
          "PDF jadval shabloni topilmadi. Boshqaruv → PDF shablonida yarating.",
          "error",
        );
      }
    } finally {
      setOpening(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setTemplate(null);
    setAvailableTemplates([]);
    setFillValues({});
    setDynamicCtx(null);
    setPdfZoom(PDF_ZOOM_DEFAULT);
  };

  const zoomIn = () =>
    setPdfZoom(z => Math.min(PDF_ZOOM_MAX, Math.round((z + PDF_ZOOM_STEP) * 10) / 10));
  const zoomOut = () =>
    setPdfZoom(z => Math.max(PDF_ZOOM_MIN, Math.round((z - PDF_ZOOM_STEP) * 10) / 10));
  const zoomReset = () => setPdfZoom(PDF_ZOOM_DEFAULT);

  const handleTemplateChange = (templateId: string) => {
    if (!selected) return;
    const base = availableTemplates.find(t => t.id === templateId);
    if (!base) return;
    const next = bindTemplateToAnalysis(base, selected.analysisId, selected.analysisName);
    setTemplate(next);
    setFillValues(prev => seedFillFromTemplate(next, prev));
  };

  const updateFill = (key: string, value: string) => {
    setFillValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveValues = async (): Promise<boolean> => {
    if (!selected) return false;
    const user = getStoredUser();
    if (!user?.id) {
      pushToast("Foydalanuvchi topilmadi — qayta kiring", "error");
      return false;
    }

    setSaving(true);
    try {
      const newItem = buildResultItemFromGrid(selected.analysisId, fillValues);

      let existing: ResultRecord | null = null;
      if (selected.resultId) {
        try {
          existing = await getResultById(selected.resultId);
        } catch {
          existing = findResultByOrderId(resultsCache, selected.orderId);
        }
      } else {
        existing = findResultByOrderId(resultsCache, selected.orderId);
      }

      const otherItems = existing
        ? getResultItems(existing).filter(
            ri => resolveResultItemAnalysisId(ri) !== selected.analysisId,
          )
        : [];

      const payload = {
        order_id: selected.orderId,
        lab_director_id: user.id,
        result_item: [...otherItems, newItem],
      };

      let saved: ResultRecord;
      if (existing?.id) {
        saved = await updateResult(existing.id, payload);
      } else {
        saved = await addResult(payload);
      }

      // Always keep the items we just saved in cache (API may omit nested items)
      const cached: ResultRecord = {
        ...saved,
        id: saved.id || existing?.id || 0,
        order_id: selected.orderId,
        result_item:
          getResultItems(saved).length > 0 ? getResultItems(saved) : payload.result_item,
      };

      const savedId = cached.id;
      setResultsCache(list => {
        const without = list.filter(
          r => r.id !== savedId && findResultByOrderId([r], selected.orderId) == null,
        );
        return [...without, cached];
      });
      setRows(list =>
        list.map(r =>
          r.orderId === selected.orderId
            ? {
                ...r,
                resultId: savedId,
                hasSavedValues: r.analysisId === selected.analysisId ? true : r.hasSavedValues,
              }
            : r,
        ),
      );
      setSelected(s =>
        s
          ? { ...s, resultId: savedId, hasSavedValues: true }
          : s,
      );

      pushToast(existing?.id ? "Natija yangilandi" : "Natija saqlandi");
      return true;
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlab bo'lmadi", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selected || !template || !hasTableReady()) return;

    setDownloading(true);
    try {
      const saved = await handleSaveValues();
      if (!saved) return;

      flushSync(() => setExporting(true));
      await new Promise(r => setTimeout(r, 80));

      const el = pdfRef.current;
      if (!el) {
        pushToast("PDF element topilmadi", "error");
        return;
      }

      const captureScale = 2;
      const canvas = await html2canvas(el, {
        scale: captureScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (_doc, cloned) => {
          // scale:2 → 0.5px CSS = 1px in the final bitmap/PDF
          const border = `${1 / captureScale}px solid #000`;
          cloned.querySelectorAll("table").forEach(t => {
            const table = t as HTMLElement;
            table.style.border = "none";
            table.style.borderCollapse = "collapse";
            table.style.borderSpacing = "0";
          });
          cloned.querySelectorAll("th, td").forEach(cell => {
            const node = cell as HTMLElement;
            node.style.border = border;
            node.style.outline = "none";
            node.style.boxShadow = "none";
          });
        },
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [A4_WIDTH, A4_HEIGHT],
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL("image/png");

      // Preview px → A4 pt; float rounding often makes imgH ≈ pageH + 0.5pt
      let imgW = pageW;
      let imgH = (canvas.height * imgW) / canvas.width;

      if (imgH <= pageH * 1.02) {
        // One A4 page — fit exactly, no blank 2nd page
        const fit = Math.min(1, pageH / imgH);
        imgW *= fit;
        imgH *= fit;
        pdf.addImage(imgData, "PNG", (pageW - imgW) / 2, 0, imgW, imgH);
      } else {
        let heightLeft = imgH;
        let position = 0;
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
        while (heightLeft > pageH * 0.02) {
          position = heightLeft - imgH;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
          heightLeft -= pageH;
        }
      }

      const safeName = selected.analysisName
        .replace(/[^\w\u0400-\u04FF\u0500-\u052F\-]+/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 60);
      pdf.save(`natija_${selected.orderId}_${safeName || "analiz"}.pdf`);
      pushToast("PDF yuklab olindi");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "PDF yuklab bo'lmadi", "error");
    } finally {
      setExporting(false);
      setDownloading(false);
    }
  };

  const hasTableReady = () => Boolean(template?.elements.some(el => el.type === "table"));

  if (selected) {
    const hasTable = Boolean(template?.elements.some(el => el.type === "table"));
    const tableEl = template?.elements.find(el => el.type === "table");
    const grid = normalizeTableData(tableEl?.tableData);
    const previewPageHeight = Math.max(
      A4_PREVIEW_HEIGHT,
      A4_PREVIEW_HEIGHT + Math.max(0, grid.bodyRows - 8) * 18 + grid.headerRows * 8,
    );

    return (
      <main className="flex-1 overflow-y-auto p-6 space-y-4 ses-scrollbar">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={closeDetail}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Orqaga
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-foreground">
              {selected.analysisName}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Buyurtma #{selected.orderId} · {selected.patientName}
              {selected.laboratoryName !== "—" ? ` · ${selected.laboratoryName}` : ""}
              {selected.resultId ? ` · Result #${selected.resultId}` : ""}
            </p>
          </div>
          <label className="flex items-center gap-2 min-w-[200px] max-w-xs">
            <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
              Shablon
            </span>
            <select
              value={template?.id ?? ""}
              disabled={opening || availableTemplates.length === 0}
              onChange={e => handleTemplateChange(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[12px] font-medium text-foreground focus:outline-none focus:border-[var(--primary)] disabled:opacity-50"
            >
              {availableTemplates.length === 0 ? (
                <option value="">Shablon yo&apos;q</option>
              ) : (
                availableTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-[11px] text-muted-foreground">
            <Lock className="w-3 h-3" /> Faqat jadval inputlari
          </div>
          <button
            type="button"
            disabled={saving || downloading || !hasTable}
            onClick={() => void handleSaveValues()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: primaryColor }}
          >
            {saving && !downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {selected.resultId ? "Yangilash" : "Saqlash"}
          </button>
          <button
            type="button"
            disabled={saving || downloading || !hasTable || opening}
            onClick={() => void handleDownloadPdf()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground border border-border hover:opacity-90 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Yuklab olish
          </button>
        </div>

        {opening ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
          </div>
        ) : !template ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13px] font-medium text-foreground">PDF shablon topilmadi</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Avval Boshqaruv → PDF shablon bo&apos;limida shablon yarating va saqlang
            </p>
          </div>
        ) : !hasTable ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13px] font-medium text-foreground">Shablonda jadval yo&apos;q</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              PDF shablonga Jadval instrumentini qo&apos;shing va o&apos;zingiz chizing
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">{template.name}</h3>
                <p className="text-[11px] text-muted-foreground">
                  Header {grid.headerRows} · Body {grid.bodyRows} · {grid.cols} ustun
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-0.5 rounded-xl bg-secondary border border-border p-0.5">
                  <button
                    type="button"
                    title="Uzoqlashtirish"
                    disabled={pdfZoom <= PDF_ZOOM_MIN}
                    onClick={zoomOut}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-foreground hover:bg-card disabled:opacity-40"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Masshtabni tiklash"
                    onClick={zoomReset}
                    className="min-w-[3.25rem] px-1.5 h-8 rounded-lg text-[11px] font-semibold text-foreground hover:bg-card tabular-nums"
                  >
                    {Math.round(pdfZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    title="Yaqinlashtirish"
                    disabled={pdfZoom >= PDF_ZOOM_MAX}
                    onClick={zoomIn}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-foreground hover:bg-card disabled:opacity-40"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(selected.itemStatus)}`}
                >
                  {statusLabel(selected.itemStatus)}
                </span>
              </div>
            </div>
            <div className="p-4 md:p-6 overflow-auto ses-scrollbar bg-secondary/40 max-h-[calc(100vh-180px)]">
              <div
                className="mx-auto"
                style={{
                  width: A4_PREVIEW_WIDTH * pdfZoom,
                  height: previewPageHeight * pdfZoom,
                }}
              >
                <div
                  style={{
                    width: A4_PREVIEW_WIDTH,
                    transform: `scale(${pdfZoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <ResultPdfCanvas
                    ref={pdfRef}
                    template={template}
                    fillValues={fillValues}
                    dynamicCtx={dynamicCtx}
                    onFillChange={updateFill}
                    readOnly={exporting}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <ToastStack toasts={toasts} setToasts={setToasts} />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Qidirish: bemor, analiz, buyurtma..."
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-secondary text-[12px] font-semibold text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Yangilash
        </button>
        <div className="text-[12px] text-muted-foreground ml-auto">
          Jami analizlar: <span className="font-semibold text-foreground">{filtered.length}</span>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FileBarChart2 className="w-4 h-4" style={{ color: primaryColor }} />
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Natijalar</h2>
            <p className="text-[11px] text-muted-foreground">
              Buyurtmadagi analizlar — PDF shablon orqali natija kiritish
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            Buyurtmalarda analiz topilmadi
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Buyurtma</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bemor</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Analiz</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Laboratoriya</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Holat</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Natija</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sana</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.key}
                    onClick={() => void openRow(r)}
                    className="border-b border-border last:border-0 hover:bg-secondary/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-[13px] font-medium text-foreground">#{r.orderId}</td>
                    <td className="px-4 py-3 text-[13px] text-foreground">{r.patientName}</td>
                    <td className="px-4 py-3 text-[13px] text-foreground font-medium">{r.analysisName}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">{r.laboratoryName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(r.itemStatus)}`}>
                        {statusLabel(r.itemStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.hasSavedValues ? (
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-700">
                          Saqlangan
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary text-muted-foreground">
                          Kiritilmagan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {r.orderCreatedAt ? formatDate(r.orderCreatedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[11px] font-semibold" style={{ color: primaryColor }}>
                        PDF ochish
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ToastStack toasts={toasts} setToasts={setToasts} />
    </main>
  );
}

function ToastStack({
  toasts,
  setToasts,
}: {
  toasts: ToastMsg[];
  setToasts: React.Dispatch<React.SetStateAction<ToastMsg[]>>;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[60] space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white ${
            t.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {t.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {t.text}
          <button
            type="button"
            onClick={() => setToasts(list => list.filter(x => x.id !== t.id))}
            className="ml-1 opacity-80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
