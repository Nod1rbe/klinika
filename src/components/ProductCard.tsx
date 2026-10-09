import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ClipboardCheck,
  History,
  Loader2,
  Package,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react";
import { Field, inputCls, Modal, PrimaryButton } from "./ui";
import { fmtSum } from "../data/mock";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useStore } from "../store";
import type { MovementType, Product } from "../types";
import { MOVEMENT_LABELS } from "../types";

type CardTab = "zaxira" | "malumot" | "tarix";

// Zaxira amallari — har biri oddiy tilda, tez sabablar bilan
type OpKey = "kirim" | "chiqim" | "qaytarish" | "sanash";
const OPS: {
  key: OpKey;
  label: string;
  hint: string;
  icon: typeof Package;
  tone: string;
  reasons: string[];
}[] = [
  {
    key: "kirim",
    label: "Kirim",
    hint: "Tovar keldi yoki boshlang'ich qoldiq",
    icon: ArrowDownToLine,
    tone: "emerald",
    reasons: ["Boshlang'ich qoldiq", "Ta'minotchidan keldi", "Topildi"],
  },
  {
    key: "chiqim",
    label: "Hisobdan chiqarish",
    hint: "Buzilgan, muddati o'tgan, yo'qolgan",
    icon: Trash2,
    tone: "rose",
    reasons: ["Muddati o'tdi", "Buzildi / sindi", "Yo'qoldi", "Ichki ehtiyoj"],
  },
  {
    key: "qaytarish",
    label: "Ta'minotchiga qaytarish",
    hint: "Sifatsiz yoki ortiqcha tovar",
    icon: Undo2,
    tone: "amber",
    reasons: ["Sifatsiz tovar", "Muddati yaqin", "Ortiqcha keldi"],
  },
  {
    key: "sanash",
    label: "Inventarizatsiya",
    hint: "Sanab chiqilgan haqiqiy miqdorni kiriting",
    icon: ClipboardCheck,
    tone: "sky",
    reasons: ["Inventarizatsiya"],
  },
];

const TONE: Record<string, { on: string; text: string }> = {
  emerald: { on: "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200", text: "text-emerald-600" },
  rose: { on: "border-rose-400 bg-rose-50 ring-2 ring-rose-200", text: "text-rose-600" },
  amber: { on: "border-amber-400 bg-amber-50 ring-2 ring-amber-200", text: "text-amber-600" },
  sky: { on: "border-sky-400 bg-sky-50 ring-2 ring-sky-200", text: "text-sky-600" },
};

