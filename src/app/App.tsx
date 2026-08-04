import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  LayoutDashboard, Users, Settings as SettingsIcon, Settings, ChevronLeft, ChevronDown, Shield,
  Sun, Moon, Monitor, Globe, LogOut, User, Edit3, X, Check,
  Bell, HelpCircle, UserPlus, Wallet, ClipboardList, FileBarChart2, Building2,
} from "lucide-react";
import {
  clearSession,
  isAuthenticated,
  getStoredUser,
  setStoredUser,
  type AuthUser,
} from "@/api/auth";
import { getUserById } from "@/api/user";
import { clearPdfTemplatesStorage } from "@/lib/pdfTemplate";
import {
  canAccessNav,
  getAllowedNavIds,
  getDefaultNavId,
} from "@/lib/roles";
import {
  LoginPage,
  DashboardPage,
  EmployeesPage,
  ManagementPage,
  CompaniesPage,
  PatientsPage,
  OrderPage,
  OrdersPage,
  ResultsPage,
  ShowResultPage,
  ProfilePage,
  EditProfilePage,
  SettingsPage,
} from "@/Pages";
import {
  isShowResultRoute,
  parseShowResultParams,
} from "@/lib/showResultLink";

/** User-menu pages — available to every authenticated role. */
const USER_PAGE_IDS = ["profile", "edit-profile", "settings"] as const;
type UserPageId = (typeof USER_PAGE_IDS)[number];

function isUserPage(id: string): id is UserPageId {
  return (USER_PAGE_IDS as readonly string[]).includes(id);
}

const USER_PAGE_LABELS: Record<UserPageId, string> = {
  profile: "Mening profilim",
  "edit-profile": "Profilni tahrirlash",
  settings: "Sozlamalar",
};

// ─── Persistence ──────────────────────────────────────────────────────────────

const PRIMARY_COLOR_KEY = "ses-primary-color";
const DEFAULT_PRIMARY_COLOR = "#0EA5E9";

