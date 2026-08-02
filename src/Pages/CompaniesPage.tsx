import * as React from "react";
import { useEffect, useState } from "react";
import {
  Plus, Search, X, Edit3, Trash2, RefreshCw, Building2,
  CheckCircle, AlertCircle, Loader2, Eye, EyeOff,
  ChevronLeft, ChevronsLeft, ChevronsRight, MapPin,
} from "lucide-react";
import {
  getCompaniesFull,
  addCompany,
  updateCompany,
  deleteCompany,
  extractCompanyId,
  type Company,
  type CompanyPayload,
} from "@/api/company";
import { addUser } from "@/api/user";
import { addRoleWithCompany, extractRoleId } from "@/api/role";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

type CompanyForm = {
  name: string;
  description: string;
  address: string;
  phone: string;
  active: boolean;
};

type AdminForm = {
  username: string;
  surname: string;
  email: string;
  password: string;
};

type CreateForm = CompanyForm & AdminForm;

const PHONE_PREFIX = "+998";
const PHONE_PATTERN = /^\+998\d{9}$/;

function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  return PHONE_PREFIX + local.slice(0, 9);
}

const EMPTY_COMPANY: CompanyForm = {
  name: "",
  description: "",
  address: "",
  phone: PHONE_PREFIX,
  active: true,
};

const EMPTY_ADMIN: AdminForm = {
  username: "",
  surname: "",
  email: "",
  password: "",
};

const DEFAULT_COMPANY_ROLE = "director";

const PER_PAGE = 10;

