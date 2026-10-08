import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  PlayCircle,
  Wallet,
} from "lucide-react";
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
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";
import { useStore } from "../store";

interface SessionRow {
  id: string;
  status: "OCHIQ" | "YOPIQ";
  openingCash: number;
  openedByName: string;
  openedAt: string;
  closedByName: string;
  closedAt?: string;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  note: string;
}

interface Summary {
  openingCash: number;
  serviceCash: number;
  serviceRefundCash: number;
  posCash: number;
  posRefundCash: number;
  cashIn: number;
  cashOut: number;
  cardTotal: number;
  posTxCount: number;
  expectedCash: number;
}

interface MovementRow {
  id: string;
  type: "KIRIM" | "CHIQIM";
  amount: number;
  reason: string;
  createdByName: string;
  createdAt: string;
}

const fmtDT = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export default function CashSession() {
  const { profile, notify } = useStore();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [moves, setMoves] = useState<MovementRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [movForm, setMovForm] = useState<null | { type: "KIRIM" | "CHIQIM"; amount: string; reason: string }>(null);
  const [closeForm, setCloseForm] = useState<null | { actual: string; note: string }>(null);
  const [detail, setDetail] = useState<SessionRow | null>(null);

  const current = sessions?.find((s) => s.status === "OCHIQ") ?? null;

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("cash_sessions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(30);
    if (error) {
      setErr(error.message);
      return;
    }
    const rows: SessionRow[] = (data ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      openingCash: Number(r.opening_cash),
      openedByName: r.opened_by_name ?? "",
      openedAt: r.opened_at,
      closedByName: r.closed_by_name ?? "",
      closedAt: r.closed_at ?? undefined,
      expectedCash: r.expected_cash !== null ? Number(r.expected_cash) : undefined,
      actualCash: r.actual_cash !== null ? Number(r.actual_cash) : undefined,
      difference: r.difference !== null ? Number(r.difference) : undefined,
      note: r.note ?? "",
    }));
    setSessions(rows);
    const open = rows.find((s) => s.status === "OCHIQ");
    if (open) {
      const [{ data: sum }, { data: mv }] = await Promise.all([
        supabase.rpc("cash_session_summary", { p_session_id: open.id }),
        supabase
          .from("cash_movements")
          .select("*")
          .eq("session_id", open.id)
          .order("created_at", { ascending: false }),
      ]);
      setSummary((sum as Summary) ?? null);
      setMoves(
        (mv ?? []).map((m) => ({
          id: m.id,
          type: m.type,
          amount: Number(m.amount),
          reason: m.reason,
          createdByName: m.created_by_name ?? "",
          createdAt: m.created_at,
        })),
      );
    } else {
      setSummary(null);
      setMoves([]);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000); // jonli yangilanish
    return () => clearInterval(id);
  }, [load]);

  if (profile && !["direktor", "registratura", "hisobchi"].includes(profile.role)) {
    return <p className="text-sm text-slate-500">{t("Bu sahifaga ruxsatingiz yo'q.")}</p>;
  }
  if (!supabase) return <p className="text-sm text-slate-500">{t("Supabase ulanmagan.")}</p>;
  const sb = supabase;

  async function run(op: string, fn: () => Promise<void>) {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      await fn();
      notify(op);
      await load();
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
          <h1 className="text-2xl font-bold tracking-tight">Kassa smenasi</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Naqd pul hisobi: smena ochish, kirim-chiqim, kun oxirida solishtirish.")}
            {t("Karta/onlayn to'lovlar naqd kassaga kirmaydi.")}
          </p>
        </div>
        {!current ? (
          <PrimaryButton onClick={() => setOpenForm(true)}>
            <PlayCircle size={16} /> {t("Smena ochish")}
          </PrimaryButton>
        ) : (
          <button
            onClick={() =>
              setCloseForm({ actual: "", note: "" })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            <Lock size={15} /> {t("Smenani yopish")}
          </button>
        )}
      </div>

      {err && <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{t(err)}</p>}

      {current && summary && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm text-slate-500">{t("Boshlang'ich naqd")}</p>
              <p className="mt-1 text-xl font-bold">{fmtSum(summary.openingCash)}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {current.openedByName} · {fmtDT(current.openedAt)}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">{t("Naqd tushum")}</p>
              <p className="mt-1 text-xl font-bold text-teal-700">
                {fmtSum(summary.serviceCash + summary.posCash)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Xizmat: {fmtSum(summary.serviceCash)} · POS: {fmtSum(summary.posCash)}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">{t("Naqd chiqimlar")}</p>
              <p className="mt-1 text-xl font-bold text-rose-600">
                −{fmtSum(
                  summary.serviceRefundCash + summary.posRefundCash + summary.cashOut,
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Qaytarishlar: {fmtSum(summary.serviceRefundCash + summary.posRefundCash)} ·
                Chiqim: {fmtSum(summary.cashOut)}
              </p>
            </Card>
            <Card className="border-teal-200 bg-teal-50/40 p-5">
              <p className="text-sm font-medium text-teal-800">{t("Kutilayotgan naqd")}</p>
              <p className="mt-1 text-2xl font-bold text-teal-700">
                {fmtSum(summary.expectedCash)}
              </p>
              <p className="mt-0.5 text-xs text-teal-700/70">
                Karta/onlayn (alohida): {fmtSum(summary.cardTotal)}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader
              title={t("Naqd kirim-chiqim")}
              subtitle={t("Qo'lda naqd olish/qo'shish — sabab majburiy")}
              action={
                <div className="flex gap-2">
                  <button
                    onClick={() => setMovForm({ type: "KIRIM", amount: "", reason: "" })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    <ArrowDownCircle size={14} /> {t("Kirim")}
                  </button>
                  <button
                    onClick={() => setMovForm({ type: "CHIQIM", amount: "", reason: "" })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <ArrowUpCircle size={14} /> {t("Chiqim")}
                  </button>
                </div>
              }
            />
            <Table head={[t("Vaqt"), t("Tur"), t("Summa"), t("Sabab"), t("Kim")]}>
              {moves.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-400">
                    {t("Bu smenada qo'lda kirim-chiqim yo'q")}
                  </td>
                </tr>
              )}
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-3 text-slate-500">{fmtDT(m.createdAt)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.type === "KIRIM"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {m.type === "KIRIM" ? "Kirim" : "Chiqim"}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold">
                    {m.type === "KIRIM" ? "+" : "−"}
                    {fmtSum(m.amount)}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{m.reason}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{m.createdByName}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}

      {!current && sessions !== null && (
        <Card className="p-8 text-center">
          <Wallet size={40} className="mx-auto text-slate-300" />
          <p className="mt-3 font-semibold">{t("Ochiq smena yo'q")}</p>
          <p className="mt-1 text-sm text-slate-500">
            {t("Kunni boshlashda kassadagi naqd pulni sanab, smena oching")}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title={t("Smenalar tarixi")} subtitle={t("Oxirgi 30 ta")} />
        <Table head={[t("Ochildi"), t("Yopildi"), t("Boshlang'ich"), t("Kutilgan"), t("Haqiqiy"), t("Farq"), ""]}>
          {(sessions ?? [])
            .filter((s) => s.status === "YOPIQ")
            .map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">
                  {fmtDT(s.openedAt)}
                  <span className="block text-xs text-slate-400">{s.openedByName}</span>
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {fmtDT(s.closedAt)}
                  <span className="block text-xs text-slate-400">{s.closedByName}</span>
                </td>
                <td className="px-5 py-3">{fmtSum(s.openingCash)}</td>
                <td className="px-5 py-3">{fmtSum(s.expectedCash ?? 0)}</td>
                <td className="px-5 py-3">{fmtSum(s.actualCash ?? 0)}</td>
                <td
                  className={`px-5 py-3 font-semibold ${
                    (s.difference ?? 0) === 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {(s.difference ?? 0) > 0 ? "+" : ""}
                  {fmtSum(s.difference ?? 0)}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setDetail(s)}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    {t("Batafsil")}
                  </button>
                </td>
              </tr>
            ))}
        </Table>
      </Card>

      {/* ============ MODALLAR ============ */}
      {openForm && (
        <Modal title={t("Smena ochish")} onClose={() => setOpenForm(false)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run("Smena ochildi", async () => {
                const { error } = await sb.rpc("open_cash_session", {
                  p_opening_cash: Math.max(0, Math.round(Number(openingCash) || 0)),
                });
                if (error) throw new Error(error.message);
                setOpenForm(false);
                setOpeningCash("");
              });
            }}
          >
            <Field label={t("Kassadagi boshlang'ich naqd (so'm) *")}>
              <input
                required
                inputMode="numeric"
                autoFocus
                className={inputCls}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="0"
              />
            </Field>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Ochilmoqda...") : t("Smenani ochish")}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {movForm && (
        <Modal
          title={movForm.type === "KIRIM" ? t("Naqd kirim") : t("Naqd chiqim")}
          onClose={() => setMovForm(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = movForm;
              run("Yozib qo'yildi", async () => {
                const { error } = await sb.rpc("add_cash_movement", {
                  p_type: m.type,
                  p_amount: Math.round(Number(m.amount) || 0),
                  p_reason: m.reason.trim(),
                });
                if (error) throw new Error(error.message);
                setMovForm(null);
              });
            }}
          >
            <Field label={t("Summa (so'm) *")}>
              <input required inputMode="numeric" autoFocus className={inputCls}
                value={movForm.amount}
                onChange={(e) => setMovForm({ ...movForm, amount: e.target.value })} />
            </Field>
            <Field label={t("Sabab *")}>
              <input required className={inputCls} value={movForm.reason}
                onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })}
                placeholder={
                  movForm.type === "KIRIM"
                    ? "Masalan: mayda pul qo'shildi"
                    : "Masalan: xo'jalik xaridi / inkassatsiya"
                } />
            </Field>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("Tasdiqlash")}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {closeForm && summary && (
        <Modal title={t("Smenani yopish")} onClose={() => setCloseForm(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = closeForm;
              run("Smena yopildi", async () => {
                const { data, error } = await sb.rpc("close_cash_session", {
                  p_actual_cash: Math.max(0, Math.round(Number(f.actual) || 0)),
                  p_note: f.note.trim(),
                });
                if (error) throw new Error(error.message);
                setCloseForm(null);
                const d = Number(data?.difference ?? 0);
                notify(
                  d === 0
                    ? "Smena yopildi — kassa aniq chiqdi"
                    : `Smena yopildi — farq: ${d > 0 ? "+" : ""}${fmtSum(d)}`,
                );
              });
            }}
          >
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="flex justify-between">
                <span className="text-slate-500">{t("Kutilayotgan naqd:")}</span>
                <b>{fmtSum(summary.expectedCash)}</b>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Boshlang'ich {fmtSum(summary.openingCash)} + tushum{" "}
                {fmtSum(summary.serviceCash + summary.posCash)} − qaytarish{" "}
                {fmtSum(summary.serviceRefundCash + summary.posRefundCash)} + kirim{" "}
                {fmtSum(summary.cashIn)} − chiqim {fmtSum(summary.cashOut)}
              </p>
            </div>
            <Field label={t("Haqiqiy sanab chiqilgan naqd (so'm) *")}>
              <input required inputMode="numeric" autoFocus className={inputCls}
                value={closeForm.actual}
                onChange={(e) => setCloseForm({ ...closeForm, actual: e.target.value })} />
            </Field>
            {closeForm.actual !== "" && (
              <p
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  Math.round(Number(closeForm.actual) || 0) - summary.expectedCash === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                Farq:{" "}
                {fmtSum(Math.round(Number(closeForm.actual) || 0) - summary.expectedCash)}
              </p>
            )}
            <Field label={t("Izoh")}>
              <input className={inputCls} value={closeForm.note}
                onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })} />
            </Field>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Yopilmoqda...") : t("Smenani yopish")}
            </PrimaryButton>
            <p className="text-center text-xs text-slate-400">
              {t("Yopilgan smena o'zgartirilmaydi — hisob audit uchun saqlanadi")}
            </p>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Smena — ${fmtDT(detail.openedAt)}`} onClose={() => setDetail(null)}>
          <div className="space-y-2 text-sm">
            <p className="flex justify-between"><span className="text-slate-500">{t("Ochdi:")}</span><b>{detail.openedByName}</b></p>
            <p className="flex justify-between"><span className="text-slate-500">{t("Yopdi:")}</span><b>{detail.closedByName} · {fmtDT(detail.closedAt)}</b></p>
            <p className="flex justify-between"><span className="text-slate-500">{t("Boshlang'ich naqd:")}</span><b>{fmtSum(detail.openingCash)}</b></p>
            <p className="flex justify-between"><span className="text-slate-500">{t("Kutilgan naqd:")}</span><b>{fmtSum(detail.expectedCash ?? 0)}</b></p>
            <p className="flex justify-between"><span className="text-slate-500">{t("Haqiqiy naqd:")}</span><b>{fmtSum(detail.actualCash ?? 0)}</b></p>
            <p className="flex justify-between">
              <span className="text-slate-500">{t("Farq:")}</span>
              <b className={(detail.difference ?? 0) === 0 ? "text-emerald-600" : "text-rose-600"}>
                {(detail.difference ?? 0) > 0 ? "+" : ""}{fmtSum(detail.difference ?? 0)}
              </b>
            </p>
            {detail.note && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{detail.note}</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