function getStoredPrimaryColor(): string {
  try {
    const stored = localStorage.getItem(PRIMARY_COLOR_KEY);
    if (stored && /^#[0-9A-Fa-f]{6}$/.test(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_PRIMARY_COLOR;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { id: "management", label: "Boshqaruv", icon: SettingsIcon, section: "main" },
  { id: "companies", label: "Tashkilot yaratish", icon: Building2, section: "main" },
  { id: "patients", label: "Ro'yxatga olish", icon: UserPlus, section: "main" },
  { id: "kassa", label: "Kassa", icon: Wallet, section: "main" },
  { id: "orders", label: "Laborant mudiri", icon: ClipboardList, section: "main" },
  { id: "results", label: "Natijalar", icon: FileBarChart2, section: "main" },
  // { id: "employees", label: "Employees", icon: Users, section: "main" },
];

const PRESET_COLORS = [
  "#0EA5E9", "#6366F1", "#8B5CF6", "#EC4899",
  "#10B981", "#F59E0B", "#EF4444", "#14B8A6",
];

const NOTIFICATIONS = [
  { id: 1, text: "New application submitted by Alpha Pharma LLC", time: "2 min ago", unread: true },
  { id: 2, text: "Inspection #INS-0456 marked as completed", time: "1 hour ago", unread: true },
  { id: 3, text: "Certificate approved for Golden Food Factory", time: "3 hours ago", unread: false },
];

const GlobalStyles = () => (
  <style>{`
    * { font-family: 'Inter', system-ui, sans-serif; }

    @keyframes sesBlob {
      0%   { transform: translate(0px, 0px) scale(1); }
      33%  { transform: translate(45px, -65px) scale(1.12); }
      66%  { transform: translate(-35px, 35px) scale(0.88); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes sesParticle {
      0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
      8%   { opacity: 1; }
      92%  { opacity: 1; }
      100% { transform: translateY(-105vh) rotate(680deg); opacity: 0; }
    }
    @keyframes sesPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fadeInUp 0.25s ease-out both; }
    .ses-blob { border-radius: 50%; filter: blur(60px); position: absolute; }
    .ses-blob-1 { width: 380px; height: 380px; top: -120px; left: -120px; background: rgba(255,255,255,0.22); animation: sesBlob 18s ease-in-out infinite; }
    .ses-blob-2 { width: 300px; height: 300px; top: 50%; right: -90px; background: rgba(56,189,248,0.3); animation: sesBlob 24s ease-in-out infinite reverse; }
    .ses-blob-3 { width: 260px; height: 260px; bottom: -90px; left: 35%; background: rgba(14,165,233,0.25); animation: sesBlob 20s ease-in-out infinite 4s; }

    .ses-scrollbar::-webkit-scrollbar { width: 4px; }
    .ses-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .ses-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.35); border-radius: 4px; }
    .ses-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.35) transparent; }

    .ses-nav-scroll::-webkit-scrollbar { display: none; }
    .ses-nav-scroll { scrollbar-width: none; }

    body { overflow: hidden; }
  `}</style>
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type SidebarProps = {
  collapsed: boolean;
  activeNav: string;
  onNavChange: (id: string) => void;
  primaryColor: string;
  allowedNavIds: readonly string[];
};

const Sidebar = ({ collapsed, activeNav, onNavChange, primaryColor, allowedNavIds }: SidebarProps) => {
  const [lang, setLang] = useState("Lotin");
  const langs = [
    { id: "Lotin",   short: "Lat" },
    { id: "Кирилл", short: "Кир" },
    { id: "Русский", short: "Рус" },
  ];

  const allowed = new Set(allowedNavIds);
  const mainItems = NAV_ITEMS.filter(n => n.section === "main" && allowed.has(n.id));
  const sysItems  = NAV_ITEMS.filter(n => n.section === "system" && allowed.has(n.id));

  return (
    <aside
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width: collapsed ? "80px" : "280px",
        background: "#0B1526",
        transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${collapsed ? "justify-center" : ""}`}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
          style={{ background: primaryColor }}
        >
          <Shield className="w-[18px] h-[18px] text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-[13px] leading-tight whitespace-nowrap tracking-tight">SES Platform</div>
            <div className="text-white/35 text-[10px] whitespace-nowrap">Management System</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto ses-nav-scroll space-y-0.5">
        {!collapsed && (
          <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-3 py-2">Main Menu</p>
        )}
        {mainItems.map(item => (
          <SidebarItem key={item.id} item={item} collapsed={collapsed} active={activeNav === item.id} primaryColor={primaryColor} onNavChange={onNavChange} />
        ))}

        {/* <div className={collapsed ? "my-2 mx-3 border-t border-white/8" : ""} />
        {!collapsed && (
          <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-3 py-2 mt-3">System</p>
        )}
        {sysItems.map(item => (
          <SidebarItem key={item.id} item={item} collapsed={collapsed} active={activeNav === item.id} primaryColor={primaryColor} onNavChange={onNavChange} />
        ))} */}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-2 border-t border-white/5 space-y-1">
        {!collapsed ? (
          <div className="px-2 py-2">
            <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-2">Language</p>
            <div className="flex gap-1">
              {langs.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={l.id === lang
                    ? { background: primaryColor, color: "#fff" }
                    : { color: "rgba(255,255,255,0.35)" }
                  }
                >
                  {l.short}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-white/6 transition-colors"
            title="Language"
          >
            <Globe className="w-4 h-4 text-white/35" />
          </button>
        )}

        {!collapsed && (
          <a href="#" className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors group">
            <HelpCircle className="w-4 h-4 text-white/25 group-hover:text-white/55 transition-colors" />
            <span className="text-white/35 text-xs group-hover:text-white/65 transition-colors">Technical Support</span>
          </a>
        )}

       
      </div>
    </aside>
  );
};

const SidebarItem = ({ item, collapsed, active, primaryColor, onNavChange }: {
  item: typeof NAV_ITEMS[0]; collapsed: boolean; active: boolean;
  primaryColor: string; onNavChange: (id: string) => void;
}) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavChange(item.id)}
      title={collapsed ? item.label : undefined}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
        active
          ? "text-white"
          : "text-white/40 hover:text-white/75 hover:bg-white/5"
      } ${collapsed ? "justify-center" : ""}`}
      style={active ? { background: `${primaryColor}22` } : {}}
    >
      {active && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
          style={{ background: primaryColor }}
        />
      )}
      <Icon className="w-[18px] h-[18px] shrink-0" style={active ? { color: primaryColor } : {}} />
      {!collapsed && <span>{item.label}</span>}
    </button>
  );
};

// ─── Header ───────────────────────────────────────────────────────────────────

type HeaderProps = {
  activeNav: string;
  navLabelOverride?: string;
  isDark: boolean;
  onDarkToggle: () => void;
  onSettingsOpen: () => void;
  onUserNav: (id: UserPageId) => void;
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  primaryColor: string;
  user: AuthUser | null;
  onLogout: () => void;
};

const Header = ({
  activeNav, navLabelOverride, isDark, onDarkToggle, onSettingsOpen, onUserNav,
  sidebarCollapsed, onSidebarToggle, primaryColor, user, onLogout,
}: HeaderProps) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const displayName = user
    ? [user.username, user.surname].filter(Boolean).join(" ")
    : "User";
  const shortName = user?.username
    ? user.username.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
    : "U";
  const subtitle = user?.email ?? "";

  const navLabel =
    navLabelOverride ??
    (isUserPage(activeNav) ? USER_PAGE_LABELS[activeNav] : undefined) ??
    NAV_ITEMS.find(n => n.id === activeNav)?.label ??
    "Dashboard";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-16 flex items-center px-5 gap-3 border-b border-border bg-card/80 backdrop-blur-md shrink-0">
      {/* Collapse toggle */}
      <button
        onClick={onSidebarToggle}
        className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft
          className="w-4 h-4 transition-transform duration-300"
          style={{ transform: sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-semibold text-foreground leading-tight truncate">{navLabel}</h1>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>SES</span>
          <span className="text-border">·</span>
          <span style={{ color: primaryColor }}>{navLabel}</span>
        </div>
      </div>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
          className="relative p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-5 h-5" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-card"
            style={{ background: primaryColor }}
          />
        </button>

        {showNotif && (
          <div className="absolute right-0 top-12 w-80 bg-card rounded-2xl border border-border shadow-xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="font-semibold text-foreground text-sm">Notifications</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full text-white font-medium" style={{ background: primaryColor }}>
                2 new
              </span>
            </div>
            <div className="divide-y divide-border">
              {NOTIFICATIONS.map(n => (
                <div key={n.id} className="px-5 py-3.5 hover:bg-secondary/40 cursor-pointer transition-colors">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: n.unread ? primaryColor : "var(--muted)" }}
                    />
                    <div>
                      <p className="text-[13px] text-foreground leading-snug">{n.text}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{n.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border text-center">
              <button className="text-xs font-semibold" style={{ color: primaryColor }}>
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dark mode */}
      <button
        onClick={onDarkToggle}
        className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Settings */}
      <button
        onClick={onSettingsOpen}
        className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* User avatar + dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
          className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-xl hover:bg-secondary transition-colors"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: primaryColor }}
          >
            {shortName}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-[13px] font-semibold text-foreground leading-tight truncate max-w-[140px]">{displayName}</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{subtitle}</div>
          </div>
          <ChevronDown
            className="w-3.5 h-3.5 text-muted-foreground transition-transform"
            style={{ transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 top-12 w-52 bg-card rounded-2xl border border-border shadow-xl overflow-hidden z-50">
            {([
              { id: "profile" as const, icon: User, label: "Mening profilim" },
              { id: "edit-profile" as const, icon: Edit3, label: "Profilni tahrirlash" },
              { id: "settings" as const, icon: Settings, label: "Sozlamalar" },
            ]).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onUserNav(item.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-foreground hover:bg-secondary transition-colors"
              >
                <item.icon className="w-4 h-4 text-muted-foreground" />
                {item.label}
              </button>
            ))}
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); onLogout(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Chiqish
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// ─── Settings Modal ───────────────────────────────────────────────────────────

type SettingsModalProps = {
  isOpen: boolean; onClose: () => void;
  primaryColor: string; onColorChange: (c: string) => void;
  darkMode: "light" | "dark" | "system";
  onDarkModeChange: (m: "light" | "dark" | "system") => void;
};

const SettingsModal = ({ isOpen, onClose, primaryColor, onColorChange, darkMode, onDarkModeChange }: SettingsModalProps) => {
  const [localColor, setLocalColor] = useState(primaryColor);

  useEffect(() => { setLocalColor(primaryColor); }, [primaryColor]);

  if (!isOpen) return null;

  const modes = [
    { id: "light" as const, icon: Sun, label: "Light" },
    { id: "dark" as const, icon: Moon, label: "Dark" },
    { id: "system" as const, icon: Monitor, label: "System" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">UI Customization</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Personalize your workspace</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme Mode */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Appearance Mode</h3>
            <div className="grid grid-cols-3 gap-2">
              {modes.map(m => {
                const active = darkMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onDarkModeChange(m.id)}
                    className="flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all text-sm font-medium"
                    style={active
                      ? { background: localColor, borderColor: localColor, color: "#fff" }
                      : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                    }
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-xs">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Color */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Primary Color</h3>

            {/* Preview strip */}
            <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-xl mb-4">
              <div className="w-10 h-10 rounded-xl shadow-sm shrink-0" style={{ background: localColor }} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">Selected Color</div>
                <div className="text-xs text-muted-foreground font-mono">{localColor.toUpperCase()}</div>
              </div>
              <label className="relative cursor-pointer">
                <input
                  type="color"
                  value={localColor}
                  onChange={e => setLocalColor(e.target.value)}
                  className="sr-only"
                />
                <div
                  className="w-8 h-8 rounded-lg border-2 border-white/30 shadow"
                  style={{ background: localColor }}
                />
              </label>
            </div>

            {/* Preset grid */}
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setLocalColor(color)}
                  className="aspect-square rounded-xl transition-all hover:scale-110 relative shadow-sm"
                  style={{ background: color }}
                >
                  {localColor === color && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white drop-shadow" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Live Preview</h3>
            <div className="p-4 bg-secondary rounded-xl space-y-3">
              <div className="flex gap-2">
                <button
                  className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold"
                  style={{ background: localColor }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold border-2"
                  style={{ borderColor: localColor, color: localColor }}
                >
                  Outline
                </button>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full w-3/5 rounded-full transition-all" style={{ background: localColor }} />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-5 rounded-full p-0.5 flex items-center justify-end" style={{ background: localColor }}>
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
                <span className="text-xs text-muted-foreground">Toggle active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: localColor, background: localColor }} />
                <div className="w-3 h-3 rounded-full border-2 border-muted" />
                <span className="text-xs text-muted-foreground ml-1">Radio selection</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={() => { setLocalColor(DEFAULT_PRIMARY_COLOR); onColorChange(DEFAULT_PRIMARY_COLOR); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Reset Default
          </button>
          <button
            onClick={() => { onColorChange(localColor); onClose(); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: localColor }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard Layout ─────────────────────────────────────────────────────────

type DashboardProps = {
  primaryColor: string;
  isDark: boolean;
  onDarkToggle: () => void;
  onSettingsOpen: () => void;
  onColorChange: (c: string) => void;
  darkMode: "light" | "dark" | "system";
  onDarkModeChange: (m: "light" | "dark" | "system") => void;
  user: AuthUser | null;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
};

const Dashboard = ({
  primaryColor, isDark, onDarkToggle, onSettingsOpen,
  onColorChange, darkMode, onDarkModeChange,
  user, onUserUpdated, onLogout,
}: DashboardProps) => {
  const roleName = user?.role?.name ?? null;
  const allowedNavIds = useMemo(() => getAllowedNavIds(roleName), [roleName]);
  const defaultNav = useMemo(() => getDefaultNavId(roleName), [roleName]);

  const [collapsed, setCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState<string>(defaultNav);
  const [orderPatientId, setOrderPatientId] = useState<number | null>(null);
  const [editPatientId, setEditPatientId] = useState<number | null>(null);

  useEffect(() => {
    if (isUserPage(activeNav)) return;
    if (!canAccessNav(roleName, activeNav)) {
      setActiveNav(defaultNav);
      setOrderPatientId(null);
      setEditPatientId(null);
    }
  }, [roleName, activeNav, defaultNav]);

  const handleNavChange = (id: string) => {
    if (!canAccessNav(roleName, id)) return;
    setActiveNav(id);
    if (id !== "kassa") setOrderPatientId(null);
    if (id !== "patients") setEditPatientId(null);
  };

  const handleUserNav = (id: UserPageId) => {
    setOrderPatientId(null);
    setEditPatientId(null);
    setActiveNav(id);
  };

  const handleGoToOrder = (patientId: number) => {
    if (!canAccessNav(roleName, "kassa")) return;
    setEditPatientId(null);
    setOrderPatientId(patientId);
    setActiveNav("kassa");
  };

  const handleEditPatient = (patientId: number) => {
    if (!canAccessNav(roleName, "patients")) return;
    setOrderPatientId(null);
    setEditPatientId(patientId);
    setActiveNav("patients");
  };

  const renderPage = () => {
    if (activeNav === "profile") {
      return (
        <ProfilePage
          primaryColor={primaryColor}
          user={user}
          onEditProfile={() => setActiveNav("edit-profile")}
        />
      );
    }
    if (activeNav === "edit-profile") {
      return (
        <EditProfilePage
          primaryColor={primaryColor}
          user={user}
          onUserUpdated={onUserUpdated}
          onBackToProfile={() => setActiveNav("profile")}
        />
      );
    }
    if (activeNav === "settings") {
      return (
        <SettingsPage
          primaryColor={primaryColor}
          onColorChange={onColorChange}
          darkMode={darkMode}
          onDarkModeChange={onDarkModeChange}
        />
      );
    }

    if (!canAccessNav(roleName, activeNav)) return null;
    if (activeNav === "kassa") {
      return (
        <OrderPage
          primaryColor={primaryColor}
          patientId={orderPatientId}
          onPatientChange={setOrderPatientId}
          onEditPatient={handleEditPatient}
        />
      );
    }
    if (activeNav === "orders") return <OrdersPage primaryColor={primaryColor} />;
    if (activeNav === "results") return <ResultsPage primaryColor={primaryColor} />;
    if (activeNav === "patients") {
      return (
        <PatientsPage
          primaryColor={primaryColor}
          onGoToOrder={handleGoToOrder}
          initialPatientId={editPatientId}
          onInitialPatientConsumed={() => setEditPatientId(null)}
        />
      );
    }
    if (activeNav === "employees") return <EmployeesPage primaryColor={primaryColor} />;
    if (activeNav === "management") return <ManagementPage primaryColor={primaryColor} />;
    if (activeNav === "companies") return <CompaniesPage primaryColor={primaryColor} />;
    if (activeNav === "dashboard") return <DashboardPage primaryColor={primaryColor} />;
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        activeNav={activeNav}
        onNavChange={handleNavChange}
        primaryColor={primaryColor}
        allowedNavIds={allowedNavIds}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          activeNav={activeNav}
          isDark={isDark}
          onDarkToggle={onDarkToggle}
          onSettingsOpen={onSettingsOpen}
          onUserNav={handleUserNav}
          sidebarCollapsed={collapsed}
          onSidebarToggle={() => setCollapsed(c => !c)}
          primaryColor={primaryColor}
          user={user}
          onLogout={onLogout}
        />
        {renderPage()}
      </div>
    </div>
  );
};

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const showResultParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!isShowResultRoute(window.location.pathname)) return null;
    return parseShowResultParams(window.location.pathname, window.location.search);
  }, []);

  const [page, setPage] = useState<"login" | "dashboard">(() =>
    isAuthenticated() ? "dashboard" : "login",
  );
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [primaryColor, setPrimaryColor] = useState(getStoredPrimaryColor);
  const [darkMode, setDarkMode] = useState<"light" | "dark" | "system">("light");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ensure role is present for already-authenticated sessions
  useEffect(() => {
    if (page !== "dashboard" || !user?.id || user.role?.name) return;
    let cancelled = false;
    void getUserById(user.id)
      .then(full => {
        if (cancelled) return;
        const next: AuthUser = {
          ...user,
          role: full.role ?? user.role ?? null,
          company: full.company ?? user.company ?? null,
        };
        setStoredUser(next);
        setUser(next);
      })
      .catch(() => {
        /* role keyinroq yuklanishi mumkin */
      });
    return () => {
      cancelled = true;
    };
  }, [page, user]);

  const isDark = useMemo(() => {
    if (darkMode === "dark") return true;
    if (darkMode === "light") return false;
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [darkMode]);

  // Sync primary color CSS var + persist
  useEffect(() => {
    document.documentElement.style.setProperty("--primary", primaryColor);
    document.documentElement.style.setProperty("--primary-foreground", "#ffffff");
    document.documentElement.style.setProperty("--ring", primaryColor);
    try {
      localStorage.setItem(PRIMARY_COLOR_KEY, primaryColor);
    } catch {
      /* ignore */
    }
  }, [primaryColor]);

  // Sync dark mode class
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleLogin = (nextUser: AuthUser) => {
    setUser(nextUser);
    setPage("dashboard");
  };

  const handleLogout = () => {
    clearSession();
    clearPdfTemplatesStorage();
    setUser(null);
    setPage("login");
  };

  const onShowResultRoute = isShowResultRoute();

  if (onShowResultRoute && showResultParams) {
    return (
      <>
        <GlobalStyles />
        <ShowResultPage params={showResultParams} />
      </>
    );
  }

  if (onShowResultRoute && !showResultParams) {
    return (
      <>
        <GlobalStyles />
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900">Noto&apos;g&apos;ri havola</p>
            <p className="mt-2 text-sm text-slate-600">
              Format: /showresult/{"{orderId}"}/{"{analysisId}"}/{"{storageId}"}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      {page === "login" ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Dashboard
          primaryColor={primaryColor}
          isDark={isDark}
          onDarkToggle={() => setDarkMode(isDark ? "light" : "dark")}
          onSettingsOpen={() => setSettingsOpen(true)}
          onColorChange={setPrimaryColor}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
          user={user}
          onUserUpdated={setUser}
          onLogout={handleLogout}
        />
      )}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        primaryColor={primaryColor}
        onColorChange={setPrimaryColor}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
      />
    </>
  );
}
