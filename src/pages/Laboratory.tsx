import { useState } from "react";
import { FlaskConical } from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  inputCls,
  Modal,
  PrimaryButton,
  Table,
} from "../components/ui";
import { t } from "../lib/i18n";
import { useStore } from "../store";

export default function Laboratory() {
  const { labOrders, patients, doctors, enterLabResult } = useStore();
  const [entering, setEntering] = useState<string | null>(null);
  const [value, setValue] = useState("");

  const pending = labOrders.filter((l) => l.status === "KUTILMOQDA");
  const ready = labOrders.filter((l) => l.status === "TAYYOR");
  const order = labOrders.find((l) => l.id === entering);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(value.replace(",", "."));
    if (entering && !Number.isNaN(n)) enterLabResult(entering, n);
    setEntering(null);
    setValue("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Laboratoriya")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("Laborant faqat unga yo'llangan tahlilni ko'radi — bemorning to'liq")}
          {t("tashxis tarixi ko'rinmaydi. Natija tayyor bo'lganda bemorga SMS")}
          {t("yuboriladi (Eskiz.uz).")}
        </p>
      </div>

      <Card>
        <CardHeader
          title={t("Kutilayotgan tahlillar")}
          subtitle={`${pending.length} ${t("ta buyurtma")}`}
        />
        <Table head={[t("Sana"), t("Bemor"), t("Tahlil"), t("Yo'llagan shifokor"), ""]}>
          {pending.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-sm text-slate-400">
                {t("Kutilayotgan tahlillar yo'q")}
              </td>
            </tr>
          )}
          {pending.map((l) => {
            const p = patients.find((x) => x.id === l.patientId);
            const d = doctors.find((x) => x.id === l.doctorId);
            return (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{l.orderedAt}</td>
                <td className="px-5 py-3 font-medium">{p?.fullName}</td>
                <td className="px-5 py-3">{l.test}</td>
                <td className="px-5 py-3 text-slate-500">{d?.name}</td>
                <td className="px-5 py-3 text-right">
                  <PrimaryButton onClick={() => setEntering(l.id)}>
                    <FlaskConical size={15} /> Natija kiritish
                  </PrimaryButton>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card>
        <CardHeader title={t("Tayyor natijalar")} />
        <Table head={[t("Sana"), t("Bemor"), t("Tahlil"), t("Natija"), t("Norma"), t("Baho")]}>
          {ready.map((l) => {
            const p = patients.find((x) => x.id === l.patientId);
            const high = l.result! > l.normMax;
            const low = l.result! < l.normMin;
            return (
              <tr key={l.id}>
                <td className="px-5 py-3 text-slate-500">{l.orderedAt}</td>
                <td className="px-5 py-3">{p?.fullName}</td>
                <td className="px-5 py-3">{l.test}</td>
                <td
                  className={`px-5 py-3 font-semibold ${
                    high ? "text-rose-600" : low ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  {l.result} {l.unit}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {l.normMin}–{l.normMax} {l.unit}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      high
                        ? "bg-rose-100 text-rose-700"
                        : low
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {high ? "Normadan yuqori" : low ? t("Normadan past") : t("Normada")}
                  </span>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {order && (
        <Modal title={t("Natija kiritish")} onClose={() => setEntering(null)}>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-semibold">{order.test}</p>
              <p className="mt-1 text-slate-500">
                Bemor: {patients.find((x) => x.id === order.patientId)?.fullName}
              </p>
              <p className="mt-1 text-slate-500">
                Norma: {order.normMin}–{order.normMax} {order.unit}
              </p>
            </div>
            <Field label={`Natija (${order.unit}) *`}>
              <input
                required
                autoFocus
                inputMode="decimal"
                className={inputCls}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <PrimaryButton type="submit" className="w-full justify-center">
              Saqlash — bemorga SMS yuboriladi
            </PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
