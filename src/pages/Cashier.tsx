import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Printer,
  Receipt,
  RotateCcw,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  inputCls,
  Modal,
  PrimaryButton,
  StatusBadge,
  Table,
} from "../components/ui";
import { fmtSum } from "../data/mock";
import {
  openReceiptWindow,
  printReceipt,
  renderReceiptInto,
  type ReceiptData,
} from "../lib/receipt";
import { notifyCashChanged } from "../lib/cashSession";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import type { Appointment, PaymentMethod } from "../types";
import { apptTotal, isRefunded, isRevenue } from "../types";

const METHODS: PaymentMethod[] = ["Naqd", "Click", "Payme", "Uzum", "Karta (POS)"];

export default function Cashier({ embedded = false }: { embedded?: boolean }) {
  const {
    appointments,
    patients,
    doctors,
    services,
    pay,
    setAppointmentStatus,
    notify,
    today,
    clinic,
  } = useStore();
  const [paying, setPaying] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("Naqd");
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);

  const todayAppts = appointments.filter((a) => a.date === today);
  const pending = todayAppts.filter((a) => a.status === "TOLOV_KUTILMOQDA");
  const paid = todayAppts.filter(isRevenue);
  const refunded = todayAppts.filter(isRefunded);
  const total = paid.reduce((s, a) => s + apptTotal(a), 0);
  const cash = paid
    .filter((a) => a.paymentMethod === "Naqd")
    .reduce((s, a) => s + apptTotal(a), 0);
  const refundedSum = refunded.reduce((s, a) => s + apptTotal(a), 0);

  function itemNames(a: Appointment): string {
    return a.items
      .map((it) => {
        const name = services.find((s) => s.id === it.serviceId)?.name ?? "?";
        return it.qty && it.qty > 1 ? `${name} ×${it.qty}` : name;
      })
      .join(", ");
  }

  function receiptOf(a: Appointment, m?: PaymentMethod): ReceiptData {
    return {
      queueNo: a.queueNo,
      patientName: patients.find((p) => p.id === a.patientId)?.fullName ?? "",
      doctorName: doctors.find((d) => d.id === a.doctorId)?.name ?? "",
      items: a.items.map((it) => ({
        name: services.find((s) => s.id === it.serviceId)?.name ?? "Xizmat",
        price: it.price,
        qty: it.qty,
      })),
      total: apptTotal(a),
      method: m ?? a.paymentMethod,
      date: a.date,
      time: a.time,
      clinic,
    };
  }

  async function confirm() {
    const appt = appointments.find((a) => a.id === paying);
    if (!appt || payBusy) return;
    setPayError(null);
    // Chek oynasi click ichida sinxron ochiladi; to'lov bazada tasdiqlanGACH to'ldiriladi
    const w = openReceiptWindow();
    setPayBusy(true);
    try {
      await pay(appt.id, method);
      if (w) renderReceiptInto(w, receiptOf(appt, method));
      setPaying(null);
      setMethod("Naqd");
      notify(t("To'lov qabul qilindi — chek chiqarildi"));
      notifyCashChanged();
    } catch (e) {
      w?.close();
      setPayError(
        e instanceof Error ? e.message : "To'lov saqlanmadi — qayta urining",
      );
    } finally {
      setPayBusy(false);
    }
  }

  function doRefund() {
    if (!refunding) return;
    setAppointmentStatus(refunding, "BEKOR");
    setRefunding(null);
    notify(t("To'lov qaytarildi — bugungi tushumdan chiqarildi"));
    // Bekor qilish bazaga fonda yoziladi — smena hisobi biroz keyin yangilansin
    setTimeout(notifyCashChanged, 1500);
  }

  const payingAppt = appointments.find((a) => a.id === paying);
  const refundingAppt = appointments.find((a) => a.id === refunding);

  return (
    <div className="space-y-6">
      {!embedded && (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Kassa / To'lovlar")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("To'lov qabul qilingach chek avtomatik chiqadi va bemor shifokor")}
          {t("kabinetida ko'rinadi.")}
        </p>
      </div>
      )}

      {!embedded && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Bugungi sof tushum")}</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{fmtSum(total)}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {t("Qaytarilganlar hisobga olinmagan")}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Naqd (Z-hisobot)")}</p>
          <p className="mt-1 text-2xl font-bold">{fmtSum(cash)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Onlayn / karta")}</p>
          <p className="mt-1 text-2xl font-bold">{fmtSum(total - cash)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Qaytarildi")}</p>
          <p
            className={`mt-1 text-2xl font-bold ${refundedSum > 0 ? "text-rose-600" : "text-slate-300"}`}
          >
            {fmtSum(refundedSum)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {refunded.length} {t("ta bekor qilingan to'lov")}
          </p>
        </Card>
      </div>
      )}

      <Card>
        <CardHeader
          title={t("To'lov kutilayotganlar")}
          subtitle={`${pending.length} ${t("ta hisob-faktura")}`}
        />
        <Table head={[t("№"), t("Bemor"), t("Shifokor"), t("Xizmatlar"), t("Summa"), ""]}>
          {pending.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                {t("Hozircha to'lov kutilayotgan bemor yo'q")}
              </td>
            </tr>
          )}
          {pending.map((a) => {
            const p = patients.find((x) => x.id === a.patientId);
            const d = doctors.find((x) => x.id === a.doctorId);
            return (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-lg font-bold text-teal-600">
                  {a.queueNo ?? "—"}
                </td>
                <td className="px-5 py-3 font-medium">{p?.fullName}</td>
                <td className="px-5 py-3 text-slate-500">{d?.name}</td>
                <td className="max-w-52 px-5 py-3 text-slate-500">
                  <span className="line-clamp-2">{itemNames(a)}</span>
                </td>
                <td className="px-5 py-3 font-semibold">{fmtSum(apptTotal(a))}</td>
                <td className="px-5 py-3 text-right">
                  <PrimaryButton onClick={() => setPaying(a.id)}>
                    <Banknote size={15} /> {t("To'lov qabul qilish")}
                  </PrimaryButton>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card>
        <CardHeader title={t("Bugungi to'lovlar")} subtitle={t("Kunlik kassa")} />
        <Table head={[t("Vaqt"), t("Bemor"), t("Xizmatlar"), t("Usul"), t("Summa"), t("Holat"), ""]}>
          {paid.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">
                {t("Bugun hali to'lovlar yo'q")}
              </td>
            </tr>
          )}
          {paid.map((a) => {
            const p = patients.find((x) => x.id === a.patientId);
            return (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{a.paidAt}</td>
                <td className="px-5 py-3">{p?.fullName}</td>
                <td className="max-w-52 px-5 py-3 text-slate-500">
                  <span className="line-clamp-2">{itemNames(a)}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium">
                    {a.paymentMethod}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold">{fmtSum(apptTotal(a))}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => printReceipt(receiptOf(a))}
                    title={t("Chekni qayta chiqarish")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    <Printer size={14} /> {t("Chek")}
                  </button>
                  <button
                    onClick={() => setRefunding(a.id)}
                    title={t("To'lovni qaytarish (bekor qilish)")}
                    className="ml-3 inline-flex items-center gap-1.5 text-sm font-medium text-rose-500 hover:text-rose-600"
                  >
                    <RotateCcw size={14} /> {t("Qaytarish")}
                  </button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {refunded.length > 0 && (
        <Card>
          <CardHeader
            title={t("Qaytarilgan to'lovlar")}
            subtitle={t("Bekor qilingan — tushumga kirmaydi")}
          />
          <Table head={[t("Vaqt"), t("Bemor"), t("Xizmatlar"), t("Usul"), t("Summa")]}>
            {refunded.map((a) => {
              const p = patients.find((x) => x.id === a.patientId);
              return (
                <tr key={a.id} className="text-slate-400">
                  <td className="px-5 py-3">{a.paidAt}</td>
                  <td className="px-5 py-3 line-through">{p?.fullName}</td>
                  <td className="max-w-52 px-5 py-3">
                    <span className="line-clamp-2">{itemNames(a)}</span>
                  </td>
                  <td className="px-5 py-3">{a.paymentMethod}</td>
                  <td className="px-5 py-3 font-semibold text-rose-400">
                    −{fmtSum(apptTotal(a))}
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {payingAppt && (
        <Modal title={t("To'lov qabul qilish")} onClose={() => setPaying(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Receipt size={16} className="text-teal-600" />
                {patients.find((x) => x.id === payingAppt.patientId)?.fullName}
              </p>
              <div className="mt-2 space-y-1">
                {payingAppt.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-slate-500">
                    <span>
                      {services.find((s) => s.id === it.serviceId)?.name ?? "Xizmat"}
                      {it.qty && it.qty > 1 ? ` ×${it.qty}` : ""}
                    </span>
                    <span>{fmtSum(it.price * (it.qty ?? 1))}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 border-t border-slate-200 pt-2 text-xl font-bold text-teal-700">
                {fmtSum(apptTotal(payingAppt))}
              </p>
            </div>
            <Field label={t("To'lov usuli")}>
              <select
                className={inputCls}
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{t(m)}</option>
                ))}
              </select>
            </Field>
            {payError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {t(payError)}
              </p>
            )}
            <PrimaryButton
              onClick={confirm}
              className={`w-full justify-center ${payBusy ? "pointer-events-none opacity-60" : ""}`}
            >
              <CheckCircle2 size={16} />
              {payBusy ? t("Saqlanmoqda...") : t("To'lovni tasdiqlash + chek")}
            </PrimaryButton>
            <p className="text-center text-xs text-slate-400">
              {t("Tasdiqlangach chek chiqadi va bemor shifokor navbatiga o'tadi")}
            </p>
          </div>
        </Modal>
      )}

      {refundingAppt && (
        <Modal title={t("To'lovni qaytarish")} onClose={() => setRefunding(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>
                <b>
                  {patients.find((x) => x.id === refundingAppt.patientId)?.fullName}
                </b>{" "}
                uchun <b>{fmtSum(apptTotal(refundingAppt))}</b> (
                {refundingAppt.paymentMethod}) to'lov bekor qilinadi. Qabul
                {t("«Bekor qilindi» holatiga o'tadi va bu summa bugungi")}
                {t("tushum/Z-hisobotdan chiqariladi. Naqd bo'lsa pulni bemorga")}
                {t("qaytaring.")}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRefunding(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t("Yo'q, qoldirilsin")}
              </button>
              <button
                onClick={doRefund}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <RotateCcw size={15} /> {t("Ha, qaytarilsin")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
