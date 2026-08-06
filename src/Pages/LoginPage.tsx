import * as React from "react";
import { useState } from "react";
import {
  Shield, Eye, EyeOff, Check, Globe, Building2, Activity,
  CheckCircle, ExternalLink, AlertCircle,
} from "lucide-react";
import {
  login as loginApi,
  saveSession,
  setStoredUser,
  ApiError,
  type AuthUser,
} from "@/api/auth";
import { getUserById } from "@/api/user";
import {
  clearPdfTemplatesStorage,
  fetchPdfTemplatesFromApi,
} from "@/lib/pdfTemplate";

async function resolveUserWithRole(user: AuthUser): Promise<AuthUser> {
  if (user.role?.name) return user;
  try {
    const full = await getUserById(user.id);
    return {
      ...user,
      role: full.role ?? user.role ?? null,
      company: full.company ?? user.company ?? null,
    };
  } catch {
    return user;
  }
}

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 3.7 + 2) % 100}%`,
  delay: `${(i * 0.65) % 14}s`,
  duration: `${13 + (i * 1.1) % 16}s`,
  size: `${4 + (i * 2) % 9}px`,
  opacity: 0.08 + (i * 0.025) % 0.28,
}));

const QUICK_LINKS = [
  {
    icon: Globe,
    label: "Malaka oshirish",
    desc: "study.sanepid.uz",
    url: "https://study.sanepid.uz",
  },
  {
    icon: Activity,
    label: "Raqamli laboratoriya tizimi",
    desc: "labaratoriya.tris.uz",
    url: "https://labaratoriya.tris.uz",
  },
  {
    icon: Building2,
    label: "YKEM — epidemiologik monitoring",
    desc: "ykem.sanepid.uz",
    url: "https://ykem.sanepid.uz",
  },
  {
    icon: CheckCircle,
    label: "Gepatit axborot tizimi",
    desc: "gepatit.sanepid.uz",
    url: "https://gepatit.sanepid.uz",
  },
];

export const LoginPage = ({ onLogin }: { onLogin: (user: AuthUser) => void }) => {
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email va parolni kiriting");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setError("To'g'ri email kiriting");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await loginApi({ email: trimmedEmail, password });
      clearPdfTemplatesStorage();
      saveSession(data, remember);
      void fetchPdfTemplatesFromApi().catch(() => {
        /* shablonlar keyinroq yuklanadi */
      });
      const { password: _pw, ...baseUser } = data.user;
      const user = await resolveUserWithRole(baseUser);
      setStoredUser(user);
      onLogin(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof TypeError) {
        setError("Serverga ulanib bo'lmadi. Backend ishlayotganini tekshiring.");
      } else {
        setError("Kirish muvaffaqiyatsiz. Qayta urinib ko'ring.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) void handleLogin();
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Animated ── */}
      <div
        className="w-1/2 relative flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0C4A6E 0%, #0369A1 40%, #0EA5E9 75%, #38BDF8 100%)" }}
      >
        {/* Blobs */}
        <div className="ses-blob ses-blob-1" />
        <div className="ses-blob ses-blob-2" />
        <div className="ses-blob ses-blob-3" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "44px 44px"
        }} />

        {/* Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full bg-white"
              style={{
                left: p.left, bottom: "-20px",
                width: p.size, height: p.size,
                opacity: p.opacity,
                animation: `sesParticle ${p.duration} ${p.delay} infinite linear`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-[420px] px-10">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-[15px] leading-tight tracking-tight">SES Platformasi</div>
              <div className="text-white/55 text-xs">O'zbekiston Respublikasi</div>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-[38px] font-bold text-white mb-3 leading-[1.15] tracking-tight">
            Xush<br />kelibsiz
          </h1>
          <p className="text-white/60 text-sm mb-10 leading-relaxed max-w-xs">
            Sanitariya-epidemiologiya xizmati boshqaruv platformasiga kirish. Barcha sessiyalar shifrlangan va nazorat qilinadi.
          </p>

          {/* Form card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/18 p-6 shadow-2xl">
            <div className="mb-4">
              <label className="block text-white/75 text-xs font-semibold uppercase tracking-wider mb-2">Elektron pochta</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                onKeyDown={handleKey}
                placeholder="adx@gmail.com"
                className="w-full bg-white/10 border border-white/18 rounded-xl px-4 py-3 text-white placeholder-white/35 text-sm focus:outline-none focus:border-white/45 focus:bg-white/15 transition-all"
              />
            </div>

            <div className="mb-5">
              <label className="block text-white/75 text-xs font-semibold uppercase tracking-wider mb-2">Parol</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={handleKey}
                  placeholder="Parolingizni kiriting"
                  className="w-full bg-white/10 border border-white/18 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/35 text-sm focus:outline-none focus:border-white/45 focus:bg-white/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-500/20 border border-red-400/30 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-200 shrink-0 mt-0.5" />
                <p className="text-red-100 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-2.5 mb-6">
              <button
                type="button"
                onClick={() => setRemember(!remember)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${remember ? "bg-white border-white" : "border-white/40 hover:border-white/65"}`}
              >
                {remember && <Check className="w-2.5 h-2.5 text-sky-600" />}
              </button>
              <span className="text-white/60 text-sm select-none cursor-pointer" onClick={() => setRemember(!remember)}>
                Meni ushbu qurilmada eslab qol
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading}
              className="w-full bg-white font-semibold py-3 rounded-xl text-sm transition-all hover:bg-white/92 active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-80"
              style={{ color: "#0369A1" }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-sky-600/30 border-t-sky-600 rounded-full animate-spin" />
                  Kirilmoqda…
                </>
              ) : "Tizimga kirish"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Clean ── */}
      <div className="w-1/2 bg-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-14">
          {/* Logo */}
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-7 shadow-xl shadow-sky-200"
            style={{ background: "linear-gradient(140deg, #0369A1, #0EA5E9 60%, #38BDF8)" }}
          >
            <Shield className="w-12 h-12 text-white" />
          </div>

          <h2 className="text-[22px] font-bold text-slate-800 mb-2 text-center tracking-tight leading-tight">
            Sanitariya-Epidemiologiya<br />Xizmati
          </h2>
          <p className="text-slate-400 text-sm text-center mb-10 max-w-[280px] leading-relaxed">
            Sanitariya nazorati, laboratoriya tekshiruvlari va sog'liqni saqlash sertifikatlari uchun yagona platforma.
          </p>

          {/* Quick links */}
          <div className="w-full max-w-[340px]">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-3 px-1">Tezkor havolalar</p>
            <div className="space-y-1.5">
              {QUICK_LINKS.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 hover:border-sky-100 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0 group-hover:bg-sky-100 transition-colors">
                    <link.icon className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-700 group-hover:text-sky-700 transition-colors leading-tight">{link.label}</div>
                    <div className="text-[11px] text-slate-400">{link.desc}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-400 transition-colors shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
