import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  History,
  Lock,
  PlayCircle,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { Card } from "../components/ui";
import { fmtSum } from "../data/mock";
import { useOpenShift } from "../lib/cashSession";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import { apptTotal, isRevenue } from "../types";

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

export default function CashHub() {
  const { appointments, salesList, refundsList, today, profile } = useStore();
  const { shift, loaded } = useOpenShift();
  const navigate = useNavigate();

  if (profile && !["direktor", "registratura", "hisobchi"].includes(profile.role)) {
    return <p className="text-sm text-slate-500">{t("Bu sahifaga ruxsatingiz yo'q.")}</p>;
  }

  // ===== Bugungi ko'rsatkichlar: xizmatlar + mahsulot sotuvi birgalikda =====
  const todayAppts = appointments.filter((a) => a.date === today);
  const paidAppts = todayAppts.filter(isRevenue);
  const pending = todayAppts.filter((a) => a.status === "TOLOV_KUTILMOQDA");
  const pendingSum = pending.reduce((s, a) => s + apptTotal(a), 0);

  const serviceTotal = paidAppts.reduce((s, a) => s + apptTotal(a), 0);
  const serviceCash = paidAppts
    .filter((a) => a.paymentMethod === "Naqd")
    .reduce((s, a) => s + apptTotal(a), 0);

  const todaySales = salesList.filter((s) => s.date === today);
  const todayRefunds = refundsList.filter((r) => r.date === today);
  const posGross = todaySales.reduce((s, x) => s + x.total, 0);
  const posRefund = todayRefunds.reduce((s, r) => s + r.amount, 0);
  const posTotal = posGross - posRefund;
  // Qaytarishning naqd ulushi — aralash to'lovda proporsional (server bilan bir xil)
  const posCash =
    todaySales.reduce(
      (s, x) => s + x.payments.filter((p) => p.method === "Naqd").reduce((a, p) => a + p.amount, 0),
      0,
    ) -
    todayRefunds.reduce((s, r) => {
      const sale = salesList.find((x) => x.id === r.saleId);
      if (!sale || sale.total === 0) return s;
      const cashPart = sale.payments
        .filter((p) => p.method === "Naqd")
        .reduce((a, p) => a + p.amount, 0);
      return s + Math.round(r.amount * Math.min(1, cashPart / sale.total));
    }, 0);

  const grandTotal = serviceTotal + posTotal;
  const cashTotal = serviceCash + posCash;

  const tabs = [
    { to: "/kassa", end: true, label: "Xizmat to'lovlari", icon: Banknote, badge: pending.length },
    { to: "/kassa/pos", label: "Mahsulot sotish", icon: ShoppingCart },
    { to: "/kassa/sotuvlar", label: "Sotuvlar tarixi", icon: History },
    { to: "/kassa/smena", label: "Smena", icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Kassa")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("To'lov qabul qilish, dori sotish va kassa smenasi — hammasi shu yerda")}
          </p>
        </div>
      </div>

      {/* ===== Smena holati ===== */}
      {loaded &&
        (shift ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-2 font-semibold text-emerald-800">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                {t("Smena ochiq")}
              </span>
              <span className="text-emerald-800/80">
                {fmtTime(shift.openedAt)} {t("dan")} · {shift.openedByName}
              </span>
              <span className="text-emerald-900">
                {t("Kassada bo'lishi kerak")}: <b>{fmtSum(shift.expectedCash)}</b>
              </span>
            </div>
            <button
              onClick={() => navigate("/kassa/smena", { state: { shiftAction: "close" } })}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              <Lock size={14} /> {t("Smenani yopish")}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5">
            <p className="flex items-center gap-2.5 text-sm text-amber-900">
              <AlertTriangle size={17} className="shrink-0 text-amber-600" />
              <span>
                <b>{t("Smena ochilmagan.")}</b>{" "}
                {t("Kunni boshlashda kassadagi naqdni sanab smena oching — shunda kun oxirida kassa avtomatik solishtiriladi.")}
              </span>
            </p>
            <button
              onClick={() => navigate("/kassa/smena", { state: { shiftAction: "open" } })}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              <PlayCircle size={15} /> {t("Smena ochish")}
            </button>
          </div>
        ))}

      {/* ===== Bugungi jami ===== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t("Bugungi tushum")}</p>
          <p className="mt-1 text-xl font-bold text-teal-700 tabular-nums sm:text-2xl">
            {fmtSum(grandTotal)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {t("Xizmat")}: {fmtSum(serviceTotal)} · {t("Mahsulot")}: {fmtSum(posTotal)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t("Naqd")}</p>
          <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{fmtSum(cashTotal)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{t("Qaytarishlar ayirilgan")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t("Karta / onlayn")}</p>
          <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">
            {fmtSum(grandTotal - cashTotal)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{t("Click, Payme, Uzum, karta")}</p>
        </Card>
        <button
          onClick={() => navigate("/kassa")}
          className={`rounded-2xl border p-4 text-left shadow-sm transition ${
            pending.length > 0
              ? "border-amber-300 bg-amber-50 hover:bg-amber-100"
              : "border-slate-200/80 bg-white"
          }`}
        >
          <p className={`text-xs font-medium ${pending.length > 0 ? "text-amber-800" : "text-slate-500"}`}>
            {t("To'lov kutmoqda")}
          </p>
          <p
            className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${
              pending.length > 0 ? "text-amber-700" : "text-slate-300"
            }`}
          >
            {pending.length} {t("bemor")}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {pending.length > 0 ? fmtSum(pendingSum) : t("Hamma to'lagan")}
          </p>
        </button>
      </div>

      {/* ===== Tablar ===== */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tb) => (
          <NavLink
            key={tb.to}
            to={tb.to}
            end={tb.end}
            className={({ isActive }) =>
              `inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
                isActive ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <tb.icon size={16} />
                {t(tb.label)}
                {!!tb.badge && (
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs font-bold ${
                      isActive ? "bg-white/25 text-white" : "bg-amber-500 text-white"
                    }`}
                  >
                    {tb.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
