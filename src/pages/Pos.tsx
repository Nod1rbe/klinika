import { useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
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
import { supabase } from "../lib/supabase";
import { notifyCashChanged } from "../lib/cashSession";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import type { PaymentMethod, Product } from "../types";

const METHODS: PaymentMethod[] = ["Naqd", "Click", "Payme", "Uzum", "Karta (POS)"];

interface CartLine {
  product: Product;
  qty: number;
}

interface DoneSale {
  saleNo: string;
  total: number;
  receipt: ReceiptData;
}

export default function Pos({ embedded = false }: { embedded?: boolean }) {
  const { products, patients, clinic, retryLoad, notify, profile } = useStore();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  // Split to'lov: asosiy usul + ixtiyoriy ikkinchi usul
  const [method1, setMethod1] = useState<PaymentMethod>("Naqd");
  const [split, setSplit] = useState(false);
  const [method2, setMethod2] = useState<PaymentMethod>("Karta (POS)");
  const [amount2, setAmount2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneSale | null>(null);
  // Idempotency: har savat uchun bitta kalit — tugma ikki marta bosilsa ham bitta sotuv
  const idemKey = useRef<string>(crypto.randomUUID());

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.active &&
          (p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode === q.trim()),
      )
      .slice(0, 8);
  }, [query, products]);

  const foundPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
      )
      .slice(0, 5);
  }, [patientQuery, patients]);

  // Qator summasi serverdagi kabi yaxlitlanadi (kasr miqdorlarda ham to'lov
  // yig'indisi server jamisi bilan aynan mos kelishi uchun)
  const lineSum = (l: CartLine) => Math.round(l.qty * l.product.sellPrice);
  const subtotal = cart.reduce((s, l) => s + lineSum(l), 0);
  const disc = Math.max(0, Math.round(Number(discount) || 0));
  const total = Math.max(0, subtotal - disc);
  const amt2 = Math.max(0, Math.round(Number(amount2) || 0));
  const amt1 = split ? Math.max(0, total - amt2) : total;

  function addToCart(p: Product) {
    setError(null);
    setCart((prev) => {
      const ex = prev.find((l) => l.product.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) {
          setError(`${p.name}: ${t("omborda")} ${p.stock} ${p.unit} ${t("qoldi")}`);
          return prev;
        }
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, qty: Math.min(l.qty + 1, p.stock) } : l,
        );
      }
      if (p.stock <= 0) {
        setError(`${p.name}: ${t("omborda qolmagan")}`);
        return prev;
      }
      // Qisman upakovka qolgan bo'lsa (masalan 0.8) — borini savatga qo'yamiz
      return [...prev, { product: p, qty: Math.min(1, p.stock) }];
    });
    setQuery("");
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== id) return l;
          const q = Math.round(Math.min(Math.max(qty, 0), l.product.stock) * 1000) / 1000;
          return { ...l, qty: q };
        })
        .filter((l) => l.qty > 0),
    );
  }

  async function submit() {
    if (busy || !supabase) return;
    setError(null);
    if (cart.length === 0) return setError("Savat bo'sh");
    if (total <= 0) return setError("Summa noto'g'ri");
    const payments = split
      ? [
          { method: method1, amount: amt1 },
          { method: method2, amount: amt2 },
        ].filter((p) => p.amount > 0)
      : [{ method: method1, amount: total }];
    if (split && (amt2 <= 0 || amt2 >= total))
      return setError("Ikkinchi to'lov summasi 0 dan katta va jamidan kichik bo'lsin");
    if (split && method1 === method2)
      return setError("Ikki xil to'lov usulini tanlang");

    const w = openReceiptWindow();
    setBusy(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("create_sale", {
        p_items: cart.map((l) => ({ id: l.product.id, qty: l.qty })),
        p_payments: payments,
        p_discount: disc,
        p_patient_id: patientId,
        p_note: "",
        p_idempotency_key: idemKey.current,
      });
      if (rpcErr || !data) throw new Error(rpcErr?.message ?? "Sotuv saqlanmadi");
      const receipt: ReceiptData = {
        saleNo: data.saleNo,
        patientName: patients.find((p) => p.id === patientId)?.fullName ?? "",
        doctorName: "",
        items: cart.map((l) => ({
          name: l.product.name,
          price: l.product.sellPrice,
          qty: l.qty !== 1 ? l.qty : undefined,
        })),
        total: data.total,
        method: payments.map((p) => `${p.method} ${fmtSum(p.amount)}`).join(" + "),
        date: data.date,
        time: data.time,
        clinic,
      };
      if (w) renderReceiptInto(w, receipt);
      setDone({ saleNo: data.saleNo, total: data.total, receipt });
      notify(`${t("Sotuv saqlandi")}: ${data.saleNo}`);
      retryLoad();
      notifyCashChanged();
    } catch (e) {
      w?.close();
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setCart([]);
    setDiscount("");
    setPatientId(null);
    setPatientQuery("");
    setSplit(false);
    setAmount2("");
    setMethod1("Naqd");
    idemKey.current = crypto.randomUUID();
  }

  if (profile && !["direktor", "registratura", "hisobchi"].includes(profile.role)) {
    return <p className="text-sm text-slate-500">{t("Bu sahifaga ruxsatingiz yo'q.")}</p>;
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-5 pt-10">
        <Card className="p-8 text-center">
          <ShoppingCart size={44} className="mx-auto text-emerald-500" />
          <h1 className="mt-3 text-xl font-bold">{t("Sotuv yakunlandi")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("Chek")}: {done.saleNo}</p>
          <p className="mt-2 text-3xl font-bold text-teal-600">{fmtSum(done.total)}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => printReceipt(done.receipt)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Printer size={15} /> {t("Chekni qayta chiqarish")}
            </button>
            <PrimaryButton onClick={reset}>
              <Plus size={15} /> {t("Yangi sotuv")}
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Sotuv (POS)")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Mahsulot nomi, SKU yoki shtrix-kod bo'yicha qidiring — skaner ham ishlaydi")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* Qidiruv + savat */}
        <div className="space-y-4 xl:col-span-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Shtrix-kod skaner Enter yuboradi — bitta aniq topilma bo'lsa savatga
                if (e.key === "Enter" && found.length === 1) addToCart(found[0]);
              }}
              placeholder={t("Mahsulot qidirish yoki shtrix-kod skanerlang...")}
              className={`${inputCls} py-3 pl-10 text-base`}
            />
          </div>

          {found.length > 0 && (
            <Card>
              <div className="divide-y divide-slate-50">
                {found.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-teal-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="text-xs text-slate-400">
                        {p.sku && `${p.sku} · `}
                        Omborda: {p.stock} {p.unit}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-teal-700">
                      {fmtSum(p.sellPrice)}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title={t("Savat")}
              subtitle={`${cart.length} ${t("xil mahsulot")}`}
              action={
                cart.length > 0 ? (
                  <button
                    onClick={() => setCart([])}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-500 hover:text-rose-600"
                  >
                    <Trash2 size={14} /> {t("Tozalash")}
                  </button>
                ) : undefined
              }
            />
            {cart.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                {t("Savat bo'sh — yuqoridan mahsulot qidiring")}
              </p>
            ) : (
              <div className="divide-y divide-slate-50">
                {cart.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.product.name}</p>
                      <p className="text-xs text-slate-400">
                        {fmtSum(l.product.sellPrice)} × {l.qty} {l.product.unit}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => setQty(l.product.id, l.qty - 1)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                      >
                        <Minus size={13} />
                      </button>
                      {/* Kasr miqdor ham kiritiladi (0.5 upakovka). Qiymat maydondan
                          chiqqanda qabul qilinadi — yozish jarayonida qator o'chib ketmasin */}
                      <input
                        key={`${l.product.id}-${l.qty}`}
                        id={`qty-${l.product.id}`}
                        defaultValue={l.qty}
                        inputMode="decimal"
                        onBlur={(e) => {
                          const n = Number(e.target.value.replace(",", "."));
                          if (!Number.isFinite(n) || n < 0) e.target.value = String(l.qty);
                          else setQty(l.product.id, n);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-14 rounded-lg border border-slate-200 py-1 text-center text-sm"
                      />
                      <button
                        onClick={() => setQty(l.product.id, l.qty + 1)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="w-24 shrink-0 text-right text-sm font-semibold">
                      {fmtSum(lineSum(l))}
                    </span>
                    <button
                      onClick={() => setQty(l.product.id, 0)}
                      className="shrink-0 rounded p-1 text-slate-300 hover:text-rose-500"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* To'lov paneli */}
        <div className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader title={t("Mijoz (ixtiyoriy)")} />
            <div className="space-y-3 p-4">
              {patientId ? (
                <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-teal-800">
                    <UserRound size={15} className="shrink-0" />
                    <span className="truncate">
                      {patients.find((p) => p.id === patientId)?.fullName}
                    </span>
                  </span>
                  <button
                    onClick={() => setPatientId(null)}
                    className="rounded p-1 text-teal-600 hover:bg-teal-100"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder={t("Bemor qidirish (ism/telefon)...")}
                    className={inputCls}
                  />
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
                          {p.fullName}
                          <span className="block text-xs text-slate-400">{p.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("To'lov")} />
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("Oraliq jami:")}</span>
                <span className="font-medium">{fmtSum(subtotal)}</span>
              </div>
              <Field label={t("Chegirma (so'm)")}>
                <input
                  inputMode="numeric"
                  className={inputCls}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-semibold">{t("JAMI:")}</span>
                <span className="text-2xl font-bold text-teal-700">{fmtSum(total)}</span>
              </div>

              <Field label={split ? t("1-to'lov usuli") : t("To'lov usuli")}>
                <select
                  className={inputCls}
                  value={method1}
                  onChange={(e) => setMethod1(e.target.value as PaymentMethod)}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{t(m)}</option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={split}
                  onChange={(e) => setSplit(e.target.checked)}
                  className="h-4 w-4 accent-teal-600"
                />
                {t("Bo'lib to'lash (masalan: qisman naqd + karta)")}
              </label>
              {split && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("2-usul")}>
                    <select
                      className={inputCls}
                      value={method2}
                      onChange={(e) => setMethod2(e.target.value as PaymentMethod)}
                    >
                      {METHODS.map((m) => (
                        <option key={m} value={m}>{t(m)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("2-usul summasi")}>
                    <input
                      inputMode="numeric"
                      className={inputCls}
                      value={amount2}
                      onChange={(e) => setAmount2(e.target.value)}
                    />
                  </Field>
                  <p className="col-span-2 -mt-1 text-xs text-slate-400">
                    {method1}: <b>{fmtSum(amt1)}</b> + {method2}: <b>{fmtSum(amt2)}</b>
                  </p>
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {t(error)}
                </p>
              )}
              <PrimaryButton
                onClick={submit}
                className={`w-full justify-center py-2.5 ${busy ? "pointer-events-none opacity-60" : ""}`}
              >
                <ShoppingCart size={16} />
                {busy ? t("Saqlanmoqda...") : t("Sotish + chek chiqarish")}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