function CompanyEditModal({
  initial,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  initial: CompanyForm;
  primaryColor: string;
  saving: boolean;
  onSave: (data: CompanyForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CompanyForm>({ ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyForm, string>>>({});

  const set = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof CompanyForm, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Kamida 2 ta belgi kiriting";
    if (!form.description.trim()) e.description = "Tavsif kiritilishi shart";
    if (!form.address.trim()) e.address = "Manzil kiritilishi shart";
    const phone = formatPhoneNumber(form.phone);
    if (phone === PHONE_PREFIX) {
      e.phone = "Telefon kiritilishi shart";
    } else if (!PHONE_PATTERN.test(phone)) {
      e.phone = "Format: +998 dan keyin 9 ta raqam";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
      err ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Tashkilotni tahrirlash</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ma'lumotlarni yangilang</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Nomi *</label>
            <input
              type="text"
              value={form.name}
              placeholder="Masalan: Urganch SES"
              onChange={e => set("name", e.target.value)}
              className={inputCls(errors.name)}
            />
            {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Tavsif *</label>
            <textarea
              value={form.description}
              placeholder="Tashkilot haqida qisqacha"
              rows={3}
              onChange={e => set("description", e.target.value)}
              className={`${inputCls(errors.description)} resize-none`}
            />
            {errors.description && <p className="text-[11px] text-red-500 mt-1">{errors.description}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Manzil *</label>
            <input
              type="text"
              value={form.address}
              placeholder="Shahar, ko'cha…"
              onChange={e => set("address", e.target.value)}
              className={inputCls(errors.address)}
            />
            {errors.address && <p className="text-[11px] text-red-500 mt-1">{errors.address}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Telefon *</label>
            <input
              type="tel"
              value={form.phone || PHONE_PREFIX}
              placeholder="+998901234567"
              onChange={e => set("phone", formatPhoneNumber(e.target.value))}
              onFocus={e => {
                if (!form.phone || form.phone === PHONE_PREFIX) {
                  set("phone", PHONE_PREFIX);
                }
                const el = e.currentTarget;
                requestAnimationFrame(() => {
                  if (el.selectionStart != null && el.selectionStart < PHONE_PREFIX.length) {
                    el.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                  }
                });
              }}
              onKeyDown={e => {
                const input = e.currentTarget;
                const start = input.selectionStart ?? 0;
                const end = input.selectionEnd ?? 0;
                const touchingPrefix =
                  start < PHONE_PREFIX.length || (start === end && start <= PHONE_PREFIX.length && e.key === "Backspace");
                if ((e.key === "Backspace" || e.key === "Delete") && touchingPrefix && end <= PHONE_PREFIX.length) {
                  e.preventDefault();
                  input.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                }
              }}
              className={inputCls(errors.phone)}
            />
            {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3.5 py-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Holat</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {form.active ? "Tashkilot faol" : "Tashkilot faol emas"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              onClick={() => set("active", !form.active)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                form.active ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  form.active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-2 shrink-0 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={() => {
              if (!validate()) return;
              onSave({ ...form, phone: formatPhoneNumber(form.phone) });
            }}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function CompanyCreateModal({
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  primaryColor: string;
  saving: boolean;
  onSave: (data: CreateForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateForm>({
    ...EMPTY_COMPANY,
    ...EMPTY_ADMIN,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});

  const set = <K extends keyof CreateForm>(k: K, v: CreateForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof CreateForm, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Kamida 2 ta belgi kiriting";
    if (!form.description.trim()) e.description = "Tavsif kiritilishi shart";
    if (!form.address.trim()) e.address = "Manzil kiritilishi shart";
    const phone = formatPhoneNumber(form.phone);
    if (phone === PHONE_PREFIX) {
      e.phone = "Telefon kiritilishi shart";
    } else if (!PHONE_PATTERN.test(phone)) {
      e.phone = "Format: +998 dan keyin 9 ta raqam";
    }
    if (!form.username.trim() || form.username.trim().length < 2) e.username = "Kamida 2 ta belgi kiriting";
    if (!form.surname.trim()) e.surname = "Familiya kiritilishi shart";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "To'g'ri email kiriting";
    if (!form.password || form.password.length < 6) e.password = "Kamida 6 ta belgi kiriting";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
      err ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Yangi tashkilot</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tashkilot, rol va admin xodim birga yaratiladi
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Tashkilot ma'lumotlari
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Nomi *</label>
                <input
                  type="text"
                  value={form.name}
                  placeholder="Masalan: Urganch SES"
                  onChange={e => set("name", e.target.value)}
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Tavsif *</label>
                <textarea
                  value={form.description}
                  placeholder="Tashkilot haqida qisqacha"
                  rows={2}
                  onChange={e => set("description", e.target.value)}
                  className={`${inputCls(errors.description)} resize-none`}
                />
                {errors.description && <p className="text-[11px] text-red-500 mt-1">{errors.description}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Manzil *</label>
                <input
                  type="text"
                  value={form.address}
                  placeholder="Shahar, ko'cha…"
                  onChange={e => set("address", e.target.value)}
                  className={inputCls(errors.address)}
                />
                {errors.address && <p className="text-[11px] text-red-500 mt-1">{errors.address}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Telefon *</label>
                <input
                  type="tel"
                  value={form.phone || PHONE_PREFIX}
                  placeholder="+998901234567"
                  onChange={e => set("phone", formatPhoneNumber(e.target.value))}
                  onFocus={e => {
                    if (!form.phone || form.phone === PHONE_PREFIX) {
                      set("phone", PHONE_PREFIX);
                    }
                    const el = e.currentTarget;
                    requestAnimationFrame(() => {
                      if (el.selectionStart != null && el.selectionStart < PHONE_PREFIX.length) {
                        el.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                      }
                    });
                  }}
                  onKeyDown={e => {
                    const input = e.currentTarget;
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? 0;
                    const touchingPrefix =
                      start < PHONE_PREFIX.length || (start === end && start <= PHONE_PREFIX.length && e.key === "Backspace");
                    if ((e.key === "Backspace" || e.key === "Delete") && touchingPrefix && end <= PHONE_PREFIX.length) {
                      e.preventDefault();
                      input.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                    }
                  }}
                  className={inputCls(errors.phone)}
                />
                {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3.5 py-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">Holat</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {form.active ? "Tashkilot faol" : "Tashkilot faol emas"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => set("active", !form.active)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    form.active ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              Admin xodim
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Ism *</label>
                  <input
                    type="text"
                    value={form.username}
                    placeholder="Shoxrux"
                    onChange={e => set("username", e.target.value)}
                    className={inputCls(errors.username)}
                  />
                  {errors.username && <p className="text-[11px] text-red-500 mt-1">{errors.username}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Familiya *</label>
                  <input
                    type="text"
                    value={form.surname}
                    placeholder="Abdullayev"
                    onChange={e => set("surname", e.target.value)}
                    className={inputCls(errors.surname)}
                  />
                  {errors.surname && <p className="text-[11px] text-red-500 mt-1">{errors.surname}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  placeholder="admin@example.com"
                  onChange={e => set("email", e.target.value)}
                  className={inputCls(errors.email)}
                />
                {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Parol *</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    placeholder="Kamida 6 ta belgi"
                    onChange={e => set("password", e.target.value)}
                    className={`${inputCls(errors.password)} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-2 shrink-0 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={() => {
              if (!validate()) return;
              onSave({ ...form, phone: formatPhoneNumber(form.phone) });
            }}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Yaratish
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompaniesPage({ primaryColor }: { primaryColor: string }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modal, setModal] = useState<
    | { type: "add" }
    | { type: "edit"; company: Company }
    | { type: "delete"; company: Company }
    | null
  >(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const loadCompanies = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    setLoading(true);
    setError(null);
    try {
      const res = await getCompaniesFull({ page: p, limit: PER_PAGE, search: s });
      setCompanies(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tashkilotlarni yuklab bo'lmadi");
      setCompanies([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleCreate = async (form: CreateForm) => {
    setSaving(true);
    try {
      const companyPayload: CompanyPayload = {
        name: form.name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        phone: formatPhoneNumber(form.phone),
        active: form.active,
      };
      const created = await addCompany(companyPayload);
      const companyId = extractCompanyId(created);

      if (companyId == null) {
        pushToast("Tashkilot yaratildi, lekin ID topilmadi — rol va admin biriktirilmadi", "error");
        setModal(null);
        setPage(1);
        await loadCompanies({ page: 1 });
        return;
      }

      const roleCreated = await addRoleWithCompany({
        name: DEFAULT_COMPANY_ROLE,
        description: DEFAULT_COMPANY_ROLE,
        company_id: companyId,
      });
      const roleId = extractRoleId(roleCreated);

      if (roleId == null) {
        pushToast("Tashkilot va rol yaratildi, lekin rol ID topilmadi — admin biriktirilmadi", "error");
        setModal(null);
        setPage(1);
        await loadCompanies({ page: 1 });
        return;
      }

      await addUser({
        username: form.username.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: roleId,
        company_id: companyId,
      });

      pushToast(`"${companyPayload.name}" yaratildi`);
      setModal(null);
      setPage(1);
      await loadCompanies({ page: 1 });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: CompanyForm) => {
    if (modal?.type !== "edit") return;
    setSaving(true);
    try {
      const payload: CompanyPayload = {
        name: form.name.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        phone: formatPhoneNumber(form.phone),
        active: form.active,
      };
      await updateCompany(modal.company.id, payload);
      pushToast(`"${payload.name}" yangilandi`);
      setModal(null);
      await loadCompanies();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteCompany(modal.company.id);
      pushToast(`"${modal.company.name}" o'chirildi`, "error");
      setModal(null);
      const nextTotal = total - 1;
      const nextPage = page > Math.ceil(nextTotal / PER_PAGE) ? Math.max(1, page - 1) : page;
      if (nextPage !== page) setPage(nextPage);
      else await loadCompanies({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applySearch(); }}
              placeholder="Nomi, tavsif yoki manzil bo'yicha qidirish…"
              className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            {searchInput && (
              <button
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

          <button
            onClick={applySearch}
            className="px-3.5 py-2.5 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Qidirish
          </button>

          <button
            onClick={() => void loadCompanies()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setModal({ type: "add" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" />
            Yangi tashkilot
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
                {["Tashkilot", "Telefon", "Manzil", "Holat", "Yaratilgan", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Tashkilot topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Yangi tashkilot qo'shing yoki qidiruvni o'zgartiring
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map(company => (
                  <tr key={company.id} className="border-b border-border hover:bg-secondary/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: primaryColor }}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {company.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">
                            {company.description || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap font-mono">
                      {company.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground max-w-[220px]">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{company.address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          company.active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {company.active ? "Faol" : "Faol emas"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: "edit", company })}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", company })}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
              ? "0 ta tashkilot"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total} ta`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
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
                p === "…"
                  ? <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      disabled={loading}
                      className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                      style={page === p
                        ? { background: primaryColor, color: "#fff" }
                        : { color: "var(--muted-foreground)" }
                      }
                    >
                      {p}
                    </button>
                  ),
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {modal?.type === "add" && (
        <CompanyCreateModal
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <CompanyEditModal
          initial={{
            name: modal.company.name,
            description: modal.company.description,
            address: modal.company.address,
            phone: formatPhoneNumber(modal.company.phone || PHONE_PREFIX),
            active: modal.company.active ?? true,
          }}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleUpdate}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">Tashkilotni o'chirish</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{modal.company.name}</span>
                {" "}ni o'chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setModal(null)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ha, o'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate-fade-in pointer-events-auto ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            }
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
