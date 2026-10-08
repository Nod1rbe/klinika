import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ClipboardCheck, ShieldCheck, Stethoscope } from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  inputCls,
  Modal,
  PrimaryButton,
  StatusBadge,
} from "../components/ui";
import { useStore } from "../store";
import { PAID_RANK, statusRank } from "../types";

export default function Doctor() {
  const {
    appointments,
    patients,
    doctors,
    services,
    profile,
    setAppointmentStatus,
    finishVisit,
    today,
  } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeDoctors = doctors.filter((d) => d.active);
  // Shifokor roli o'z doctors yozuviga qulflangan — tanlov faqat boshqa rollarga
  const lockedId = profile?.role === "shifokor" ? (profile.doctorId ?? null) : null;
  // Ma'lumot yuklanmasidan oldin ro'yxat bo'sh bo'lishi mumkin — birinchi shifokorga tushamiz
  const doctorId =
    lockedId ??
    (selectedId && activeDoctors.some((d) => d.id === selectedId)
      ? selectedId
      : (activeDoctors[0]?.id ?? ""));
  const [finishing, setFinishing] = useState<string | null>(null);
  const [form, setForm] = useState({ complaint: "", diagnosis: "", recommendation: "" });

  // ASOSIY BIZNES-QOIDA (TZ 3-bo'lim): faqat to'lovi tasdiqlangan (status >= TOLANDI)
  // qabullar shifokorga ko'rinadi.
  const visible = appointments
    .filter(
      (a) =>
        a.date === today &&
        a.doctorId === doctorId &&
        statusRank(a.status) >= PAID_RANK,
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  const hiddenCount = appointments.filter(
    (a) =>
      a.date === today &&
      a.doctorId === doctorId &&
      a.status !== "BEKOR" &&
      statusRank(a.status) < PAID_RANK,
  ).length;

  const doc = doctors.find((d) => d.id === doctorId);

  function submitFinish(e: React.FormEvent) {
    e.preventDefault();
    if (finishing) finishVisit(finishing, form);
    setFinishing(null);
    setForm({ complaint: "", diagnosis: "", recommendation: "" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shifokor kabineti</h1>
          <p className="mt-1 text-sm text-slate-500">
            {doc?.name} · {doc?.specialty}
            {doc?.room ? ` · ${doc.room}-xona` : ""}
          </p>
        </div>
        {lockedId ? (
          <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
            Sizning kabinetingiz
          </span>
        ) : (
          <select
            value={doctorId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`${inputCls} w-64`}
          >
            {activeDoctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.specialty}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        <p>
          Bu ro'yxatda faqat <b>to'lovi tasdiqlangan</b> bemorlar ko'rinadi
          (holat ≥ «To'landi»).
          {hiddenCount > 0 && (
            <>
              {" "}
              Hozir <b>{hiddenCount} ta</b> bemor to'lov bosqichida — kassada
              to'lov qabul qilingach shu yerda paydo bo'ladi.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.length === 0 && (
          <Card className="p-8 text-center text-sm text-slate-400 lg:col-span-2">
            Bugun uchun to'langan qabullar yo'q
          </Card>
        )}
        {visible.map((a) => {
          const p = patients.find((x) => x.id === a.patientId);
          const names = a.items
            .map((it) => services.find((s) => s.id === it.serviceId)?.name ?? "?")
            .join(", ");
          if (!p) return null;
          return (
            <Card key={a.id}>
              <CardHeader
                title={`${a.queueNo ? `№${a.queueNo} · ` : ""}${a.time} — ${p.fullName}`}
                subtitle={`${names} · to'landi ${a.paidAt} (${a.paymentMethod})`}
                action={<StatusBadge status={a.status} />}
              />
              <div className="space-y-3 p-5">
                {(p.allergies.length > 0 || p.chronic.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.allergies.map((al) => (
                      <span
                        key={al}
                        className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
                      >
                        <AlertTriangle size={12} /> {al}
                      </span>
                    ))}
                    {p.chronic.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                {a.complaint && (
                  <p className="text-sm">
                    <span className="text-slate-400">Shikoyat:</span> {a.complaint}
                  </p>
                )}
                {a.diagnosis && (
                  <p className="text-sm">
                    <span className="text-slate-400">Tashxis:</span>{" "}
                    <b>{a.diagnosis}</b>
                  </p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <Link
                    to={`/bemorlar/${p.id}`}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    Tibbiy kartani ochish →
                  </Link>
                  <div className="flex gap-2">
                    {a.status === "TOLANDI" && (
                      <PrimaryButton
                        onClick={() => setAppointmentStatus(a.id, "NAVBATDA")}
                      >
                        Navbatga olish
                      </PrimaryButton>
                    )}
                    {a.status === "NAVBATDA" && (
                      <PrimaryButton
                        onClick={() => setAppointmentStatus(a.id, "QABULDA")}
                      >
                        <Stethoscope size={15} /> Qabulni boshlash
                      </PrimaryButton>
                    )}
                    {a.status === "QABULDA" && (
                      <PrimaryButton
                        onClick={() => {
                          setFinishing(a.id);
                          setForm({
                            complaint: a.complaint ?? "",
                            diagnosis: a.diagnosis ?? "",
                            recommendation: a.recommendation ?? "",
                          });
                        }}
                      >
                        <ClipboardCheck size={15} /> Yakunlash
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {finishing && (
        <Modal title="Qabulni yakunlash" onClose={() => setFinishing(null)} wide>
          <form onSubmit={submitFinish} className="space-y-4">
            <Field label="Shikoyat">
              <textarea
                className={`${inputCls} min-h-20`}
                value={form.complaint}
                onChange={(e) => setForm({ ...form, complaint: e.target.value })}
              />
            </Field>
            <Field label="Tashxis (ICD-10 kod bilan) *">
              <input
                required
                placeholder="Masalan: I10 — Essensial gipertoniya"
                className={inputCls}
                value={form.diagnosis}
                onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              />
            </Field>
            <Field label="Tavsiya / retsept">
              <textarea
                className={`${inputCls} min-h-20`}
                value={form.recommendation}
                onChange={(e) =>
                  setForm({ ...form, recommendation: e.target.value })
                }
              />
            </Field>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFinishing(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Bekor qilish
              </button>
              <PrimaryButton type="submit">Saqlash va yakunlash</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
