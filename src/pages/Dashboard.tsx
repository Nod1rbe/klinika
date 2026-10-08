import {
  Banknote,
  CalendarCheck2,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, StatCard, StatusBadge, Table } from "../components/ui";
import { fmtSum } from "../data/mock";
import { isoDate, shortUzDate } from "../lib/date";
import { useStore } from "../store";
import { apptTotal, isRevenue } from "../types";

export default function Dashboard() {
  const { appointments, patients, doctors, today, salesList, refundsList, products } =
    useStore();
  const todayList = appointments.filter((a) => a.date === today);
  const paidToday = todayList.filter(isRevenue);
  const revenue = paidToday.reduce((sum, a) => sum + apptTotal(a), 0);
  const newPatients = patients.filter((p) => p.createdAt === today).length;
  const busyDoctors = new Set(
    todayList.filter((a) => a.status === "QABULDA").map((a) => a.doctorId),
  ).size;

  // Mahsulot savdosi (POS) ko'rsatkichlari
  const prodSalesToday =
    salesList.filter((s) => s.date === today).reduce((s, x) => s + x.total, 0) -
    refundsList.filter((r) => r.date === today).reduce((s, r) => s + r.amount, 0);
  const lowStock = products.filter((p) => p.active && p.stock <= p.minStock).length;

  // Oxirgi 7 kunlik tushum — haqiqiy to'lovlardan hisoblanadi
  const base = new Date(`${today}T12:00:00`);
  const revenue7d = [...Array(7)].map((_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() - 6 + i);
    const iso = isoDate(d);
    const tushum = appointments
      .filter((a) => a.date === iso && isRevenue(a))
      .reduce((s, a) => s + apptTotal(a), 0);
    return { day: shortUzDate(d), tushum };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Boshqaruv paneli</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bugungi holat — bir qarashda
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CalendarCheck2 size={20} />}
          label="Bugungi qabullar"
          value={String(todayList.length)}
          hint={`${todayList.filter((a) => a.status === "YAKUNLANDI").length} tasi yakunlangan`}
          tone="teal"
        />
        <StatCard
          icon={<Banknote size={20} />}
          label="Bugungi tushum"
          value={fmtSum(revenue)}
          hint={`${paidToday.length} ta to'lov`}
          tone="sky"
        />
        <StatCard
          icon={<UserPlus size={20} />}
          label="Yangi bemorlar"
          value={String(newPatients)}
          hint="Bugun ro'yxatga olindi"
          tone="amber"
        />
        <StatCard
          icon={<Stethoscope size={20} />}
          label="Band shifokorlar"
          value={`${busyDoctors} / ${doctors.filter((d) => d.active).length}`}
          hint="Hozir qabulda"
          tone="violet"
        />
      </div>

      {(products.length > 0 || prodSalesToday > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={<Banknote size={20} />}
            label="Bugungi mahsulot savdosi (POS)"
            value={fmtSum(prodSalesToday)}
            hint={`${salesList.filter((s) => s.date === today).length} ta sotuv · qaytarishlar ayirilgan`}
            tone="teal"
          />
          <StatCard
            icon={<CalendarCheck2 size={20} />}
            label="Kam qolgan mahsulotlar"
            value={String(lowStock)}
            hint={lowStock > 0 ? "Ombor bo'limida ko'ring" : "Hammasi yetarli"}
            tone={lowStock > 0 ? "amber" : "sky"}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Haftalik tushum"
            subtitle="Oxirgi 7 kun, so'mda"
          />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenue7d}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={(v: number) => `${v / 1000000} mln`}
                />
                <Tooltip formatter={(v) => fmtSum(Number(v))} />
                <Bar dataKey="tushum" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Bugungi navbat" subtitle="Barcha holatlar" />
          <Table head={["№", "Vaqt", "Bemor", "Holat"]}>
            {todayList
              .slice()
              .sort((a, b) => (a.queueNo ?? 999) - (b.queueNo ?? 999))
              .map((a) => {
                const p = patients.find((x) => x.id === a.patientId);
                return (
                  <tr key={a.id}>
                    <td className="px-5 py-3 font-bold text-teal-600">
                      {a.queueNo ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-600">
                      {a.time}
                    </td>
                    <td className="px-5 py-3">{p?.fullName.split(" ").slice(0, 2).join(" ")}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                );
              })}
          </Table>
        </Card>
      </div>
    </div>
  );
}
