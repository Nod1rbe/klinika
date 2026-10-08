import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardHeader, Table } from "../components/ui";
import { fmtSum } from "../data/mock";
import { isoDate } from "../lib/date";
import { useStore } from "../store";
import { apptTotal, isRevenue } from "../types";

const COLORS = ["#0d9488", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e", "#64748b"];

type Period = "today" | "7d" | "30d" | "all";
const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Bugun" },
  { key: "7d", label: "7 kun" },
  { key: "30d", label: "30 kun" },
  { key: "all", label: "Hammasi" },
];

export default function Reports() {
  const { appointments, doctors, services, salesList, refundsList, products, purchases } =
    useStore();
  const [period, setPeriod] = useState<Period>("today");

  const fromIso = useMemo(() => {
    if (period === "all") return "";
    const d = new Date();
    if (period === "7d") d.setDate(d.getDate() - 6);
    if (period === "30d") d.setDate(d.getDate() - 29);
    return isoDate(d);
  }, [period]);

  const inPeriod = (date: string) => period === "all" || date >= fromIso;
  const paid = appointments.filter((a) => isRevenue(a) && inPeriod(a.date));
  const totalRevenue = paid.reduce((s, a) => s + apptTotal(a), 0);

  // Vrachlar statistikasi — bemorlar soni va summasi bilan
  const byDoctor = doctors
    .filter((d) => d.active)
    .map((d) => {
      const list = paid.filter((a) => a.doctorId === d.id);
      const revenue = list.reduce((s, a) => s + apptTotal(a), 0);
      const done = appointments.filter(
        (a) =>
          a.doctorId === d.id && a.status === "YAKUNLANDI" && inPeriod(a.date),
      ).length;
      return {
        ...d,
        patients: list.length,
        revenue,
        done,
        avg: list.length ? Math.round(revenue / list.length) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const byDept = new Map<string, number>();
  for (const a of paid) {
    for (const it of a.items) {
      const s = services.find((x) => x.id === it.serviceId);
      const dept = s?.category || s?.department || "Boshqa";
      byDept.set(dept, (byDept.get(dept) ?? 0) + it.price * (it.qty ?? 1));
    }
  }
  const deptData = [...byDept.entries()].map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPI / Hisobotlar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Davr tushumi: <b className="text-teal-700">{fmtSum(totalRevenue)}</b> ·{" "}
            {paid.length} ta to'langan qabul
          </p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                period === p.key
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Vrachlar statistikasi"
            subtitle="Bemorlar soni va tushum summasi bilan"
          />
          <Table head={["Shifokor", "Bemorlar", "Yakunlangan", "Tushum", "O'rtacha chek"]}>
            {byDoctor.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-slate-400">{d.specialty}</p>
                </td>
                <td className="px-5 py-3">{d.patients}</td>
                <td className="px-5 py-3">{d.done}</td>
                <td className="px-5 py-3 font-semibold">
                  {d.revenue ? fmtSum(d.revenue) : "—"}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {d.avg ? fmtSum(d.avg) : "—"}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold">
              <td className="px-5 py-3">JAMI</td>
              <td className="px-5 py-3">{paid.length}</td>
              <td className="px-5 py-3">
                {appointments.filter((a) => a.status === "YAKUNLANDI" && inPeriod(a.date)).length}
              </td>
              <td className="px-5 py-3 text-teal-700">{fmtSum(totalRevenue)}</td>
              <td className="px-5 py-3" />
            </tr>
          </Table>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Yo'nalishlar bo'yicha tushum" />
          <div className="p-5">
            {deptData.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Bu davrda to'lovlar yo'q
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={deptData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtSum(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ============ MAHSULOT SAVDOSI (POS) ============ */}
      {(() => {
        const periodSales = salesList.filter((s) => inPeriod(s.date));
        const periodRefunds = refundsList
          .filter((r) => inPeriod(r.date))
          .reduce((a, r) => a + r.amount, 0);
        const revenue = periodSales.reduce((a, s) => a + s.total, 0) - periodRefunds;
        // Tannarx — har qatorning sotuv paytidagi o'rtacha tannarx snapshoti
        // bo'yicha (qaytarilgan miqdor ayirilgan) — foyda to'g'ri hisoblanadi
        const cogs = periodSales.reduce(
          (a, s) =>
            a +
            s.items.reduce(
              (b, it) => b + it.costAtSale * Math.max(0, it.qty - it.refundedQty),
              0,
            ),
          0,
        );
        const discounts = periodSales.reduce((a, s) => a + s.discount, 0);
        const stockValue = products.reduce((a, p) => a + p.avgCost * p.stock, 0);
        const payable = purchases.reduce(
          (a, pu) =>
            a + (pu.status === "QABUL_QILINDI" ? pu.total - pu.paidAmount : 0),
          0,
        );

        const byProduct = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
        for (const s of periodSales) {
          for (const it of s.items) {
            const net = Math.max(0, it.qty - it.refundedQty);
            const g = byProduct.get(it.productId) ?? {
              name: it.name, qty: 0, revenue: 0, profit: 0,
            };
            g.qty += net;
            g.revenue += net * it.unitPrice;
            g.profit += net * (it.unitPrice - it.costAtSale);
            byProduct.set(it.productId, g);
          }
        }
        const prodRows = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue);

        const byMethod = new Map<string, number>();
        for (const s of periodSales)
          for (const p of s.payments)
            byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);

        if (periodSales.length === 0 && products.length === 0) return null;
        return (
          <Card>
            <CardHeader
              title="Mahsulot savdosi (POS)"
              subtitle="Yalpi foyda o'rtacha tannarx usulida — sotuv paytidagi tannarx bo'yicha"
            />
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-5 py-4 text-sm lg:grid-cols-6">
              <div>
                <p className="text-slate-500">Sof tushum</p>
                <p className="mt-0.5 text-lg font-bold text-teal-700">{fmtSum(revenue)}</p>
              </div>
              <div>
                <p className="text-slate-500">Tannarx (COGS)</p>
                <p className="mt-0.5 text-lg font-bold">{fmtSum(cogs)}</p>
              </div>
              <div>
                <p className="text-slate-500">Yalpi foyda</p>
                <p className="mt-0.5 text-lg font-bold text-emerald-700">
                  {fmtSum(revenue - cogs)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Chegirmalar</p>
                <p className="mt-0.5 text-lg font-bold">{fmtSum(discounts)}</p>
              </div>
              <div>
                <p className="text-slate-500">Ombor qiymati (hozir)</p>
                <p className="mt-0.5 text-lg font-bold">{fmtSum(stockValue)}</p>
              </div>
              <div>
                <p className="text-slate-500">Ta'minotchi qarzi</p>
                <p className={`mt-0.5 text-lg font-bold ${payable > 0 ? "text-rose-600" : ""}`}>
                  {fmtSum(payable)}
                </p>
              </div>
            </div>
            {byMethod.size > 0 && (
              <p className="border-b border-slate-100 px-5 py-2.5 text-xs text-slate-500">
                To'lov usullari:{" "}
                {[...byMethod.entries()]
                  .map(([m, a]) => `${m} — ${fmtSum(a)}`)
                  .join(" · ")}
              </p>
            )}
            <Table head={["Mahsulot", "Sotildi", "Tushum", "Yalpi foyda"]}>
              {prodRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-sm text-slate-400">
                    Bu davrda mahsulot sotuvlari yo'q
                  </td>
                </tr>
              )}
              {prodRows.slice(0, 30).map((r, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3">{r.qty}</td>
                  <td className="px-5 py-3 font-semibold">{fmtSum(r.revenue)}</td>
                  <td className="px-5 py-3 text-emerald-700">{fmtSum(r.profit)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        );
      })()}
    </div>
  );
}
