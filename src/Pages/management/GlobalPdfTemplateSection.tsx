import * as React from "react";
import { useEffect, useState } from "react";
import {
  Search,
  RefreshCw,
  FileType,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit3,
  Trash2,
  ArrowLeft,
  Building2,
  TestTube2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Eye,
} from "lucide-react";
import {
  deleteGlobalStorage,
  getAllGlobalStorages,
  getGlobalStorageById,
  getGlobalStoragesFull,
  type GlobalStorage,
} from "@/api/globalStorage";
import { ApiError } from "@/api/client";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import { formatDate } from "@/lib/formatDate";
import {
  cloneGlobalTemplateForLocalEdit,
  globalStorageRecordToPdfTemplate,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

type AnalysisOption = { id: number; name: string };

const PER_PAGE = 10;

/** Select uchun — getfull/getall dagi nested `analysis` obyektlaridan */
function extractAnalysesFromRecords(records: GlobalStorage[]): AnalysisOption[] {
  const map = new Map<number, AnalysisOption>();
  for (const r of records) {
    const id = Number(r.analysis?.id ?? r.analysis_id ?? r.analysisId);
    if (!Number.isFinite(id) || id <= 0) continue;
    const name = r.analysis?.name?.trim() || `Analiz #${id}`;
    if (!map.has(id)) map.set(id, { id, name });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "uz"));
}

function mergeAnalysisOptions(
  prev: AnalysisOption[],
  next: AnalysisOption[],
): AnalysisOption[] {
  const map = new Map(prev.map(a => [a.id, a]));
  for (const a of next) map.set(a.id, a);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "uz"));
}

