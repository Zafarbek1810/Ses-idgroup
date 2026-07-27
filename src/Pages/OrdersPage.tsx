import * as React from "react";
import { useEffect, useState } from "react";
import {
  Search, RefreshCw, Eye, Trash2, X, Loader2, CheckCircle, AlertCircle,
  ClipboardList, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw,
} from "lucide-react";
import {
  getOrdersFull,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  updateOrderItemStatus,
  recalculateOrderStatus,
  deleteOrder,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
  type OrderItemStatus,
} from "@/api/order";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  ITEM_STATUS_LABELS,
  statusLabel,
} from "@/lib/orderStatus";

type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

const PER_PAGE = 10;

const ORDER_STATUSES = (
  Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]
).map(([value, label]) => ({ value, label }));

const PAYMENT_STATUSES = (
  Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][]
).map(([value, label]) => ({ value, label }));

const ITEM_STATUSES = (
  Object.entries(ITEM_STATUS_LABELS) as [OrderItemStatus, string][]
).map(([value, label]) => ({ value, label }));

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  click: "Click",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  patient: "Bemor",
  sample: "Namuna",
  course: "Kurs",
};

function formatAmount(value: string | number | undefined | null) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("uz-UZ") + " so'm";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "completed":
    case "paid":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "pending":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "in_progress":
    case "partially_completed":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-400";
    case "canceled":
    case "refunded":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function patientName(order: Order) {
  const p = order.patient;
  if (!p) return order.name || "—";
  return `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim() || "—";
}

function OrderDetailModal({
  orderId,
  primaryColor,
  onClose,
  onChanged,
}: {
  orderId: number;
  primaryColor: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const pushToast = (text: string, type: ToastMsg["type"]) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrderById(orderId);
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Buyurtmani yuklab bo'lmadi");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orderId]);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      pushToast(okMsg, "success");
      await load();
      onChanged();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Amaliyot muvaffaqiyatsiz", "error");
    } finally {
      setBusy(false);
    }
  };

  const selectCls =
    "bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-[var(--primary)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="fixed top-20 right-6 z-[70] space-y-2 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg bg-card min-w-[240px]"
              style={{
                borderColor: t.type === "success" ? "#86efac" : t.type === "error" ? "#fca5a5" : "#93c5fd",
              }}
            >
              {t.type === "success" ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span className="text-[13px] text-foreground">{t.text}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Buyurtma #{orderId}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Batafsil ma&apos;lumot va holatlar</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: primaryColor }} />
              <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-sm text-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="text-sm font-semibold"
                style={{ color: primaryColor }}
              >
                Qayta urinish
              </button>
            </div>
          ) : order ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoRow label="Bemor" value={patientName(order)} />
                <InfoRow label="Telefon" value={order.patient?.phone || "—"} />
                <InfoRow label="Turi" value={ORDER_TYPE_LABEL[order.order_type] ?? order.order_type} />
                <InfoRow
                  label="To'lov usuli"
                  value={PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}
                />
                <InfoRow label="Tuman" value={order.district?.name || "—"} />
                <InfoRow
                  label="Kassir"
                  value={
                    order.owner
                      ? `${order.owner.username} ${order.owner.surname}`.trim()
                      : "—"
                  }
                />
                <InfoRow label="Jami" value={formatAmount(order.total_amount)} />
                <InfoRow label="Yakuniy summa" value={formatAmount(order.final_amount)} />
                <InfoRow
                  label="Yaratilgan"
                  value={order.createdAt ? formatDate(order.createdAt) : "—"}
                />
                <InfoRow label="Manzil" value={[order.village, order.street].filter(Boolean).join(", ") || "—"} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-secondary/50 border border-border">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Buyurtma holati</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={String(order.status)} />
                    <select
                      className={selectCls}
                      value={String(order.status)}
                      disabled={busy}
                      onChange={e =>
                        void run(
                          () => updateOrderStatus(order.id, e.target.value),
                          "Buyurtma holati yangilandi",
                        )
                      }
                    >
                      {ORDER_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">To&apos;lov holati</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={String(order.payment_status)} />
                    <select
                      className={selectCls}
                      value={String(order.payment_status)}
                      disabled={busy}
                      onChange={e =>
                        void run(
                          () => updatePaymentStatus(order.id, e.target.value),
                          "To'lov holati yangilandi",
                        )
                      }
                    >
                      {PAYMENT_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => recalculateOrderStatus(order.id),
                        "Holat qayta hisoblandi",
                      )
                    }
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Holatni qayta hisoblash
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-[13px] font-semibold text-foreground mb-3">Analizlar</h3>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-secondary/50 border-b border-border">
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase text-muted-foreground">Analiz</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase text-muted-foreground">Lab</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase text-muted-foreground">Narx</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase text-muted-foreground">Holat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Analizlar yo&apos;q
                          </td>
                        </tr>
                      ) : (
                        (order.items as OrderItem[]).map(item => (
                          <tr key={item.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-3 text-[13px] text-foreground">
                              {item.analysis?.name ?? "—"}
                              {item.analysis?.shortname && (
                                <span className="block text-[11px] text-muted-foreground">
                                  {item.analysis.shortname}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-[12px] text-muted-foreground">
                              {item.laboratory?.name ?? "—"}
                            </td>
                            <td className="px-3 py-3 text-[13px] font-medium text-foreground">
                              {formatAmount(item.analysis?.price)}
                            </td>
                            <td className="px-3 py-3">
                              <select
                                className={selectCls}
                                value={String(item.status)}
                                disabled={busy}
                                onChange={e =>
                                  void run(
                                    () => updateOrderItemStatus(item.id, e.target.value),
                                    "Analiz holati yangilandi",
                                  )
                                }
                              >
                                {!ITEM_STATUSES.some(s => s.value === item.status) && (
                                  <option value={String(item.status)}>
                                    {statusLabel(String(item.status))}
                                  </option>
                                )}
                                {ITEM_STATUSES.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 px-3.5 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[13px] font-medium text-foreground mt-0.5 break-words">{value}</p>
    </div>
  );
}

export function OrdersPage({ primaryColor }: { primaryColor: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [labId, setLabId] = useState<number | "">("");
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const loadOrders = async (opts?: {
    page?: number;
    search?: string;
    status?: string;
    lab_id?: number | "";
  }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    const st = opts?.status ?? statusFilter;
    const lab = opts?.lab_id !== undefined ? opts.lab_id : labId;

    setLoading(true);
    setError(null);
    try {
      const res = await getOrdersFull({
        page: p,
        limit: PER_PAGE,
        search: s || undefined,
        status: st || undefined,
        lab_id: lab === "" ? undefined : lab,
      });
      setOrders(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      // Fallback: getfull yo'q yoki lab path farq qilsa getall
      try {
        const all = await getAllOrders();
        let list = Array.isArray(all) ? all : [];
        if (s.trim()) {
          const q = s.trim().toLowerCase();
          list = list.filter(o => {
            const name = patientName(o).toLowerCase();
            const phone = (o.patient?.phone ?? "").toLowerCase();
            return name.includes(q) || phone.includes(q) || String(o.id).includes(q);
          });
        }
        if (st) list = list.filter(o => String(o.status) === st);
        if (lab !== "") {
          list = list.filter(o =>
            (o.items ?? []).some(i => i.laboratory?.id === lab),
          );
        }
        const start = (p - 1) * PER_PAGE;
        setOrders(list.slice(start, start + PER_PAGE));
        setTotal(list.length);
        setPage(p);
        setError(null);
      } catch (err2) {
        setError(
          err instanceof ApiError
            ? err.message
            : err2 instanceof ApiError
              ? err2.message
              : "Buyurtmalarni yuklab bo'lmadi",
        );
        setOrders([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const labs = await getAllLaboratories();
        setLaboratories(Array.isArray(labs) ? labs : []);
      } catch {
        setLaboratories([]);
      }
    })();
  }, []);

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, labId]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteOrder(deleteTarget.id);
      pushToast(`Buyurtma #${deleteTarget.id} o'chirildi`, "success");
      setDeleteTarget(null);
      const nextTotal = total - 1;
      const nextPage = page > Math.ceil(nextTotal / PER_PAGE) ? Math.max(1, page - 1) : page;
      if (nextPage !== page) setPage(nextPage);
      else await loadOrders({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="fixed top-20 right-6 z-[60] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg bg-card animate-fade-in min-w-[260px]"
            style={{
              borderColor:
                t.type === "success" ? "#86efac" : t.type === "error" ? "#fca5a5" : "#93c5fd",
            }}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : t.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <ClipboardList className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            <span className="text-[13px] text-foreground">{t.text}</span>
          </div>
        ))}
      </div>

      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${primaryColor}18` }}
          >
            <ClipboardList className="w-4 h-4" style={{ color: primaryColor }} />
          </div>
          <div className="mr-auto min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground">Buyurtmalar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Barcha orderlar ro&apos;yxati va holatlari
            </p>
          </div>

          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px] max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Bemor, telefon yoki ID..."
              className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={e => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none"
          >
            <option value="">Barcha holatlar</option>
            {ORDER_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={labId === "" ? "" : String(labId)}
            onChange={e => {
              setPage(1);
              setLabId(e.target.value ? Number(e.target.value) : "");
            }}
            className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none max-w-[180px]"
          >
            <option value="">Barcha lablar</option>
            {laboratories.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto ses-scrollbar">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bemor</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Turi</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Holat</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">To&apos;lov</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">To&apos;lov usuli</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summa</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sana</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: primaryColor }} />
                    <p className="text-sm text-muted-foreground mt-3">Yuklanmoqda...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Buyurtmalar topilmadi</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Qidiruv yoki filterni o&apos;zgartiring
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr
                    key={order.id}
                    className="border-b border-border hover:bg-secondary/30 transition-colors group"
                  >
                    <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground">
                      #{order.id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-foreground">{patientName(order)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {order.patient?.phone || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-foreground">
                      {ORDER_TYPE_LABEL[order.order_type] ?? order.order_type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={String(order.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={String(order.payment_status)} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-foreground">
                      {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-foreground">
                      {formatAmount(order.final_amount ?? order.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                      {order.createdAt ? formatDate(order.createdAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setDetailId(order.id)}
                          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Ko'rish"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(order)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border flex-wrap">
          <p className="text-[12px] text-muted-foreground">
            Jami: <span className="font-semibold text-foreground">{total}</span> ta · Sahifa {page}/{totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(totalPages)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {detailId != null && (
        <OrderDetailModal
          orderId={detailId}
          primaryColor={primaryColor}
          onClose={() => setDetailId(null)}
          onChanged={() => void loadOrders()}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md p-6">
            <h3 className="text-[15px] font-semibold text-foreground">Buyurtmani o&apos;chirish</h3>
            <p className="text-sm text-muted-foreground mt-2">
              #{deleteTarget.id} — <span className="font-medium text-foreground">{patientName(deleteTarget)}</span>{" "}
              buyurtmasini o&apos;chirishni tasdiqlaysizmi?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
