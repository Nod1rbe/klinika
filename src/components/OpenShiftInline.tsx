import { useState } from "react";
import { Loader2, Lock, PlayCircle } from "lucide-react";
import { notifyCashChanged } from "../lib/cashSession";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useStore } from "../store";

// Naqd to'lov tanlanganda smena ochilmagan bo'lsa ko'rsatiladi.
// Xodim joriy ishini tashlab ketmasdan shu yerning o'zida smenani ochadi.
export default function OpenShiftInline() {
  const { notify } = useStore();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function open() {
    if (!supabase || busy) return;
    const n = Math.round(Number(amount.replace(/\s/g, "")) || 0);
    if (amount.trim() === "" || n < 0) {
      setErr(t("Kassadagi naqd summani kiriting (bo'sh bo'lsa 0)"));
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.rpc("open_cash_session", { p_opening_cash: n });
      if (error) throw new Error(error.message);
      notify(t("Smena ochildi"));
      notifyCashChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm">
      <p className="flex items-start gap-2 text-amber-900">
        <Lock size={15} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          <b>{t("Naqd to'lov uchun smena ochilmagan.")}</b>{" "}
          {t("Kassadagi naqdni sanab shu yerda smenani oching yoki karta/onlayn to'lovni tanlang.")}
        </span>
      </p>
      <div className="flex gap-2">
        <input
          id="inline-opening-cash"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              open();
            }
          }}
          placeholder={t("Kassadagi naqd, so'm")}
          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
        />
        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
          {t("Smena ochish")}
        </button>
      </div>
      {err && <p className="text-xs text-rose-700">{t(err)}</p>}
    </div>
  );
}