export function GlobalPdfTemplateSection({
  primaryColor,
  onEditTemplate,
}: {
  primaryColor: string;
  onEditTemplate: (template: PdfTemplate) => void;
}) {
  const [items, setItems] = useState<GlobalStorage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [analysisId, setAnalysisId] = useState<number | "">("");
  const [analyses, setAnalyses] = useState<AnalysisOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [viewing, setViewing] = useState<PdfTemplate | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const load = async (opts?: {
    page?: number;
    search?: string;
    analysis_id?: number | "";
  }) => {
    const nextPage = opts?.page ?? page;
    const nextSearch = opts?.search ?? search;
    const nextAnalysisId = opts?.analysis_id !== undefined ? opts.analysis_id : analysisId;
    setLoading(true);
    setError(null);
    try {
      const res = await getGlobalStoragesFull({
        page: nextPage,
        limit: PER_PAGE,
        search: nextSearch,
        ...(typeof nextAnalysisId === "number" && nextAnalysisId > 0
          ? { analysis_id: nextAnalysisId }
          : {}),
      });
      setItems(res.data);
      setTotal(res.total);
      setPage(res.page);
      setAnalyses(prev =>
        mergeAnalysisOptions(prev, extractAnalysesFromRecords(res.data)),
      );
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      // Select options: barcha global yozuvlardagi analysis obyektlaridan
      try {
        const all = await getAllGlobalStorages();
        setAnalyses(extractAnalysesFromRecords(all));
      } catch {
        /* getfull dan ham to'ldiriladi */
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setSearch(q);
    setPage(1);
    void load({ page: 1, search: q, analysis_id: analysisId });
  };

  const handleAnalysisChange = (value: string) => {
    const next = value ? Number(value) : "";
    setAnalysisId(next);
    setPage(1);
    void load({ page: 1, search, analysis_id: next });
  };

  const openView = async (item: GlobalStorage) => {
    setLoadingView(true);
    try {
      const full = await getGlobalStorageById(item.id);
      const tpl = globalStorageRecordToPdfTemplate(full);
      if (!tpl) {
        pushToast("Shablon ma'lumotini o'qib bo'lmadi", "error");
        return;
      }
      setViewing(tpl);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
    } finally {
      setLoadingView(false);
    }
  };

  const handleEdit = () => {
    if (!viewing) return;
    onEditTemplate(cloneGlobalTemplateForLocalEdit(viewing));
  };

  const handleDelete = async (item: GlobalStorage) => {
    if (!window.confirm(`"${item.name}" global shablonini o'chirasizmi?`)) return;
    setDeletingId(item.id);
    try {
      await deleteGlobalStorage(item.id);
      if (viewing?.globalStorageId === item.id) setViewing(null);
      pushToast("Global shablon o'chirildi");
      const nextTotal = Math.max(0, total - 1);
      const nextPage =
        page > 1 && (page - 1) * PER_PAGE >= nextTotal ? page - 1 : page;
      await load({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirib bo'lmadi", "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (viewing) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-secondary text-foreground hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Orqaga
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileType className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">{viewing.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {viewing.analysisName
                  ? viewing.analysisName
                  : viewing.analysisId
                    ? `Analiz #${viewing.analysisId}`
                    : "Analiz ko'rsatilmagan"}
                {viewing.companyName ? ` · ${viewing.companyName}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white"
            style={{ background: primaryColor }}
          >
            <Edit3 className="w-3.5 h-3.5" /> Tahrirlash
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 overflow-auto">
          <p className="text-[12px] text-muted-foreground mb-3">
            Ko&apos;rib chiqish — o&apos;ziga moslashtirish uchun{" "}
            <strong>Tahrirlash</strong> orqali PDF shablon bo&apos;limiga o&apos;ting va
            o&apos;z online storage&apos;ga saqlang.
          </p>
          <div className="flex justify-center bg-secondary/40 rounded-xl p-4 overflow-auto">
            <ResultPdfCanvas
              template={viewing}
              fillValues={{}}
              dynamicCtx={null}
              readOnly
            />
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white ${
                t.type === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {t.type === "success" ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              {t.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileType className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Global PDF shablonlar</h3>
              <p className="text-[11px] text-muted-foreground">
                Barcha tumanlar ulashgan shablonlar — ko&apos;rib, o&apos;zingizga moslashtiring
              </p>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Qidirish..."
                className="bg-secondary border border-border rounded-xl pl-9 pr-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)] w-48"
              />
            </div>
            <select
              value={analysisId === "" ? "" : String(analysisId)}
              onChange={e => handleAnalysisChange(e.target.value)}
              className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)] max-w-[220px]"
              title="Analiz bo'yicha filter"
            >
              <option value="">Barcha analizlar</option>
              {analyses.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-2 rounded-xl text-[12px] font-semibold bg-secondary text-foreground hover:opacity-90"
            >
              Topish
            </button>
          </form>
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["Shablon", "Analiz", "Kompaniya", "Yangilangan", ""].map((h, i) => (
                  <th
                    key={i}
                    className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || loadingView ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <FileType className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Global shablon topilmadi
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          PDF shablon bo&apos;limidan &quot;Globalga saqlash&quot; orqali qo&apos;shing
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr
                    key={item.id}
                    className="border-b border-border hover:bg-secondary/30 transition-colors group cursor-pointer"
                    onClick={() => void openView(item)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: primaryColor }}
                        >
                          <FileType className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            #{item.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {item.analysis?.name || item.analysis_id ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <TestTube2 className="w-3.5 h-3.5 shrink-0" />
                          {item.analysis?.name || `Analiz #${item.analysis_id}`}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.company?.name || item.company_id ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          {item.company?.name || `Kompaniya #${item.company_id}`}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap">
                      {item.updatedAt || item.createdAt
                        ? formatDate(item.updatedAt || item.createdAt || "")
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => void openView(item)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                          title="Ko'rish"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              setLoadingView(true);
                              try {
                                const full = await getGlobalStorageById(item.id);
                                const tpl = globalStorageRecordToPdfTemplate(full);
                                if (!tpl) {
                                  pushToast("Shablon ma'lumotini o'qib bo'lmadi", "error");
                                  return;
                                }
                                onEditTemplate(cloneGlobalTemplateForLocalEdit(tpl));
                              } catch (err) {
                                pushToast(
                                  err instanceof ApiError ? err.message : "Yuklab bo'lmadi",
                                  "error",
                                );
                              } finally {
                                setLoadingView(false);
                              }
                            })();
                          }}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors disabled:opacity-50"
                          title="O'chirish"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {total === 0
              ? "0 ta shablon"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total} ta`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                void load({ page: 1 });
              }}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const p = Math.max(1, page - 1);
                setPage(p);
                void load({ page: p });
              }}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPage(p as number);
                      void load({ page: p as number });
                    }}
                    disabled={loading}
                    className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                    style={
                      page === p
                        ? { background: primaryColor, color: "#fff" }
                        : { color: "var(--muted-foreground)" }
                    }
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              type="button"
              onClick={() => {
                const p = Math.min(totalPages, page + 1);
                setPage(p);
                void load({ page: p });
              }}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPage(totalPages);
                void load({ page: totalPages });
              }}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white ${
              t.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
