import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, FileBarChart2, X, Loader2, CheckCircle, AlertCircle,
  ArrowLeft, Save, FileText, Lock,
} from "lucide-react";
import {
  getAllOrders,
  getOrderById,
  resolveOrderItemAnalysisId,
  updateOrderItemStatus,
  type Order,
  type OrderItem,
  type OrderPatient,
} from "@/api/order";
import { getAllPatterns, resolvePatternAnalysisId, type Pattern } from "@/api/pattern";
import {
  addResult,
  buildResultItemFromGrid,
  decodeGridFillFromItems,
  findResultByOrderId,
  getAllResults,
  getResultById,
  getResultItems,
  updateResult,
  type ResultRecord,
} from "@/api/result";
import { getStoredUser } from "@/api/auth";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { statusLabel } from "@/lib/orderStatus";
import { CustomPdfTable } from "@/components/CustomPdfTable";
import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_SCALE,
  A4_PREVIEW_WIDTH,
  bodyCellKey,
  formatDynamicDisplay,
  getActivePdfTemplate,
  loadPdfTemplates,
  normalizeTableData,
  type PdfDynamicContext,
  type PdfElement,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

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
      const savedForAnalysis = savedItems.some(ri => Number(ri.analysis_id) === analysisId);
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

function resolveTemplateForAnalysis(analysisId: number, analysisName: string): PdfTemplate | null {
  const list = loadPdfTemplates();
  const active = getActivePdfTemplate();
  const candidates = active ? [active, ...list.filter(t => t.id !== active.id)] : list;

  const base =
    candidates.find(t => t.elements.some(el => el.type === "table" && el.analysisId === analysisId)) ||
    candidates.find(t => t.elements.some(el => el.type === "table")) ||
    active ||
    list[0] ||
    null;

  if (!base) return null;

  const cloned = structuredClone(base) as PdfTemplate;
  const table = cloned.elements.find(el => el.type === "table");
  if (table) {
    table.analysisId = analysisId;
    table.analysisName = analysisName;
  }
  return cloned;
}

