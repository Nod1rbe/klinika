import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  Printer,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { Card, CardHeader, Field, inputCls, PrimaryButton } from "../components/ui";
import { fmtSum } from "../data/mock";
import {
  openReceiptWindow,
  printReceipt,
  renderReceiptInto,
  type ReceiptData,
} from "../lib/receipt";
import { useStore } from "../store";
import type { Appointment, Patient, PaymentMethod } from "../types";
import { apptTotal, CATEGORY_ORDER } from "../types";

// Kun soni tanlanadigan kategoriya (statsionar — kuniga hisoblanadi)
const QTY_CATEGORY = "Statsionar";
const MAX_DAYS = 10;

const METHODS: PaymentMethod[] = ["Naqd", "Click", "Payme", "Uzum", "Karta (POS)"];

export default function Registration() {
  const { patients, doctors, services, addPatient, registerVisit, clinic } =
    useStore();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quick, setQuick] = useState({
    fullName: "",
    phone: "",
    birthDate: "",
    gender: "Erkak" as Patient["gender"],
  });
  const [doctorId, setDoctorId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qtys, setQtys] = useState<Map<string, number>>(new Map());
  const [serviceQuery, setServiceQuery] = useState("");
  // Birinchi ikki kategoriya ochiq, qolganlari yig'ilgan — ro'yxat ixchamroq
  const [openCats, setOpenCats] = useState<Set<string>>(
    () => new Set(CATEGORY_ORDER.slice(0, 2)),
  );
  const [method, setMethod] = useState<PaymentMethod>("Naqd");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeServices = services.filter((s) => s.active);
  const categories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((c) =>
      activeServices.some((s) => s.category === c),
    );
    const other = [
      ...new Set(
        activeServices
          .map((s) => s.category)
          .filter((c) => c && !CATEGORY_ORDER.includes(c)),
      ),
    ];
    return [...known, ...other];
  }, [activeServices]);

  const selectedPatient = patients.find((p) => p.id === patientId) ?? null;
  const foundPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
      )
      .slice(0, 6);
  }, [patientQuery, patients]);

  const qtyOf = (id: string) => qtys.get(id) ?? 1;
  const total = [...selected].reduce(
    (sum, id) =>
      sum + (services.find((s) => s.id === id)?.price ?? 0) * qtyOf(id),
    0,
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setQtys((q) => {
          const nq = new Map(q);
          nq.delete(id);
          return nq;
        });
      } else next.add(id);
      return next;
    });
  }

  function setQty(id: string, qty: number) {
    setQtys((prev) => new Map(prev).set(id, qty));
  }

  function renderServiceRow(s: (typeof services)[number]) {
    return (
      <label
        key={s.id}
        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
          selected.has(s.id) ? "bg-teal-50 text-teal-800" : "hover:bg-slate-50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <input
            type="checkbox"
            checked={selected.has(s.id)}
            onChange={() => toggle(s.id)}
            className="h-4 w-4 shrink-0 accent-teal-600"
          />
          <span className="truncate">{s.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {s.category === QTY_CATEGORY && selected.has(s.id) && (
            <select
              value={qtyOf(s.id)}
              onChange={(e) => setQty(s.id, Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-teal-300 bg-white px-1.5 py-1 text-xs font-medium text-teal-800"
            >
              {[...Array(MAX_DAYS)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} kun
                </option>
              ))}
            </select>
          )}
          <span className="font-medium text-slate-500">
            {fmtSum(s.price * (selected.has(s.id) ? qtyOf(s.id) : 1))}
          </span>
        </span>
      </label>
    );
  }

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    // Telefon bo'yicha dublikat tekshiruvi — mavjud bemor topilsa, o'shani tanlaymiz
    const norm = quick.phone.replace(/\D/g, "");
    const existing =
      norm.length >= 9
        ? patients.find((p) => p.phone.replace(/\D/g, "") === norm)
        : undefined;
    if (existing) {
      setPatientId(existing.id);
      setShowQuickAdd(false);
      setNotice(
        `Bu telefon allaqachon ro'yxatda: ${existing.fullName} (${existing.id}) — o'sha bemor tanlandi`,
      );
      return;
    }
    setBusy(true);
    try {
      const p = await addPatient({
        fullName: quick.fullName.trim(),
        birthDate: quick.birthDate,
        gender: quick.gender,
        phone: quick.phone.trim(),
        address: "",
        allergies: [],
        chronic: [],
      });
      setPatientId(p.id);
      setShowQuickAdd(false);
      setQuick({ fullName: "", phone: "", birthDate: "", gender: "Erkak" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bemor saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  function receiptData(appt: Appointment): ReceiptData {
    const patient = patients.find((p) => p.id === appt.patientId);
    const doctor = doctors.find((d) => d.id === appt.doctorId);
    return {
      queueNo: appt.queueNo,
      patientName: patient?.fullName ?? "",
      doctorName: doctor?.name ?? "",
      items: appt.items.map((it) => ({
        name: services.find((s) => s.id === it.serviceId)?.name ?? "Xizmat",
        price: it.price,
        qty: it.qty,
      })),
      total: apptTotal(appt),
      method: appt.paymentMethod,
      date: appt.date,
      time: appt.time,
      clinic,
    };
  }

  async function submit(payNow: boolean) {
    if (busy) return;
    setError(null);
    if (!patientId) return setError("Bemorni tanlang yoki yangi qo'shing");
    if (!doctorId) return setError("Shifokorni tanlang");
    if (selected.size === 0) return setError("Kamida bitta xizmat belgilang");
    // Chek oynasi click ichida SINXRON ochiladi (popup-bloker uchun);
    // qabul bazaga saqlanGACH to'ldiriladi, xato bo'lsa yopiladi.
    const w = payNow ? openReceiptWindow() : null;
    setBusy(true);
    try {
      const appt = await registerVisit({
        patientId,
        doctorId,
        items: [...selected].map((id) => ({
          serviceId: id,
          qty: qtyOf(id) > 1 ? qtyOf(id) : undefined,
        })),
        payNow,
        method: payNow ? method : undefined,
      });
      if (w) renderReceiptInto(w, receiptData(appt));
      setDone(appt);
    } catch (e) {
      w?.close();
      setError(
        e instanceof Error ? e.message : "Qabul saqlanmadi — qayta urining",
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setPatientId(null);
    setPatientQuery("");
    setDoctorId("");
    setSelected(new Set());
    setMethod("Naqd");
  }

  // ============ Muvaffaqiyat ekrani ============
  if (done) {
    const p = patients.find((x) => x.id === done.patientId);
    const paid = done.status === "TOLANDI";
    return (
      <div className="mx-auto max-w-lg space-y-5 pt-10">
        <Card className="p-8 text-center">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h1 className="mt-3 text-xl font-bold">
            {paid ? "To'lov qabul qilindi" : "Ro'yxatga olindi"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {p?.fullName} · navbat raqami:
          </p>
          <p className="mt-2 text-5xl font-bold text-teal-600">{done.queueNo}</p>
          <p className="mt-2 text-sm text-slate-500">
            Jami: <b>{fmtSum(apptTotal(done))}</b>
            {paid ? ` · ${done.paymentMethod}` : " · to'lov kassada kutilmoqda"}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => printReceipt(receiptData(done))}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Printer size={15} /> Chekni qayta chiqarish
            </button>
            <PrimaryButton onClick={reset}>
              <UserPlus size={15} /> Yangi qabul
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  // ============ Asosiy forma ============
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registratsiya — yangi qabul</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bemor va shifokorni tanlang, kelgan xizmatlarini belgilang — chek
          termal printerga chiqadi
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* Xizmatlar (katta ekranda chap, telefonda pastda) */}
        <div className="order-2 space-y-4 xl:order-1 xl:col-span-2">
          {/* Xizmat qidiruvi — 56 ta xizmat ichidan tez topish uchun */}
          <div className="relative">
            <Search
              size={16}
              className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              value={serviceQuery}
              onChange={(e) => setServiceQuery(e.target.value)}
              placeholder="Xizmat qidirish... (masalan: qon, EKG, punksiya)"
              className={`${inputCls} py-2.5 pl-10`}
            />
            {serviceQuery && (
              <button
                onClick={() => setServiceQuery("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {serviceQuery.trim() ? (
            (() => {
              const q = serviceQuery.trim().toLowerCase();
              const found = activeServices.filter(
                (s) =>
                  s.name.toLowerCase().includes(q) ||
                  s.category.toLowerCase().includes(q),
              );
              return (
                <Card>
                  <CardHeader
                    title="Qidiruv natijalari"
                    subtitle={`${found.length} ta xizmat topildi`}
                  />
                  <div className="grid grid-cols-1 gap-x-6 p-3 sm:grid-cols-2">
                    {found.map((s) => renderServiceRow(s))}
                  </div>
                  {found.length === 0 && (
                    <p className="px-5 pb-5 text-sm text-slate-400">
                      Hech narsa topilmadi — boshqacha yozib ko'ring
                    </p>
                  )}
                </Card>
              );
            })()
          ) : (
            categories.map((cat) => {
              const list = activeServices.filter((s) => s.category === cat);
              const chosen = list.filter((s) => selected.has(s.id)).length;
              const isOpen = openCats.has(cat);
              return (
                <Card key={cat}>
                  <button
                    onClick={() =>
                      setOpenCats((prev) => {
                        const next = new Set(prev);
                        if (next.has(cat)) next.delete(cat);
                        else next.add(cat);
                        return next;
                      })
                    }
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="font-semibold text-slate-800">{cat}</span>
                      <span className="text-xs text-slate-400">
                        {list.length} ta
                      </span>
                      {chosen > 0 && (
                        <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                          {chosen} tanlandi
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 gap-x-6 border-t border-slate-100 p-3 sm:grid-cols-2">
                      {list.map((s) => renderServiceRow(s))}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {/* Yakuniy panel (katta ekranda o'ng, telefonda tepada) */}
        <div className="order-1 space-y-4 xl:sticky xl:top-20 xl:order-2">
          <Card>
            <CardHeader title="1. Bemor" />
            <div className="space-y-3 p-4">
              {notice && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  {notice}
                </p>
              )}
              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-teal-800">
                      {selectedPatient.fullName}
                    </p>
                    <p className="text-xs text-teal-600">
                      {selectedPatient.id} · {selectedPatient.phone}
                    </p>
                  </div>
                  <button
                    onClick={() => setPatientId(null)}
                    className="rounded p-1 text-teal-600 hover:bg-teal-100"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={patientQuery}
                      onChange={(e) => setPatientQuery(e.target.value)}
                      placeholder="F.I.Sh., ID yoki telefon..."
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  {foundPatients.length > 0 && (
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {foundPatients.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setPatientId(p.id);
                            setPatientQuery("");
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span className="font-medium">{p.fullName}</span>
                          <span className="block text-xs text-slate-400">
                            {p.id} · {p.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!showQuickAdd ? (
                    <button
                      onClick={() => setShowQuickAdd(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      <UserPlus size={15} /> Yangi bemor qo'shish
                    </button>
                  ) : (
                    <form onSubmit={quickAdd} className="space-y-2.5 rounded-lg bg-slate-50 p-3">
                      <Field label="F.I.Sh. *">
                        <input
                          required
                          className={inputCls}
                          value={quick.fullName}
                          onChange={(e) => setQuick({ ...quick, fullName: e.target.value })}
                        />
                      </Field>
                      <Field label="Telefon *">
                        <input
                          required
                          className={inputCls}
                          placeholder="+998 ..."
                          value={quick.phone}
                          onChange={(e) => setQuick({ ...quick, phone: e.target.value })}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Tug'ilgan sana *">
                          <input
                            required
                            type="date"
                            className={inputCls}
                            value={quick.birthDate}
                            onChange={(e) => setQuick({ ...quick, birthDate: e.target.value })}
                          />
                        </Field>
                        <Field label="Jinsi">
                          <select
                            className={inputCls}
                            value={quick.gender}
                            onChange={(e) =>
                              setQuick({ ...quick, gender: e.target.value as Patient["gender"] })
                            }
                          >
                            <option>Erkak</option>
                            <option>Ayol</option>
                          </select>
                        </Field>
                      </div>
                      <div className="flex gap-2">
                        <PrimaryButton type="submit" className="flex-1 justify-center">
                          Saqlash
                        </PrimaryButton>
                        <button
                          type="button"
                          onClick={() => setShowQuickAdd(false)}
                          className="rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-100"
                        >
                          Bekor
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="2. Shifokor" />
            <div className="p-4">
              <select
                className={inputCls}
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">Tanlang...</option>
                {doctors
                  .filter((d) => d.active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialty}
                    </option>
                  ))}
              </select>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="3. To'lov"
              subtitle={`${selected.size} ta xizmat tanlandi`}
            />
            <div className="space-y-3 p-4">
              {[...selected].map((id) => {
                const s = services.find((x) => x.id === id);
                if (!s) return null;
                const q = qtyOf(id);
                return (
                  <div key={id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {s.name}
                      {q > 1 && (
                        <span className="text-teal-600"> × {q} kun</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-slate-500">{fmtSum(s.price * q)}</span>
                      <button
                        onClick={() => toggle(id)}
                        className="rounded p-0.5 text-slate-300 hover:text-rose-500"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-semibold">JAMI:</span>
                <span className="text-xl font-bold text-teal-700">{fmtSum(total)}</span>
              </div>
              <Field label="To'lov usuli">
                <select
                  className={inputCls}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                >
                  {METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              )}
              <PrimaryButton
                onClick={() => submit(true)}
                className={`w-full justify-center py-2.5 ${busy ? "pointer-events-none opacity-60" : ""}`}
              >
                <Banknote size={16} />
                {busy ? "Saqlanmoqda..." : "To'lov + chek chiqarish"}
              </PrimaryButton>
              <button
                onClick={() => submit(false)}
                disabled={busy}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Faqat ro'yxatga olish (to'lov kassada)
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