const UNITS = ["dona", "upakovka", "quti", "flakon", "ml", "gr", "kg", "litr"];
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export default function ProductCard({
  productId,
  onClose,
  canManage,
  canSeeCost,
}: {
  productId: string;
  onClose: () => void;
  canManage: boolean;
  canSeeCost: boolean;
}) {
  const { products, suppliers, movements, retryLoad, notify } = useStore();
  const p = products.find((x) => x.id === productId);
  const [tab, setTab] = useState<CardTab>(canManage ? "zaxira" : "tarix");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Zaxira amali holati
  const [op, setOp] = useState<OpKey>("kirim");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  // Ma'lumotlarni tahrirlash formasi
  const [form, setForm] = useState(() => toForm(p));

  const history = useMemo(
    () => movements.filter((m) => m.productId === productId).slice(0, 40),
    [movements, productId],
  );

  if (!p) return null;
  const product: Product = p;

  const n = Number(qty.replace(",", "."));
  const validQty = qty.trim() !== "" && Number.isFinite(n) && n >= 0;
  // Natijaviy zaxira: kirim +, chiqim/qaytarish −, sanash — to'g'ridan-to'g'ri qiymat
  const delta = !validQty
    ? 0
    : op === "kirim"
      ? n
      : op === "sanash"
        ? round3(n - product.stock)
        : -n;
  const after = round3(product.stock + delta);
  const opDef = OPS.find((o) => o.key === op)!;

  async function saveStock() {
    if (!supabase || busy) return;
    setErr(null);
    if (!validQty || (op !== "sanash" && n <= 0)) return setErr(t("Miqdorni kiriting"));
    if (delta === 0) return setErr(t("Zaxira o'zgarmaydi — sanalgan miqdor hozirgi bilan bir xil"));
    if (after < 0) return setErr(t("Zaxiradan ko'p chiqarib bo'lmaydi"));
    const why = reason.trim() || (op === "sanash" ? t("Inventarizatsiya") : "");
    if (!why) return setErr(t("Sababni tanlang yoki yozing"));
    const type: MovementType =
      op === "kirim" ? "KIRIM" : op === "chiqim" ? "CHIQIM" : op === "qaytarish" ? "TAMINOTCHI_QAYTARISH" : "TUZATISH";
    setBusy(true);
    try {
      const { error } = await supabase.rpc("adjust_stock", {
        p_product_id: product.id,
        p_qty_change: delta,
        p_type: type,
        p_reason: why,
      });
      if (error) throw new Error(error.message);
      notify(`${t("Zaxira yangilandi")}: ${product.stock} → ${after} ${product.unit}`);
      setQty("");
      setReason("");
      retryLoad();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: form.name.trim(),
          sku: form.sku.trim(),
          barcode: form.barcode.trim(),
          category: form.category.trim(),
          sell_price: Math.max(0, Math.round(Number(form.sellPrice) || 0)),
          min_stock: Math.max(0, Number(form.minStock.replace(",", ".")) || 0),
          unit: form.unit,
          expiry_date: form.expiryDate || null,
          supplier_id: form.supplierId || null,
          active: form.active,
        })
        .eq("id", product.id);
      if (error)
        throw new Error(
          error.message.includes("products_sku_uniq")
            ? t("Bu SKU allaqachon mavjud")
            : error.message.includes("products_barcode_uniq")
              ? t("Bu shtrix-kod allaqachon mavjud")
              : error.message,
        );
      notify(t("Mahsulot yangilandi"));
      retryLoad();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  }

  const low = product.active && product.stock <= product.minStock;
  const tabs: { key: CardTab; label: string; icon: typeof Package }[] = [
    ...(canManage
      ? [
          { key: "zaxira" as const, label: "Zaxira", icon: Package },
          { key: "malumot" as const, label: "Ma'lumotlar", icon: Pencil },
        ]
      : []),
    { key: "tarix", label: "Tarix", icon: History },
  ];

  return (
    <Modal title={product.name} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Qisqa ko'rsatkichlar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={`rounded-xl border p-3 ${low ? "border-rose-200 bg-rose-50" : "border-slate-200"}`}>
            <p className="text-xs text-slate-500">{t("Zaxira")}</p>
            <p className={`text-xl font-bold tabular-nums ${low ? "text-rose-600" : ""}`}>
              {product.stock} <span className="text-sm font-medium">{product.unit}</span>
            </p>
            <p className="text-[11px] text-slate-400">min: {product.minStock}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{t("Sotuv narxi")}</p>
            <p className="text-xl font-bold tabular-nums">{fmtSum(product.sellPrice)}</p>
          </div>
          {canSeeCost && (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{t("Tannarx")}</p>
              <p className="text-xl font-bold tabular-nums">{fmtSum(product.avgCost)}</p>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">{t("Yaroqlilik muddati")}</p>
            <p className="text-xl font-bold tabular-nums">{product.expiryDate ?? "—"}</p>
          </div>
        </div>

        {tabs.length > 1 && (
          <div className="flex gap-1 rounded-xl border border-slate-200 p-1">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => {
                  setTab(tb.key);
                  setErr(null);
                }}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === tb.key ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <tb.icon size={14} /> {t(tb.label)}
              </button>
            ))}
          </div>
        )}

        {/* ===== ZAXIRA ===== */}
        {tab === "zaxira" && canManage && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {OPS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    setOp(o.key);
                    setReason("");
                    setErr(null);
                  }}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                    op === o.key ? TONE[o.tone].on : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <o.icon size={18} className={`mt-0.5 shrink-0 ${TONE[o.tone].text}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t(o.label)}</span>
                    <span className="block text-xs text-slate-500">{t(o.hint)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={op === "sanash" ? t("Sanalgan haqiqiy miqdor") : `${t("Miqdor")} (${product.unit})`}>
                <input
                  id="card-qty"
                  autoFocus
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveStock();
                  }}
                  className={`${inputCls} text-lg font-semibold`}
                  placeholder="0"
                />
              </Field>
              <div className="flex flex-col justify-end">
                <div
                  className={`rounded-xl border px-4 py-2.5 ${
                    !validQty || delta === 0
                      ? "border-slate-200 bg-slate-50 text-slate-400"
                      : after < 0
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-teal-200 bg-teal-50 text-teal-800"
                  }`}
                >
                  <p className="text-xs">{t("Natija")}</p>
                  <p className="text-lg font-bold tabular-nums">
                    {product.stock} → {validQty ? after : "…"} {product.unit}
                    {validQty && delta !== 0 && (
                      <span className="ml-2 text-sm font-semibold">
                        ({delta > 0 ? "+" : ""}
                        {delta})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {op !== "sanash" && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-600">{t("Sabab")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {opDef.reasons.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(t(r))}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        reason === t(r)
                          ? "border-teal-500 bg-teal-600 text-white"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {t(r)}
                    </button>
                  ))}
                </div>
                <input
                  id="card-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("yoki o'zingiz yozing...")}
                  className={inputCls}
                />
              </div>
            )}

            {op === "kirim" && (
              <p className="text-xs text-slate-400">
                {t("Narxi bilan kelgan tovarni Kirimlar bo'limi yoki Excel import orqali kiriting — shunda tannarx ham yangilanadi.")}
              </p>
            )}

            {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t(err)}</p>}

            <PrimaryButton
              onClick={saveStock}
              className={`w-full justify-center py-2.5 ${busy ? "pointer-events-none opacity-60" : ""}`}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {busy ? t("Saqlanmoqda...") : `${t(opDef.label)} — ${t("tasdiqlash")}`}
            </PrimaryButton>
          </div>
        )}

        {/* ===== MA'LUMOTLAR ===== */}
        {tab === "malumot" && canManage && (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={saveInfo}>
            <div className="sm:col-span-2">
              <Field label={t("Nomi *")}>
                <input id="card-name" required className={inputCls} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <Field label={t("Sotuv narxi (so'm) *")}>
              <input id="card-price" required inputMode="numeric" className={inputCls} value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} />
            </Field>
            <Field label={t("Minimal zaxira (ogohlantirish)")}>
              <input id="card-min" inputMode="decimal" className={inputCls} value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            </Field>
            <Field label={t("Kategoriya")}>
              <input id="card-cat" list="card-cats" className={inputCls} value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <datalist id="card-cats">
                {[...new Set(products.map((x) => x.category).filter(Boolean))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label={t("O'lchov birligi")}>
              <select id="card-unit" className={inputCls} value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {[...new Set([form.unit, ...UNITS])].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
            <Field label={t("Yaroqlilik muddati")}>
              <input id="card-exp" type="date" className={inputCls} value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </Field>
            <Field label={t("Ta'minotchi")}>
              <select id="card-sup" className={inputCls} value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">—</option>
                {suppliers.filter((s) => s.active || s.id === form.supplierId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t("SKU / ichki kod")}>
              <input id="card-sku" className={inputCls} value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <Field label={t("Shtrix-kod")}>
              <input id="card-barcode" className={inputCls} value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input id="card-active" type="checkbox" checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4 accent-teal-600" />
              {t("Faol (POS'da sotiladi)")}
            </label>
            {err && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{t(err)}</p>
            )}
            <div className="sm:col-span-2">
              <PrimaryButton type="submit" className="w-full justify-center">
                {busy ? t("Saqlanmoqda...") : t("Saqlash")}
              </PrimaryButton>
            </div>
          </form>
        )}

        {/* ===== TARIX ===== */}
        {tab === "tarix" && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            {history.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{t("Bu mahsulot bo'yicha harakatlar yo'q")}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-semibold">{t("Vaqt")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Amal")}</th>
                    <th className="px-3 py-2 font-semibold">{t("O'zgarish")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Qoldiq")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Izoh")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">
                        {new Date(m.createdAt).toLocaleString("ru-RU", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{t(MOVEMENT_LABELS[m.type])}</td>
                      <td className={`px-3 py-2 font-semibold ${m.qtyChange > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {m.qtyChange > 0 ? "+" : ""}
                        {m.qtyChange}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{m.stockBefore} → {m.stockAfter}</td>
                      <td className="max-w-48 px-3 py-2 text-xs text-slate-500">
                        <span className="line-clamp-1">{m.reason}</span>
                        <span className="text-slate-400">{m.createdByName}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function toForm(p?: Product) {
  return {
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    barcode: p?.barcode ?? "",
    category: p?.category ?? "",
    sellPrice: String(p?.sellPrice ?? ""),
    minStock: String(p?.minStock ?? ""),
    unit: p?.unit ?? "dona",
    expiryDate: p?.expiryDate ?? "",
    supplierId: p?.supplierId ?? "",
    active: p?.active ?? true,
  };
}
