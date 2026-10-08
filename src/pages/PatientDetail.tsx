import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, HeartPulse } from "lucide-react";
import { Card, CardHeader, StatusBadge, Table } from "../components/ui";
import { fmtSum } from "../data/mock";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";
import { useStore } from "../store";

export default function PatientDetail() {
  const { id } = useParams();
  const { patients, appointments, labOrders, doctors, services, salesList, refundsList, profile } =
    useStore();

  // Audit (TZ 2.9): bemor kartasi ochilganini qayd qilamiz.
  // Ref — StrictMode'ning ikki martalik effektida dublikat yozuvni oldini oladi.
  const loggedId = useRef<string | null>(null);
  useEffect(() => {
    if (!id || loggedId.current === id) return;
    loggedId.current = id;
    supabase
      ?.rpc("log_view", { p_entity: "patients", p_entity_id: id })
      .then(({ error }) => {
        if (error) console.error("Audit log xatosi:", error.message);
      });
  }, [id]);
  const p = patients.find((x) => x.id === id);
  if (!p) return <p>{t("Bemor topilmadi.")}</p>;

  const visits = appointments
    .filter((a) => a.patientId === p.id)
    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  const labs = labOrders.filter((l) => l.patientId === p.id);
  const age = new Date().getFullYear() - new Date(p.birthDate).getFullYear();

  return (
    <div className="space-y-6">
      <Link
        to="/bemorlar"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} /> Bemorlar ro'yxatiga qaytish
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-700">
              {p.fullName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold">{p.fullName}</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                <span className="font-mono">{p.id}</span> · {p.gender}, {age} yosh
                · {p.phone}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Pasport: {p.passport ?? "—"} · JSHSHIR: {p.pinfl ?? "—"} ·{" "}
                {p.address}
              </p>
            </div>
          </div>
        </div>

        {(p.allergies.length > 0 || p.chronic.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {p.allergies.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
              >
                <AlertTriangle size={13} /> Allergiya: {a}
              </span>
            ))}
            {p.chronic.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
              >
                <HeartPulse size={13} /> {c}
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={t("Tashrif tarixi")} subtitle={t("Elektron tibbiy karta (EMR)")} />
          <div className="divide-y divide-slate-100">
            {visits.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-400">{t("Tashriflar yo'q")}</p>
            )}
            {visits.map((v) => {
              const doc = doctors.find((d) => d.id === v.doctorId);
              const names = v.items
                .map((it) => {
                  const n = services.find((s) => s.id === it.serviceId)?.name ?? "?";
                  return it.qty && it.qty > 1 ? `${n} ×${it.qty}` : n;
                })
                .join(", ");
              const vTotal = v.items.reduce(
                (s, it) => s + it.price * (it.qty ?? 1),
                0,
              );
              return (
                <div key={v.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {v.date} {v.time} — {doc?.name}{" "}
                      <span className="font-normal text-slate-400">
                        ({doc?.specialty})
                      </span>
                    </p>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {names} · {fmtSum(vTotal)}
                  </p>
                  {v.complaint && (
                    <p className="mt-2 text-sm">
                      <span className="text-slate-400">{t("Shikoyat:")}</span> {v.complaint}
                    </p>
                  )}
                  {v.diagnosis && (
                    <p className="mt-1 text-sm">
                      <span className="text-slate-400">{t("Tashxis (ICD-10):")}</span>{" "}
                      <b>{v.diagnosis}</b>
                    </p>
                  )}
                  {v.recommendation && (
                    <p className="mt-1 text-sm">
                      <span className="text-slate-400">{t("Tavsiya:")}</span>{" "}
                      {v.recommendation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("Tahlil natijalari")} subtitle={t("Norma chegarasi bilan")} />
          <Table head={[t("Tahlil"), t("Natija"), t("Norma"), t("Holat")]}>
            {labs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-sm text-slate-400">
                  {t("Tahlillar yo'q")}
                </td>
              </tr>
            )}
            {labs.map((l) => {
              const out =
                l.result !== undefined &&
                (l.result > l.normMax || l.result < l.normMin);
              const high = l.result !== undefined && l.result > l.normMax;
              return (
                <tr key={l.id}>
                  <td className="px-5 py-3">{l.test}</td>
                  <td className="px-5 py-3">
                    {l.result === undefined ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={`font-semibold ${
                          out
                            ? high
                              ? "text-rose-600"
                              : "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {l.result} {l.unit}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {l.normMin}–{l.normMax} {l.unit}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        l.status === "TAYYOR"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {l.status === "TAYYOR" ? "Tayyor" : "Kutilmoqda"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      {/* Xaridlar tarixi (POS) — kassada ko'rish huquqi bor rollarga */}
      {profile && ["direktor", "registratura", "hisobchi"].includes(profile.role) && (
        <Card>
          <CardHeader
            title={t("Xaridlar tarixi")}
            subtitle={t("Klinikadan sotib olingan mahsulotlar")}
          />
          <Table head={[t("Chek"), t("Sana"), t("Mahsulotlar"), t("To'lov"), t("Summa"), t("Holat")]}>
            {salesList.filter((s) => s.patientId === p.id).length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-sm text-slate-400">
                  {t("Xaridlar yo'q")}
                </td>
              </tr>
            )}
            {salesList
              .filter((s) => s.patientId === p.id)
              .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))
              .map((s) => {
                const refunded = refundsList
                  .filter((r) => r.saleId === s.id)
                  .reduce((a, r) => a + r.amount, 0);
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-3 font-mono text-xs text-teal-700">{s.saleNo}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {s.date} {s.time}
                    </td>
                    <td className="max-w-56 px-5 py-3 text-slate-500">
                      <span className="line-clamp-2">
                        {s.items
                          .map((it) => (it.qty > 1 ? `${it.name} ×${it.qty}` : it.name))
                          .join(", ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {s.payments.map((pm) => pm.method).join(" + ")}
                    </td>
                    <td className="px-5 py-3 font-semibold">
                      {fmtSum(s.total)}
                      {refunded > 0 && (
                        <span className="block text-xs text-rose-500">
                          qaytdi: −{fmtSum(refunded)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {s.status === "TOLANDI"
                        ? "To'landi"
                        : s.status === "QAYTARILGAN"
                          ? "Qaytarilgan"
                          : "Qisman qaytarilgan"}
                    </td>
                  </tr>
                );
              })}
          </Table>
        </Card>
      )}
    </div>
  );
}
