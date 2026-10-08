import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import {
  Card,
  CardHeader,
  inputCls,
  Modal,
  PrimaryButton,
  StatusBadge,
  Table,
} from "../components/ui";
import { fmtSum } from "../data/mock";
import { formatUzDate } from "../lib/date";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import { apptTotal, isRevenue } from "../types";

export default function Appointments() {
  const {
    appointments,
    patients,
    doctors,
    services,
    setAppointmentStatus,
    notify,
    today,
  } = useStore();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState<string | null>(null);
  // Oldingi kunlar hisoboti: istalgan sanani tanlab ko'rish mumkin
  const [date, setDate] = useState(today);

  const dayList = appointments
    .filter((a) => a.date === date)
    .sort((a, b) => (a.queueNo ?? 999) - (b.queueNo ?? 999));
  const dayRevenue = dayList
    .filter(isRevenue)
    .reduce((s, a) => s + apptTotal(a), 0);
  const dayCancelled = dayList.filter((a) => a.status === "BEKOR").length;

  const cancellingAppt = appointments.find((a) => a.id === cancelling);

  function doCancel() {
    if (!cancelling) return;
    setAppointmentStatus(cancelling, "BEKOR");
    setCancelling(null);
    notify(t("Qabul bekor qilindi"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Qabullar / Navbat")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Sana tanlab oldingi kunlar hisobotini ham ko'rishingiz mumkin")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            className={`${inputCls} w-44`}
          />
          <PrimaryButton onClick={() => navigate("/registratsiya")}>
            <CalendarPlus size={16} /> {t("Yangi qabul")}
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Qabullar soni")}</p>
          <p className="mt-1 text-2xl font-bold">{dayList.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Kun tushumi")}</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">
            {fmtSum(dayRevenue)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Bekor qilingan")}</p>
          <p
            className={`mt-1 text-2xl font-bold ${dayCancelled > 0 ? "text-rose-600" : "text-slate-300"}`}
          >
            {dayCancelled}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={date === today ? t("Bugungi qabullar") : t("Qabullar hisoboti")}
          subtitle={formatUzDate(date)}
        />
        <Table head={[t("№"), t("Vaqt"), t("Bemor"), t("Shifokor"), t("Xizmatlar"), t("Summa"), t("Holat"), ""]}>
          {dayList.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                {date === today
                  ? "Bugun hali qabullar yo'q — «Yangi qabul» tugmasidan boshlang"
                  : "Bu kunda qabullar bo'lmagan"}
              </td>
            </tr>
          )}
          {dayList.map((a) => {
            const p = patients.find((x) => x.id === a.patientId);
            const d = doctors.find((x) => x.id === a.doctorId);
            const names = a.items
              .map((it) => {
                const n = services.find((s) => s.id === it.serviceId)?.name ?? "?";
                return it.qty && it.qty > 1 ? `${n} ×${it.qty}` : n;
              })
              .join(", ");
            const cancelled = a.status === "BEKOR";
            return (
              <tr
                key={a.id}
                className={cancelled ? "text-slate-400" : "hover:bg-slate-50"}
              >
                <td className="px-5 py-3 text-lg font-bold text-teal-600">
                  {a.queueNo ?? "—"}
                </td>
                <td className="px-5 py-3 font-medium">{a.time}</td>
                <td className={`px-5 py-3 ${cancelled ? "line-through" : ""}`}>
                  {p?.fullName}
                </td>
                <td className="px-5 py-3 text-slate-500">{d?.name}</td>
                <td className="max-w-56 px-5 py-3 text-slate-500">
                  <span className="line-clamp-2">{names}</span>
                </td>
                <td className="px-5 py-3 font-semibold">{fmtSum(apptTotal(a))}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  {a.status !== "YAKUNLANDI" &&
                    a.status !== "BEKOR" &&
                    date === today && (
                      <button
                        onClick={() => setCancelling(a.id)}
                        className="text-sm font-medium text-rose-500 hover:text-rose-600"
                      >
                        {t("Bekor")}
                      </button>
                    )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {cancellingAppt && (
        <Modal title={t("Qabulni bekor qilish")} onClose={() => setCancelling(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>
                <b>
                  {patients.find((x) => x.id === cancellingAppt.patientId)?.fullName}
                </b>
                {t("ning qabuli bekor qilinadi.")}
                {cancellingAppt.paidAt && (
                  <>
                    {" "}
                    Bu qabul uchun <b>{fmtSum(apptTotal(cancellingAppt))}</b>{" "}
                    to'lov qilingan — u <b>{t("qaytarilgan")}</b> deb belgilanadi va
                    {t("bugungi tushumdan chiqariladi.")}
                  </>
                )}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelling(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t("Yo'q")}
              </button>
              <button
                onClick={doCancel}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                {t("Ha, bekor qilinsin")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
