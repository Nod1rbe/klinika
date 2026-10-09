import { useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  inputCls,
  Modal,
  PrimaryButton,
  Table,
} from "../components/ui";
import { fmtSum } from "../data/mock";
import { formatUzDate } from "../lib/date";
import { printReceipt } from "../lib/receipt";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import type { SaleRec, SaleStatus } from "../types";
import { SALE_STATUS_LABELS } from "../types";

const STATUS_STYLE: Record<SaleStatus, string> = {
  TOLANDI: "bg-emerald-100 text-emerald-700",
  QISMAN_QAYTARILGAN: "bg-amber-100 text-amber-700",
  QAYTARILGAN: "bg-rose-100 text-rose-700",
};

export default function Sales() {
  const { salesList, patients, refundsList, clinic, retryLoad, notify, today, profile } =
    useStore();
  const [date, setDate] = useState(today);
  const [detail, setDetail] = useState<SaleRec | null>(null);
  const [refunding, setRefunding] = useState<SaleRec | null>(null);
  const [refundQtys, setRefundQtys] = useState<Map<string, number>>(new Map());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canRefund = profile && ["direktor", "hisobchi"].includes(profile.role);

  const dayList = salesList
    .filter((s) => s.date === date)
    .sort((a, b) => (a.saleNo < b.saleNo ? 1 : -1));
  const dayTotal = dayList.reduce((s, x) => s + x.total, 0);
  const dayRefunds = refundsList
    .filter((r) => r.date === date)
    .reduce((s, r) => s + r.amount, 0);

  function reprint(s: SaleRec) {
    printReceipt({
      saleNo: s.saleNo,
      patientName: patients.find((p) => p.id === s.patientId)?.fullName ?? "",
      doctorName: "",
      items: s.items.map((it) => ({
        name: it.name,
        price: it.unitPrice,
        qty: it.qty !== 1 ? it.qty : undefined,
      })),
      total: s.total,
      method: s.payments.map((p) => `${p.method} ${fmtSum(p.amount)}`).join(" + "),
      date: s.date,
      time: s.time,
      clinic,
    });
  }

  async function doRefund() {
    if (!refunding || busy || !supabase) return;
    setErr(null);
    const items = refunding.items
      .map((it) => ({ itemId: it.id, qty: refundQtys.get(it.id) ?? 0 }))
      .filter((x) => x.qty > 0);
    if (items.length === 0) return setErr("Qaytariladigan miqdorni kiriting");
    if (!reason.trim()) return setErr("Sababni yozing");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("refund_sale", {
        p_sale_id: refunding.id,
        p_items: items,
        p_reason: reason.trim(),
      });
      if (error) throw new Error(error.message);
      notify(`Qaytarildi: ${fmtSum(data?.amount ?? 0)} — zaxira omborga qaytdi`);
      setRefunding(null);
      setRefundQtys(new Map());
      setReason("");
      retryLoad();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Sotuvlar")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Mahsulot sotuvlari tarixi va qaytarishlar")}
          </p>
        </div>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          className={`${inputCls} w-44`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Sotuvlar soni")}</p>
          <p className="mt-1 text-2xl font-bold">{dayList.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Mahsulot tushumi")}</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">
            {fmtSum(dayTotal - dayRefunds)}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{t("Qaytarishlar ayirilgan")}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">{t("Qaytarildi")}</p>
          <p
            className={`mt-1 text-2xl font-bold ${dayRefunds > 0 ? "text-rose-600" : "text-slate-300"}`}
          >
            {fmtSum(dayRefunds)}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={date === today ? t("Bugungi sotuvlar") : t("Sotuvlar hisoboti")}
          subtitle={formatUzDate(date)}
        />
        <Table head={[t("Chek"), t("Vaqt"), t("Mijoz"), t("Mahsulotlar"), t("To'lov"), t("Summa"), t("Holat"), ""]}>
          {dayList.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                {t("Bu kunda sotuvlar yo'q")}
              </td>
            </tr>
          )}
          {dayList.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-mono text-xs font-semibold text-teal-700">
                <button onClick={() => setDetail(s)} className="hover:underline">
                  {s.saleNo}
                </button>
              </td>
              <td className="px-5 py-3 text-slate-500">{s.time}</td>
              <td className="px-5 py-3">
                {patients.find((p) => p.id === s.patientId)?.fullName ?? "—"}
              </td>
              <td className="max-w-56 px-5 py-3 text-slate-500">
                <span className="line-clamp-2">
                  {s.items
                    .map((it) => (it.qty > 1 ? `${it.name} ×${it.qty}` : it.name))
                    .join(", ")}
                </span>
              </td>
              <td className="px-5 py-3 text-xs text-slate-500">
                {s.payments.map((p) => p.method).join(" + ")}
              </td>
              <td className="px-5 py-3 font-semibold">{fmtSum(s.total)}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}
                >
                  {t(SALE_STATUS_LABELS[s.status])}
                </span>
              </td>
              <td className="px-5 py-3 text-right whitespace-nowrap">
                <button
                  onClick={() => reprint(s)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  <Printer size={13} /> {t("Chek")}
                </button>
                {canRefund && s.status !== "QAYTARILGAN" && (
                  <button
                    onClick={() => {
                      setRefunding(s);
                      setRefundQtys(new Map());
                      setReason("");
                      setErr(null);
                    }}
                    className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-rose-500 hover:text-rose-600"
                  >
                    <RotateCcw size={13} /> {t("Qaytarish")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {detail && (
        <Modal title={`Sotuv ${detail.saleNo}`} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <p className="text-slate-500">
              {formatUzDate(detail.date)} {detail.time} · Kassir:{" "}
              {detail.cashierName || "—"}
            </p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {detail.items.map((it) => (
                <div key={it.id} className="flex justify-between px-3 py-2">
                  <span>
                    {it.name} × {it.qty}
                    {it.refundedQty > 0 && (
                      <span className="ml-1 text-xs text-rose-500">
                        (qaytdi: {it.refundedQty})
                      </span>
                    )}
                  </span>
                  <span className="font-medium">{fmtSum(it.lineTotal)}</span>
                </div>
              ))}
            </div>
            {detail.discount > 0 && (
              <p className="flex justify-between">
                <span className="text-slate-500">{t("Chegirma:")}</span>
                <span>−{fmtSum(detail.discount)}</span>
              </p>
            )}
            <p className="flex justify-between text-base font-bold">
              <span>{t("JAMI:")}</span>
              <span className="text-teal-700">{fmtSum(detail.total)}</span>
            </p>
            <div className="text-xs text-slate-500">
              {detail.payments.map((p, i) => (
                <p key={i}>
                  {p.method}: {fmtSum(p.amount)}
                </p>
              ))}
            </div>
            {refundsList
              .filter((r) => r.saleId === detail.id)
              .map((r) => (
                <p key={r.id} className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  Qaytarish: −{fmtSum(r.amount)} · {r.date} {r.time} · {r.reason} (
                  {r.createdByName})
                </p>
              ))}
          </div>
        </Modal>
      )}

      {refunding && (
        <Modal
          title={`Qaytarish — ${refunding.saleNo}`}
          onClose={() => setRefunding(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {t("Qaytariladigan miqdorlarni kiriting — mahsulotlar omborga qaytadi,")}
              {t("summa tushumdan ayiriladi.")}
            </p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {refunding.items.map((it) => {
                const left = it.qty - it.refundedQty;
                return (
                  <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {it.name}
                      <span className="block text-xs text-slate-400">
                        {fmtSum(it.unitPrice)} · qoldi: {left}
                      </span>
                    </span>
                    <input
                      inputMode="numeric"
                      placeholder="0"
                      value={refundQtys.get(it.id) ?? ""}
                      onChange={(e) => {
                        const q = Math.min(
                          Math.max(Math.round(Number(e.target.value) || 0), 0),
                          left,
                        );
                        setRefundQtys((prev) => new Map(prev).set(it.id, q));
                      }}
                      className="w-16 rounded-lg border border-slate-300 py-1.5 text-center text-sm"
                      disabled={left <= 0}
                    />
                  </div>
                );
              })}
            </div>
            <Field label={t("Sabab *")}>
              <input
                className={inputCls}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("Masalan: mijoz qaytardi / xato urildi")}
              />
            </Field>
            {err && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t(err)}</p>
            )}
            <PrimaryButton
              onClick={doRefund}
              className={`w-full justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <RotateCcw size={15} />
              {busy ? t("Saqlanmoqda...") : t("Qaytarishni tasdiqlash")}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
