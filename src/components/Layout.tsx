import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Banknote,
  BookOpen,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardPlus,
  Cog,
  ShoppingCart,
  Wallet,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  RefreshCw,
  ScrollText,
  Stethoscope,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { todayUzFull } from "../lib/date";
import { LANGS, t } from "../lib/i18n";
import { useStore } from "../store";
import { ROLE_LABELS, type Role } from "../types";

const NAV: {
  to: string;
  label: string;
  icon: typeof Users;
  roles: Role[];
}[] = [
  { to: "/", label: "Boshqaruv paneli", icon: LayoutDashboard, roles: ["direktor", "hisobchi"] },
  { to: "/registratsiya", label: "Yangi qabul", icon: ClipboardPlus, roles: ["direktor", "registratura"] },
  { to: "/bemorlar", label: "Bemorlar", icon: Users, roles: ["direktor", "registratura"] },
  { to: "/qabullar", label: "Qabullar / Navbat", icon: CalendarDays, roles: ["direktor", "registratura"] },
  { to: "/kassa", label: "Kassa / To'lovlar", icon: Banknote, roles: ["direktor", "registratura", "hisobchi"] },
  { to: "/pos", label: "Sotuv (POS)", icon: ShoppingCart, roles: ["direktor", "registratura", "hisobchi"] },
  { to: "/sotuvlar", label: "Sotuvlar", icon: Banknote, roles: ["direktor", "registratura", "hisobchi"] },
  { to: "/smena", label: "Kassa smenasi", icon: Wallet, roles: ["direktor", "registratura", "hisobchi"] },
  { to: "/ombor", label: "Ombor", icon: Boxes, roles: ["direktor", "omborchi", "hisobchi"] },
  { to: "/shifokor", label: "Shifokor kabineti", icon: Stethoscope, roles: ["direktor", "shifokor"] },
  { to: "/laboratoriya", label: "Laboratoriya", icon: FlaskConical, roles: ["direktor", "laborant", "shifokor"] },
  { to: "/xodimlar", label: "HR / Xodimlar", icon: UsersRound, roles: ["direktor"] },
  { to: "/hisobotlar", label: "KPI / Hisobotlar", icon: BarChart3, roles: ["direktor", "hisobchi"] },
  { to: "/audit", label: "Audit jurnal", icon: ScrollText, roles: ["direktor"] },
  { to: "/sozlamalar", label: "Sozlamalar", icon: Cog, roles: ["direktor"] },
  { to: "/klinikalar", label: "Klinikalar", icon: Building2, roles: ["superadmin"] },
];

const ROLE_HOME: Record<Role, string> = {
  superadmin: "/klinikalar",
  direktor: "/",
  registratura: "/registratsiya",
  shifokor: "/shifokor",
  hisobchi: "/kassa",
  laborant: "/laboratoriya",
  omborchi: "/ombor",
};

export default function Layout() {
  const {
    role,
    setRole,
    source,
    loadError,
    retryLoad,
    dbError,
    clearDbError,
    toast,
    authState,
    profile,
    userEmail,
    signOut,
    clinic,
    lang,
    setLang,
  } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <div className="flex min-h-screen">
      {/* Mobil overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-900 transition-transform lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500">
              <HeartPulse size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold leading-tight text-white">KlinikaHMS</p>
              <p className="truncate text-[11px] text-slate-400">
                {profile?.role === "superadmin" ? t("Platforma") : clinic.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="rounded p-1 text-slate-400 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-teal-500/15 text-teal-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`
              }
            >
              <Icon size={18} />
              {t(label)}
            </NavLink>
          ))}
          <a
            href="/qollanma.html"
            target="_blank"
            rel="noopener"
            className="mt-2 flex items-center gap-3 rounded-lg border-t border-white/10 px-3 pt-3.5 pb-2.5 text-sm font-medium text-slate-400 transition hover:text-teal-300"
          >
            <BookOpen size={18} />
            {t("Qo'llanma")}
          </a>
        </nav>

        <div className="border-t border-white/10 p-4">
          {authState === "signedIn" ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-200">
                  {profile?.fullName ?? "..."}
                </p>
                <p className="truncate text-[11px] text-slate-500">{userEmail}</p>
              </div>
              <button
                onClick={signOut}
                title={t("Tizimdan chiqish")}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-rose-400"
              >
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Rol (demo uchun almashtiring)
              </p>
              <select
                value={role}
                onChange={(e) => {
                  const r = e.target.value as Role;
                  setRole(r);
                  navigate(ROLE_HOME[r]);
                }}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-2.5 py-2 text-sm text-slate-200 outline-none focus:border-teal-500"
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3.5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <Activity size={16} className="text-teal-600" />
              {todayUzFull()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    lang === l.code
                      ? "bg-teal-600 text-white"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {source === "supabase" ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                ● {t("Onlayn")}
              </span>
            ) : source === "loading" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                {t("Yuklanmoqda...")}
              </span>
            ) : source === "error" ? (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                {t("Ulanish xatosi")}
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Demo
              </span>
            )}
            <span className="hidden rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 sm:inline-block">
              {t(ROLE_LABELS[role])}
            </span>
          </div>
        </header>

        {/* Fon amali bazaga yozilmaganda ogohlantirish */}
        {dbError && (
          <div className="sticky top-[57px] z-30 flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 sm:px-8">
            <span className="flex items-center gap-2">
              <AlertTriangle size={15} /> {dbError}
            </span>
            <button
              onClick={clearDbError}
              className="rounded p-1 hover:bg-rose-100"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Muvaffaqiyat bildirishnomasi */}
        {toast && (
          <div className="fixed right-4 bottom-4 z-50 flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px]">
              ✓
            </span>
            {t(toast)}
          </div>
        )}

        <main className="p-4 sm:p-8">
          {source === "loading" ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">{t("Ma'lumotlar yuklanmoqda...")}</p>
            </div>
          ) : source === "error" ? (
            <div className="mx-auto mt-16 max-w-md rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
              <AlertTriangle size={32} className="mx-auto text-rose-500" />
              <h2 className="mt-3 text-lg font-bold">
                {t("Ma'lumotlarni yuklab bo'lmadi")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("Internet aloqasini tekshiring va qayta urining.")}
                {loadError && (
                  <span className="mt-1 block font-mono text-xs text-slate-400">
                    {loadError}
                  </span>
                )}
              </p>
              <button
                onClick={retryLoad}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <RefreshCw size={15} /> {t("Qayta urinish")}
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
