import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Loader2, AlertCircle, Plus, X, CheckCircle,
  FlaskConical, MessageSquare, Search, UserPlus, Printer, ClipboardList,
} from "lucide-react";
import { getPatientById, getPatientsFull, type Patient } from "@/api/patient";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { getAllAnalyses, type Analysis } from "@/api/analysis";
import { addOrder, updatePaymentStatus, type PaymentMethod } from "@/api/order";
import { getStoredUser } from "@/api/session";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { statusLabel } from "@/lib/orderStatus";

function formatBirthDay(value: string | undefined): string {
  if (!value) return "—";
  const d = value.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
}

function sexLabel(sex: number | undefined): string {
  if (sex === 1) return "Erkak";
  if (sex === 2) return "Ayol";
  return "—";
}

type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

type CartItem = {
  key: string;
  analysis_id: number;
  laboratory_id: number;
  analysis_name: string;
  laboratory_name: string;
  price: number;
  status: "pending";
};

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
  { value: "click", label: "Click" },
];

function formatPrice(price: number) {
  return price.toLocaleString("uz-UZ") + " so'm";
}

function parsePrice(raw: string | number | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function AnalysisPickModal({
  laboratories,
  analyses,
  primaryColor,
  existingKeys,
  onSave,
  onClose,
}: {
  laboratories: Laboratory[];
  analyses: Analysis[];
  primaryColor: string;
  existingKeys: Set<string>;
  onSave: (items: Omit<CartItem, "key" | "status">[]) => void;
  onClose: () => void;
}) {
  const [labId, setLabId] = useState<number | "">("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const labAnalyses = useMemo(() => {
    if (labId === "") return [];
    return analyses.filter(a => a.laboratory?.id === labId);
  }, [analyses, labId]);

  const availableAnalyses = useMemo(
    () =>
      labAnalyses.filter(a => labId !== "" && !existingKeys.has(`${labId}:${a.id}`)),
    [labAnalyses, labId, existingKeys],
  );

  const selectedAnalyses = useMemo(
    () => availableAnalyses.filter(a => selectedIds.includes(a.id)),
    [availableAnalyses, selectedIds],
  );

  const selectedTotal = useMemo(
    () => selectedAnalyses.reduce((sum, a) => sum + parsePrice(a.price), 0),
    [selectedAnalyses],
  );

  const inputCls =
    "w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]";

  const toggleAnalysis = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
    setError(null);
  };

  const toggleAll = () => {
    if (selectedIds.length === availableAnalyses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableAnalyses.map(a => a.id));
    }
    setError(null);
  };

  const handleSave = () => {
    if (labId === "") {
      setError("Laboratoriyani tanlang");
      return;
    }
    if (selectedAnalyses.length === 0) {
      setError("Kamida bitta analizni tanlang");
      return;
    }
    const lab = laboratories.find(l => l.id === labId);
    onSave(
      selectedAnalyses.map(a => ({
        analysis_id: a.id,
        laboratory_id: labId,
        analysis_name: a.name,
        laboratory_name: lab?.name ?? a.laboratory?.name ?? "—",
        price: parsePrice(a.price),
      })),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Analiz qo'shish</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Laboratoriya tanlab, bir nechta analizni belgilang
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Laboratoriya *
            </label>
            <select
              value={labId === "" ? "" : String(labId)}
              onChange={e => {
                setLabId(e.target.value ? Number(e.target.value) : "");
                setSelectedIds([]);
                setError(null);
              }}
              className={inputCls}
            >
              <option value="">Tanlang</option>
              {laboratories.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Analizlar *{" "}
                <span className="font-normal text-muted-foreground">(bir nechtasini tanlash mumkin)</span>
              </label>
              {labId !== "" && availableAnalyses.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[11px] font-medium hover:underline"
                  style={{ color: primaryColor }}
                >
                  {selectedIds.length === availableAnalyses.length
                    ? "Barchasini bekor qilish"
                    : "Barchasini tanlash"}
                </button>
              )}
            </div>

            {labId === "" ? (
              <div className={`${inputCls} text-muted-foreground`}>
                Avval laboratoriya tanlang
              </div>
            ) : availableAnalyses.length === 0 ? (
              <div className={`${inputCls} text-amber-600`}>
                {labAnalyses.length === 0
                  ? "Bu laboratoriyada analiz topilmadi"
                  : "Barcha analizlar allaqachon qo'shilgan"}
              </div>
            ) : (
              <div className="bg-secondary border border-border rounded-xl max-h-56 overflow-y-auto divide-y divide-border">
                {availableAnalyses.map(a => {
                  const checked = selectedIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-background/60 transition-colors select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAnalysis(a.id)}
                        className="w-4 h-4 rounded border-border accent-[var(--primary)] shrink-0"
                      />
                      <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">
                        {a.name}
                      </span>
                      <span className="text-[12px] text-muted-foreground shrink-0">
                        {formatPrice(parsePrice(a.price))}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedAnalyses.length > 0 && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Tanlangan:{" "}
                <span className="font-semibold text-foreground">
                  {selectedAnalyses.length} ta
                </span>
                {" · "}
                Jami:{" "}
                <span className="font-semibold text-foreground">
                  {formatPrice(selectedTotal)}
                </span>
              </p>
            )}
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            {selectedAnalyses.length > 0
              ? `${selectedAnalyses.length} ta qo'shish`
              : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  primaryColor,
  initialMethod,
  initialAmount,
  onConfirm,
  onClose,
}: {
  primaryColor: string;
  initialMethod: PaymentMethod | null;
  initialAmount: number;
  onConfirm: (method: PaymentMethod, amount: number) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | "">(initialMethod ?? "");
  const [amount, setAmount] = useState(
    initialAmount > 0 ? String(Math.round(initialAmount)) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]";

  const handlePay = () => {
    if (!method) {
      setError("To'lov turini tanlang");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("To'g'ri summa kiriting");
      return;
    }
    onConfirm(method, n);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">To&apos;lov qilish</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              To&apos;lov turi va summani kiriting
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              To&apos;lov turi *
            </label>
            <select
              value={method}
              onChange={e => {
                setMethod(e.target.value as PaymentMethod | "");
                setError(null);
              }}
              className={inputCls}
            >
              <option value="">Tanlang</option>
              {PAYMENT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Summa *
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={e => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder="0"
              className={inputCls}
            />
            {initialAmount > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Hisoblangan summa: {formatPrice(initialAmount)}
              </p>
            )}
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handlePay}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            To&apos;lov qilish
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({
  primaryColor,
  patient,
  items,
  paymentMethod,
  paidAmount,
  discountPercent,
  totalBeforeDiscount,
  onClose,
}: {
  primaryColor: string;
  patient: Patient;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  paidAmount: number;
  discountPercent: number | null;
  totalBeforeDiscount: number;
  onClose: () => void;
}) {
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const discountAmount =
    discountPercent != null && discountPercent > 0
      ? Math.round((totalBeforeDiscount * discountPercent) / 100)
      : 0;
  const methodLabel =
    PAYMENT_OPTIONS.find(o => o.value === paymentMethod)?.label ?? paymentMethod;
  const now = new Date();
  const checkNo = `CHK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:bg-white">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm print:hidden" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden print:shadow-none print:border-0 print:rounded-none print:max-w-none">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border print:hidden">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">To&apos;lov cheki</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Chop etish uchun tayyor</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={receiptRef} id="kassa-receipt-print" className="p-6">
          <div className="text-center border-b border-dashed border-border pb-4 mb-4">
            <p className="text-sm font-bold text-foreground tracking-wide">SES LABORATORIYA</p>
            <p className="text-[11px] text-muted-foreground mt-1">To&apos;lov cheki</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{checkNo}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(now.toISOString())}
            </p>
          </div>

          <div className="space-y-1.5 text-[12px] mb-4">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Bemor</span>
              <span className="font-medium text-foreground text-right">
                {patient.last_name} {patient.first_name}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Telefon</span>
              <span className="text-foreground">{patient.phone || "—"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Passport</span>
              <span className="text-foreground">{patient.passport_number || "—"}</span>
            </div>
          </div>

          <div className="border-t border-b border-dashed border-border py-3 mb-4 space-y-2">
            {items.map(item => (
              <div key={item.key} className="flex justify-between gap-3 text-[12px]">
                <div className="min-w-0">
                  <p className="text-foreground font-medium truncate">{item.analysis_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.laboratory_name}</p>
                </div>
                <span className="shrink-0 text-foreground">{formatPrice(item.price)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-[12px] mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jami</span>
              <span className="text-foreground">{formatPrice(totalBeforeDiscount)}</span>
            </div>
            {discountPercent != null && discountPercent > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chegirma ({discountPercent}%)</span>
                <span className="text-foreground">-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">To&apos;lov turi</span>
              <span className="text-foreground">{methodLabel}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-semibold text-foreground">To&apos;langan</span>
              <span className="font-bold text-foreground" style={{ color: primaryColor }}>
                {formatPrice(paidAmount)}
              </span>
            </div>
          </div>

          <p className="text-center text-[11px] text-muted-foreground pt-2">
            Rahmat! Sog&apos;ligingiz uchun!
          </p>
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Yopish
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            <Printer className="w-4 h-4" />
            Chop etish
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; size: auto; }
          body * { visibility: hidden !important; }
          #kassa-receipt-print, #kassa-receipt-print * { visibility: visible !important; }
          #kassa-receipt-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}

export function OrderPage({
  primaryColor,
  patientId,
  onPatientChange,
}: {
  primaryColor: string;
  patientId: number | null;
  onPatientChange: (patientId: number | null) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientSearch, setPatientSearch] = useState("");
  const [patientMatches, setPatientMatches] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [patientSearched, setPatientSearched] = useState(false);

  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [refsLoading, setRefsLoading] = useState(true);

  const [items, setItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [paymentPaid, setPaymentPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const pushToast = (text: string, type: ToastMsg["type"]) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const resetOrderForm = () => {
    setItems([]);
    setPaymentMethod(null);
    setPaymentPickerOpen(false);
    setDiscountPercent("");
    setSendSms(true);
    setAnalysisModalOpen(false);
    setPaymentModalOpen(false);
    setReceiptOpen(false);
    setPaymentPaid(false);
    setPaidAmount(0);
  };

  useEffect(() => {
    if (patientId == null) {
      setPatient(null);
      setLoading(false);
      setError(null);
      resetOrderForm();
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      resetOrderForm();
      try {
        const data = await getPatientById(patientId);
        if (!cancelled) setPatient(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Bemorni yuklab bo'lmadi");
          setPatient(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRefsLoading(true);
      try {
        const [labs, ans] = await Promise.all([
          getAllLaboratories(),
          getAllAnalyses(),
        ]);
        if (!cancelled) {
          setLaboratories(Array.isArray(labs) ? labs : []);
          setAnalyses(Array.isArray(ans) ? ans : []);
        }
      } catch (err) {
        if (!cancelled) {
          pushToast(
            err instanceof ApiError ? err.message : "Ma'lumotlarni yuklab bo'lmadi",
            "error",
          );
        }
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadPatients = async (search?: string) => {
    setSearchingPatients(true);
    setPatientSearched(true);
    try {
      const q = search?.trim() ?? "";
      const res = await getPatientsFull({
        page: 1,
        limit: 50,
        ...(q ? { search: q } : {}),
      });
      setPatientMatches(res.data);
      if (q && res.data.length === 0) pushToast("Bemor topilmadi", "info");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Bemorlarni yuklab bo'lmadi", "error");
      setPatientMatches([]);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSearchPatients = async () => {
    await loadPatients(patientSearch);
  };

  useEffect(() => {
    if (patientId != null) return;
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial list when opening kassa without patient
  }, [patientId]);

  const clearPatient = () => {
    onPatientChange(null);
    setPatientSearch("");
  };

  const existingKeys = useMemo(
    () => new Set(items.map(i => `${i.laboratory_id}:${i.analysis_id}`)),
    [items],
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.price, 0),
    [items],
  );

  const parsedDiscount = useMemo(() => {
    const raw = discountPercent.trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n;
  }, [discountPercent]);

  const amountDue = useMemo(() => {
    if (parsedDiscount == null) return totalPrice;
    return Math.max(0, Math.round(totalPrice * (1 - parsedDiscount / 100)));
  }, [totalPrice, parsedDiscount]);

  const paymentLabel =
    PAYMENT_OPTIONS.find(o => o.value === paymentMethod)?.label ?? null;

  const handleAddAnalysis = (newItems: Omit<CartItem, "key" | "status">[]) => {
    if (newItems.length === 0) return;
    setItems(list => [
      ...list,
      ...newItems.map(item => ({
        ...item,
        key: `${item.laboratory_id}:${item.analysis_id}`,
        status: "pending" as const,
      })),
    ]);
    setAnalysisModalOpen(false);
    setPaymentPaid(false);
    pushToast(
      newItems.length === 1
        ? "Analiz qo'shildi"
        : `${newItems.length} ta analiz qo'shildi`,
      "success",
    );
  };

  const handleRemoveItem = (key: string) => {
    setItems(list => list.filter(i => i.key !== key));
    setPaymentPaid(false);
  };

  const openPaymentModal = () => {
    if (items.length === 0) {
      pushToast("Avval analiz qo'shing", "info");
      return;
    }
    setPaymentModalOpen(true);
  };

  const handlePaymentConfirm = (method: PaymentMethod, amount: number) => {
    setPaymentMethod(method);
    setPaidAmount(amount);
    setPaymentPaid(true);
    setPaymentModalOpen(false);
    setReceiptOpen(true);
    pushToast("To'lov qabul qilindi", "success");
  };

  const handleSubmit = async () => {
    if (!patient) return;
    if (items.length === 0) {
      pushToast("Kamida bitta analiz qo'shing", "info");
      return;
    }
    if (!paymentMethod) {
      pushToast("To'lov turini tanlang", "info");
      return;
    }

    let discountValue: number | null = null;
    const discountRaw = discountPercent.trim();
    if (discountRaw !== "") {
      const n = Number(discountRaw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        pushToast("Chegirma 0 dan 100 gacha bo'lishi kerak", "info");
        return;
      }
      discountValue = n;
    }

    const user = getStoredUser();
    if (!user?.id) {
      pushToast("Foydalanuvchi sessiyasi topilmadi. Qayta kiring", "error");
      return;
    }

    setSubmitting(true);
    try {
      const created = await addOrder({
        order_type: "patient",
        payment_method: paymentMethod,
        discount_percent: discountValue,
        street: patient.street || null,
        village: patient.village || null,
        description: patient.description || null,
        district_id: patient.district_id ?? patient.district?.id ?? null,
        patient_id: patient.id,
        owner_id: user.id,
        items: items.map(i => ({
          analysis_id: i.analysis_id,
          laboratory_id: i.laboratory_id,
          price: i.price,
        })),
      });

      if (paymentPaid && created?.id) {
        try {
          await updatePaymentStatus(created.id, "paid");
        } catch {
          pushToast("Order yaratildi, lekin to'lov holatini yangilab bo'lmadi", "info");
        }
      }

      pushToast(
        sendSms
          ? "Order yaratildi. SMS yuborish belgilandi"
          : paymentPaid
            ? "Order yaratildi. To'lov holati: To'langan"
            : "Order muvaffaqiyatli yaratildi",
        "success",
      );
      setTimeout(() => clearPatient(), 900);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Order yaratib bo'lmadi", "error");
    } finally {
      setSubmitting(false);
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
              <FlaskConical className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            <span className="text-[13px] text-foreground">{t.text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Kassa</h2>
          <p className="text-xs text-muted-foreground">
            Bemor uchun analizlar va to&apos;lovni rasmiylashtirish
          </p>
        </div>
        {patientId != null && (
          <button
            type="button"
            onClick={clearPatient}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Boshqa bemor
          </button>
        )}
      </div>

      {patientId == null ? (
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${primaryColor}18` }}
            >
              <Search className="w-4 h-4" style={{ color: primaryColor }} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Bemorlar ro&apos;yxati</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Jadvaldan bemorni tanlang yoki qidiruv orqali toping
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 border border-border">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") void handleSearchPatients();
                  }}
                  placeholder="Ism, familiya, telefon yoki passport..."
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSearchPatients()}
                disabled={searchingPatients}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
                style={{ background: primaryColor }}
              >
                {searchingPatients ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Qidirish
              </button>
            </div>
          </div>

          <div className="overflow-x-auto ses-scrollbar border-t border-border">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Bemor
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Passport
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Telefon
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tug&apos;ilgan sana
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Jinsi
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tuman
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
                    Amal
                  </th>
                </tr>
              </thead>
              <tbody>
                {searchingPatients ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground mt-3">Yuklanmoqda...</p>
                    </td>
                  </tr>
                ) : patientMatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      {patientSearched ? (
                        <>
                          <UserPlus className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm font-medium text-foreground">Bemor topilmadi</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Bemorlar sahifasidan yangi bemor qo&apos;shishingiz mumkin
                          </p>
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm font-medium text-foreground">Bemorlar ro&apos;yxati</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Qidiruv orqali bemorni toping
                          </p>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  patientMatches.map(p => (
                    <tr
                      key={p.id}
                      className="border-b border-border hover:bg-secondary/30 transition-colors group cursor-pointer"
                      onClick={() => onPatientChange(p.id)}
                    >
                      <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground">
                        #{p.id}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-foreground">
                          {p.last_name} {p.first_name}
                        </p>
                        {p.village || p.street ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[220px]">
                            {[p.village, p.street].filter(Boolean).join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-mono text-foreground">
                        {p.passport_number || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-foreground whitespace-nowrap">
                        {p.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {formatBirthDay(p.birth_day)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-foreground">
                        {sexLabel(p.sex)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {p.district?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onPatientChange(p.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-90 opacity-90 group-hover:opacity-100"
                            style={{ background: primaryColor }}
                          >
                            Tanlash
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : loading ? (
        <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
          <p className="text-sm text-muted-foreground">Bemor yuklanmoqda...</p>
        </div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-red-200 p-8 flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-foreground">{error}</p>
          <button
            type="button"
            onClick={clearPatient}
            className="text-sm font-semibold"
            style={{ color: primaryColor }}
          >
            Boshqa bemorni tanlash
          </button>
        </div>
      ) : patient ? (
        <>
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto ses-scrollbar">
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Bemor
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Analiz turi
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Narx
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Chegirma
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      To&apos;lov turi
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      To&apos;lov qilish
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Holat
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      SMS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    <td className="px-4 py-4 border-b border-border min-w-[200px]">
                      <p className="text-[13px] font-semibold text-foreground">
                        {patient.last_name} {patient.first_name}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-1">
                        Tel: {patient.phone || "—"}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Tuman: {patient.district?.name ?? "—"}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Sana:{" "}
                        {patient.createdAt ? formatDate(patient.createdAt) : "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[220px]">
                      <div className="space-y-2">
                        {items.map(item => (
                          <div
                            key={item.key}
                            className="flex items-start justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {item.analysis_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {item.laboratory_name}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.key)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                              title="O'chirish"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAnalysisModalOpen(true)}
                          disabled={refsLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                        >
                          {refsLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Analiz qo&apos;shish
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[140px]">
                      <div className="space-y-2">
                        {items.length === 0 ? (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        ) : (
                          items.map(item => (
                            <div
                              key={item.key}
                              className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px] font-medium text-foreground"
                            >
                              {formatPrice(item.price)}
                            </div>
                          ))
                        )}
                        {items.length > 0 && (
                          <p className="text-[12px] font-semibold pt-1" style={{ color: primaryColor }}>
                            Jami: {formatPrice(totalPrice)}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[120px]">
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          value={discountPercent}
                          onChange={e => {
                            setDiscountPercent(e.target.value);
                            setPaymentPaid(false);
                          }}
                          placeholder="0"
                          className="w-full bg-secondary border border-border rounded-xl px-3 py-2 pr-8 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[160px]">
                      <div className="space-y-2">
                        {paymentMethod && (
                          <div className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px] font-medium text-foreground">
                            {paymentLabel}
                          </div>
                        )}
                        {paymentPickerOpen ? (
                          <select
                            autoFocus
                            value={paymentMethod ?? ""}
                            onChange={e => {
                              const v = e.target.value as PaymentMethod;
                              if (v) {
                                setPaymentMethod(v);
                                setPaymentPickerOpen(false);
                                setPaymentPaid(false);
                              }
                            }}
                            onBlur={() => {
                              if (paymentMethod) setPaymentPickerOpen(false);
                            }}
                            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
                          >
                            <option value="">Tanlang</option>
                            {PAYMENT_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPaymentPickerOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {paymentMethod ? "O'zgartirish" : "To'lov turi"}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[140px]">
                      <div className="space-y-2">
                        {paymentPaid ? (
                          <>
                            <div className="rounded-xl px-3 py-2 text-[12px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              {statusLabel("paid")}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatPrice(paidAmount)}
                            </p>
                            <button
                              type="button"
                              onClick={() => setReceiptOpen(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border border-border text-foreground hover:bg-secondary transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Chek
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={openPaymentModal}
                            disabled={items.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            To&apos;lov qilish
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[120px]">
                      <div className="space-y-2">
                        {items.length === 0 ? (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        ) : (
                          items.map(item => (
                            <div
                              key={item.key}
                              className="rounded-xl px-3 py-2 text-[12px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            >
                              {statusLabel(item.status)}
                            </div>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[120px]">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={sendSms}
                          onChange={e => setSendSms(e.target.checked)}
                          className="sr-only"
                        />
                        <span
                          className={`w-9 h-5 rounded-full relative transition-colors ${
                            sendSms ? "" : "bg-secondary border border-border"
                          }`}
                          style={sendSms ? { background: primaryColor } : undefined}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              sendSms ? "left-4" : "left-0.5"
                            }`}
                          />
                        </span>
                        <span className="text-[12px] text-foreground flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          {sendSms ? "Ha" : "Yo'q"}
                        </span>
                      </label>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={clearPatient}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || items.length === 0 || !paymentMethod}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: primaryColor }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Order yaratish
            </button>
          </div>
        </>
      ) : null}

      {analysisModalOpen && (
        <AnalysisPickModal
          laboratories={laboratories}
          analyses={analyses}
          primaryColor={primaryColor}
          existingKeys={existingKeys}
          onSave={handleAddAnalysis}
          onClose={() => setAnalysisModalOpen(false)}
        />
      )}

      {paymentModalOpen && (
        <PaymentModal
          primaryColor={primaryColor}
          initialMethod={paymentMethod}
          initialAmount={amountDue}
          onConfirm={handlePaymentConfirm}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}

      {receiptOpen && patient && paymentMethod && (
        <ReceiptModal
          primaryColor={primaryColor}
          patient={patient}
          items={items}
          paymentMethod={paymentMethod}
          paidAmount={paidAmount}
          discountPercent={parsedDiscount}
          totalBeforeDiscount={totalPrice}
          onClose={() => setReceiptOpen(false)}
        />
      )}
    </main>
  );
}