export function ResultsPage({ primaryColor }: { primaryColor: string }) {
  const [rows, setRows] = useState<OrderAnalysisRow[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [resultsCache, setResultsCache] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [selected, setSelected] = useState<OrderAnalysisRow | null>(null);
  const [template, setTemplate] = useState<PdfTemplate | null>(null);
  const [bodyPatterns, setBodyPatterns] = useState<Pattern[]>([]);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [dynamicCtx, setDynamicCtx] = useState<PdfDynamicContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [ordersRaw, p, results] = await Promise.all([
        getAllOrders(),
        getAllPatterns().catch(() => [] as Pattern[]),
        getAllResults().catch(() => [] as ResultRecord[]),
      ]);
      const orders = Array.isArray(ordersRaw)
        ? ordersRaw
        : ((ordersRaw as { data?: Order[]; orders?: Order[] })?.data ??
          (ordersRaw as { orders?: Order[] })?.orders ??
          []);
      setPatterns(p);
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
    try {
      const tpl = resolveTemplateForAnalysis(row.analysisId, row.analysisName);
      setTemplate(tpl);

      let order: Order | null = null;
      try {
        order = await getOrderById(row.orderId);
      } catch {
        /* optional */
      }

      let allPatterns = patterns;
      try {
        allPatterns = await getAllPatterns();
        setPatterns(allPatterns);
      } catch {
        /* cached */
      }
      const related = allPatterns.filter(p => resolvePatternAnalysisId(p) === row.analysisId);
      setBodyPatterns(related);

      let resultRec: ResultRecord | null = null;
      let savedItems: ReturnType<typeof getResultItems> = [];

      if (row.resultId) {
        try {
          resultRec = await getResultById(row.resultId);
          savedItems = getResultItems(resultRec);
        } catch {
          resultRec = findResultByOrderId(resultsCache, row.orderId);
          savedItems = resultRec ? getResultItems(resultRec) : [];
        }
      } else {
        resultRec = findResultByOrderId(resultsCache, row.orderId);
        savedItems = resultRec ? getResultItems(resultRec) : [];
      }

      setDynamicCtx(buildDynamicContext(row, order, resultRec));
      setFillValues(decodeGridFillFromItems(savedItems, row.analysisId));

      if (related.length === 0) {
        pushToast(
          `Analiz #${row.analysisId} uchun pattern topilmadi. Boshqaruv → Analiz shablonlarida yarating.`,
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
    setBodyPatterns([]);
    setFillValues({});
    setDynamicCtx(null);
  };

  const updateFill = (patternId: number | string, col: number, value: string) => {
    const key = bodyCellKey(patternId, col);
    setFillValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveValues = async () => {
    if (!selected) return;
    const user = getStoredUser();
    if (!user?.id) {
      pushToast("Foydalanuvchi topilmadi — qayta kiring", "error");
      return;
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
        ? getResultItems(existing).filter(ri => Number(ri.analysis_id) !== selected.analysisId)
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

      const savedId = saved.id;
      setResultsCache(list => {
        const without = list.filter(
          r => r.id !== savedId && findResultByOrderId([r], selected.orderId) == null,
        );
        return [...without, saved];
      });
      setRows(list =>
        list.map(r =>
          r.orderId === selected.orderId
            ? {
                ...r,
                resultId: savedId,
                hasSavedValues: r.analysisId === selected.analysisId ? true : r.hasSavedValues,
                itemStatus:
                  r.orderItemId === selected.orderItemId ? "completed" : r.itemStatus,
              }
            : r,
        ),
      );
      setSelected(s =>
        s
          ? { ...s, resultId: savedId, hasSavedValues: true, itemStatus: "completed" }
          : s,
      );

      try {
        if (selected.itemStatus !== "completed" && selected.itemStatus !== "canceled") {
          await updateOrderItemStatus(selected.orderItemId, "completed");
        }
      } catch {
        /* optional */
      }

      pushToast(existing?.id ? "Natija yangilandi" : "Natija saqlandi");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlab bo'lmadi", "error");
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    const hasTable = Boolean(template?.elements.some(el => el.type === "table"));
    const tableEl = template?.elements.find(el => el.type === "table");
    const grid = normalizeTableData(tableEl?.tableData);
    const inputCols = Math.max(0, grid.cols - 1);

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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-[11px] text-muted-foreground">
            <Lock className="w-3 h-3" /> Faqat jadval inputlari
          </div>
          <button
            type="button"
            disabled={saving || !hasTable}
            onClick={() => void handleSaveValues()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: primaryColor }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {selected.resultId ? "Yangilash" : "Saqlash"}
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
                  Header {grid.headerRows} qator · {grid.cols} ustun · Patternlar:{" "}
                  {bodyPatterns.length} · Input ustunlar: {inputCols}
                </p>
              </div>
              <span
                className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(selected.itemStatus)}`}
              >
                {statusLabel(selected.itemStatus)}
              </span>
            </div>
            <div className="p-4 md:p-6 overflow-auto ses-scrollbar bg-secondary/40 flex justify-center max-h-[calc(100vh-180px)]">
              <ResultPdfCanvas
                template={template}
                patterns={bodyPatterns}
                fillValues={fillValues}
                dynamicCtx={dynamicCtx}
                onFillChange={updateFill}
              />
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

function ResultPdfCanvas({
  template,
  patterns,
  fillValues,
  dynamicCtx,
  onFillChange,
}: {
  template: PdfTemplate;
  patterns: Pattern[];
  fillValues: Record<string, string>;
  dynamicCtx: PdfDynamicContext | null;
  onFillChange: (patternId: number | string, col: number, value: string) => void;
}) {
  const tableEl = template.elements.find(el => el.type === "table");
  const grid = normalizeTableData(tableEl?.tableData);
  const pageHeight = Math.max(
    A4_PREVIEW_HEIGHT,
    A4_PREVIEW_HEIGHT + Math.max(0, patterns.length - 8) * 18 + grid.headerRows * 8,
  );

  return (
    <div
      className="relative bg-white shadow-xl border border-slate-200 shrink-0"
      style={{ width: A4_PREVIEW_WIDTH, height: pageHeight }}
    >
      {template.elements.map(el => (
        <FillableElement
          key={el.id}
          element={el}
          patterns={patterns}
          fillValues={fillValues}
          dynamicCtx={dynamicCtx}
          onFillChange={onFillChange}
        />
      ))}
    </div>
  );
}

function FillableElement({
  element,
  patterns,
  fillValues,
  dynamicCtx,
  onFillChange,
}: {
  element: PdfElement;
  patterns: Pattern[];
  fillValues: Record<string, string>;
  dynamicCtx: PdfDynamicContext | null;
  onFillChange: (patternId: number | string, col: number, value: string) => void;
}) {
  const isTable = element.type === "table";

  const textStyle: React.CSSProperties = {
    fontWeight: element.style.bold ? 700 : 400,
    fontStyle: element.style.italic ? "italic" : "normal",
    textDecoration: element.style.underline ? "underline" : "none",
    fontSize: (element.style.fontSize ?? 12) * A4_PREVIEW_SCALE,
    textAlign: element.style.align || "left",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#0f172a",
    lineHeight: 1.35,
    pointerEvents: "none",
    userSelect: "none",
  };

  return (
    <div
      className="absolute"
      style={{
        left: element.x * A4_PREVIEW_SCALE,
        top: element.y * A4_PREVIEW_SCALE,
        width: element.width * A4_PREVIEW_SCALE,
        minHeight: element.height * A4_PREVIEW_SCALE,
        zIndex: isTable ? 20 : 1,
        pointerEvents: isTable ? "auto" : "none",
      }}
    >
      {element.type === "image" ? (
        element.imageSrc ? (
          <img
            src={element.imageSrc}
            alt=""
            className="w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
        ) : null
      ) : element.type === "table" ? (
        <div className="w-full bg-white" style={{ pointerEvents: "auto" }}>
          <CustomPdfTable
            data={normalizeTableData(element.tableData)}
            patterns={patterns.map(p => ({ id: p.id, name: p.name }))}
            fillValues={fillValues}
            onFillChange={onFillChange}
            compact
          />
        </div>
      ) : element.type === "dynamic" ? (
        <div style={textStyle}>{formatDynamicDisplay(element, dynamicCtx, false).full}</div>
      ) : (
        <div style={textStyle}>{element.content || " "}</div>
      )}
    </div>
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
