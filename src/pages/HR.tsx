import { AlertCircle } from "lucide-react";
import { Card, CardHeader, Table } from "../components/ui";
import { fmtSum } from "../data/mock";
import { formatUzDate } from "../lib/date";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import { apptTotal, isRevenue } from "../types";

// Litsenziya muddatiga qancha kun qolganini hisoblash (TZ 2.7: N kun oldin ogohlantirish)
function daysLeft(until: string, today: string): number {
  return Math.round(
    (new Date(until).getTime() - new Date(today).getTime()) / 86400000,
  );
}

export default function HR() {
  const { appointments, employees, doctors, today } = useStore();

  // Shifokor KPI bonusi: jalb qilingan tushumdan foiz (demo — bugungi to'lovlar bo'yicha)
  const revenueByDoctor = new Map<string, number>();
  for (const a of appointments) {
    if (!isRevenue(a)) continue;
    revenueByDoctor.set(
      a.doctorId,
      (revenueByDoctor.get(a.doctorId) ?? 0) + apptTotal(a),
    );
  }
  // Xodimni shifokor yozuviga ism bo'yicha bog'laymiz (keyinroq FK bilan almashadi)
  const docIdByName = new Map(doctors.map((d) => [d.name, d.id]));

  const expiring = employees.filter(
    (e) => e.licenseUntil && daysLeft(e.licenseUntil, today) <= 60,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("HR / Xodimlar")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Davomat, litsenziya nazorati va ish haqi (oklad + KPI bonus)
        </p>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>{t("Litsenziya muddati tugayapti:")}</b>
            <ul className="mt-1 list-inside list-disc">
              {expiring.map((e) => (
                <li key={e.id}>
                  {e.name} — {e.licenseUntil} gacha (
                  {daysLeft(e.licenseUntil!, today)} kun qoldi)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title={t("Bugungi davomat")} subtitle={formatUzDate(today)} />
        <Table head={[t("Xodim"), t("Lavozim"), t("Kelgan"), t("Ketgan"), t("Holat")]}>
          {employees.map((e) => (
            <tr key={e.id}>
              <td className="px-5 py-3 font-medium">{e.name}</td>
              <td className="px-5 py-3 text-slate-500">{e.position}</td>
              <td className="px-5 py-3">{e.todayIn ?? "—"}</td>
              <td className="px-5 py-3">{e.todayOut ?? "—"}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    e.todayIn
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {e.todayIn ? "Ishda" : "Kelmagan"}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader
          title={t("Ish haqi hisob-kitobi")}
          subtitle={t("Oklad + jalb qilingan tushumdan KPI foizi")}
        />
        <Table head={[t("Xodim"), t("Oklad"), t("KPI %"), t("Jalb qilingan tushum"), t("Bonus"), t("Jami")]}>
          {employees.map((e) => {
            const docId = docIdByName.get(e.name);
            const rev = docId ? (revenueByDoctor.get(docId) ?? 0) : 0;
            const bonus = Math.round((rev * e.kpiPercent) / 100);
            return (
              <tr key={e.id}>
                <td className="px-5 py-3 font-medium">{e.name}</td>
                <td className="px-5 py-3">{fmtSum(e.salaryBase)}</td>
                <td className="px-5 py-3 text-slate-500">
                  {e.kpiPercent > 0 ? `${e.kpiPercent}%` : "—"}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {rev > 0 ? fmtSum(rev) : "—"}
                </td>
                <td className="px-5 py-3 text-teal-700">
                  {bonus > 0 ? fmtSum(bonus) : "—"}
                </td>
                <td className="px-5 py-3 font-semibold">
                  {fmtSum(e.salaryBase + bonus)}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
