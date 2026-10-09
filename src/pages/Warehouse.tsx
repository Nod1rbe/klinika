import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Truck,
  X,
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
import ImportPurchase from "../components/ImportPurchase";
import ProductCard from "../components/ProductCard";
import { fmtSum } from "../data/mock";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import type { Product } from "../types";
import { MOVEMENT_LABELS } from "../types";

type Tab = "mahsulotlar" | "kirim" | "harakatlar" | "taminotchilar";

const TABS: { key: Tab; label: string; icon: typeof Boxes }[] = [
  { key: "mahsulotlar", label: "Mahsulotlar", icon: Boxes },
  { key: "kirim", label: "Kirimlar", icon: Truck },
  { key: "harakatlar", label: "Harakatlar", icon: ArrowDownUp },
  { key: "taminotchilar", label: "Ta'minotchilar", icon: Truck },
];

const UNITS = ["dona", "quti", "upakovka", "flakon", "ml", "gr", "kg", "litr"];

// Muddati 30 kun ichida tugaydiganlar "yaqin" hisoblanadi
function expiryState(p: Product, today: string): "expired" | "soon" | null {
  if (!p.expiryDate) return null;
  if (p.expiryDate <= today) return "expired";
  const soon = new Date(`${today}T12:00:00`);
  soon.setDate(soon.getDate() + 30);
  const iso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;
  return p.expiryDate <= iso ? "soon" : null;
}

const emptyProd = {
  id: undefined as string | undefined,
  name: "",
  sku: "",
  barcode: "",
  category: "",
  sellPrice: "",
  minStock: "",
  unit: "dona",
  expiryDate: "",
  supplierId: "",
  active: true,
};

export default function Warehouse() {
  const {
    products,
    suppliers,
    purchases,
    movements,
    profile,
    retryLoad,
    notify,
    today,
  } = useStore();
  const [tab, setTab] = useState<Tab>("mahsulotlar");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "expiry" | "inactive">("all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [prodModal, setProdModal] = useState<typeof emptyProd | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [supModal, setSupModal] = useState<null | {
    id?: string;
    name: string;
    contactPerson: string;
    phone: string;
    active: boolean;
  }>(null);
  const [purModal, setPurModal] = useState<null | {
    supplierId: string;
    note: string;
    lines: { productId: string; qty: string; cost: string }[];
  }>(null);
  const [payModal, setPayModal] = useState<null | {
    purchaseId: string;
    debt: number;
    amount: string;
  }>(null);
  const [importOpen, setImportOpen] = useState(false);

  const canManage = profile && ["direktor", "omborchi"].includes(profile.role);
  const canSeeCost = profile && ["direktor", "omborchi", "hisobchi"].includes(profile.role);
  const canPay = profile && ["direktor", "hisobchi"].includes(profile.role);

  const lowCount = products.filter((p) => p.active && p.stock <= p.minStock).length;
  const expiryCount = products.filter((p) => p.active && expiryState(p, today)).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)))
        return false;
      if (filter === "low") return p.active && p.stock <= p.minStock;
      if (filter === "expiry") return p.active && !!expiryState(p, today);
      if (filter === "inactive") return !p.active;
      return p.active;
    });
  }, [products, query, filter, today]);

  if (profile && !["direktor", "omborchi", "hisobchi"].includes(profile.role)) {
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
      retryLoad();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const prodName = (id: string) => products.find((p) => p.id === id)?.name ?? "?";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Ombor")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("Mahsulotlar, kirim, zaxira harakatlari va ta'minotchilar")}
        </p>
      </div>

      {(lowCount > 0 || expiryCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowCount > 0 && (
            <button
              onClick={() => {
                setTab("mahsulotlar");
                setFilter("low");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              <AlertTriangle size={15} /> {lowCount} {t("ta mahsulot kam qoldi")}
            </button>
          )}
          {expiryCount > 0 && (
            <button
              onClick={() => {
                setTab("mahsulotlar");
                setFilter("expiry");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100"
            >
              <AlertTriangle size={15} /> {expiryCount} {t("ta muddati tugagan/yaqin")}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:inline-flex">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              tab === tb.key ? "bg-teal-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <tb.icon size={15} /> {t(tb.label)}
          </button>
        ))}
      </div>

      {err && <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{t(err)}</p>}

      {/* ============ MAHSULOTLAR ============ */}
      {tab === "mahsulotlar" && (
        <Card>
          <CardHeader
            title={t("Mahsulotlar")}
            subtitle={`${shown.length} ${t("ta ko'rsatilmoqda")}`}
            action={
              canManage ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                  >
                    <FileSpreadsheet size={15} /> {t("Excel'dan yuklash")}
                  </button>
                  <PrimaryButton onClick={() => setProdModal({ ...emptyProd })}>
                    <Plus size={15} /> {t("Yangi mahsulot")}
                  </PrimaryButton>
                </div>
              ) : undefined
            }
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            <div className="relative">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Nomi, SKU, shtrix-kod...")}
                className={`${inputCls} w-64 pl-8`}
              />
            </div>
            {(
              [
                ["all", "Faol"],
                ["low", "Kam qolgan"],
                ["expiry", "Muddati"],
                ["inactive", "O'chirilgan"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  filter === k ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {t(l)}
              </button>
            ))}
          </div>
          <Table
            head={
              canSeeCost
                ? [t("Mahsulot"), t("Zaxira"), t("Tannarx"), t("Sotuv narxi"), t("Marja"), ""]
                : [t("Mahsulot"), t("Zaxira"), t("Sotuv narxi"), ""]
            }
          >
            {shown.map((p) => {
              const low = p.active && p.stock <= p.minStock;
              const exp = expiryState(p, today);
              return (
                <tr
                  key={p.id}
                  tabIndex={0}
                  onClick={() => setCardId(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setCardId(p.id);
                  }}
                  className={`cursor-pointer outline-none focus-visible:bg-teal-50 ${
                    p.active ? "hover:bg-teal-50/50" : "text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <td className="px-5 py-3">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {[p.sku, p.category].filter(Boolean).join(" · ")}
                      {exp && (
                        <span className={`ml-1 font-semibold ${exp === "expired" ? "text-rose-500" : "text-amber-600"}`}>
                          {exp === "expired" ? `muddati tugagan (${p.expiryDate})` : `muddati: ${p.expiryDate}`}
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-semibold ${low ? "text-rose-600" : ""}`}>
                      {p.stock} {p.unit}
                    </span>
                    {low && <span className="block text-xs text-rose-500">min: {p.minStock}</span>}
                  </td>
                  {canSeeCost && <td className="px-5 py-3 text-slate-500">{fmtSum(p.avgCost)}</td>}
                  <td className="px-5 py-3 font-medium">{fmtSum(p.sellPrice)}</td>
                  {canSeeCost && (
                    <td className="px-5 py-3 text-slate-500">
                      {p.sellPrice > 0 && p.avgCost > 0
                        ? `${Math.round(((p.sellPrice - p.avgCost) / p.sellPrice) * 100)}%`
                        : "—"}
                    </td>
                  )}
                  <td className="w-8 px-3 py-3 text-right text-slate-300">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {/* ============ KIRIM ============ */}
      {tab === "kirim" && (
        <Card>
          <CardHeader
            title={t("Kirimlar (xaridlar)")}
            subtitle={t("Qabul qilinganda zaxira oshadi va tannarx yangilanadi")}
            action={
              canManage ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
                  >
                    <FileSpreadsheet size={15} /> {t("Excel'dan yuklash")}
                  </button>
                  <PrimaryButton
                    onClick={() =>
                      setPurModal({ supplierId: "", note: "", lines: [{ productId: "", qty: "", cost: "" }] })
                    }
                  >
                    <Plus size={15} /> {t("Yangi kirim")}
                  </PrimaryButton>
                </div>
              ) : undefined
            }
          />
          <Table head={[t("Sana"), t("Ta'minotchi"), t("Mahsulotlar"), t("Summa"), t("Qarz"), t("Holat"), ""]}>
            {purchases.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">
                  {t("Hali kirimlar yo'q")}
                </td>
              </tr>
            )}
            {[...purchases].reverse().map((pu) => (
              <tr key={pu.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{pu.createdAt.slice(0, 10)}</td>
                <td className="px-5 py-3">
                  {suppliers.find((s) => s.id === pu.supplierId)?.name ?? "—"}
                </td>
                <td className="max-w-56 px-5 py-3 text-slate-500">
                  <span className="line-clamp-2">
                    {pu.items.map((it) => `${prodName(it.productId)} ×${it.qty}`).join(", ")}
                  </span>
                </td>
                <td className="px-5 py-3 font-semibold">{fmtSum(pu.total)}</td>
                <td className="px-5 py-3">
                  {pu.status === "QABUL_QILINDI" && pu.total - pu.paidAmount > 0 ? (
                    <span className="font-semibold text-rose-600">
                      {fmtSum(pu.total - pu.paidAmount)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      pu.status === "QABUL_QILINDI"
                        ? "bg-emerald-100 text-emerald-700"
                        : pu.status === "QORALAMA"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {pu.status === "QABUL_QILINDI" ? "Qabul qilindi" : pu.status === "QORALAMA" ? "Qoralama" : "Bekor"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {canManage && pu.status === "QORALAMA" && (
                    <button
                      onClick={() =>
                        run("Kirim qabul qilindi — zaxira yangilandi", async () => {
                          const { error } = await sb.rpc("receive_purchase", { p_purchase_id: pu.id });
                          if (error) throw new Error(error.message);
                        })
                      }
                      className="text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      {t("Qabul qilish")}
                    </button>
                  )}
                  {canPay && pu.status === "QABUL_QILINDI" && pu.total - pu.paidAmount > 0 && (
                    <button
                      onClick={() =>
                        setPayModal({
                          purchaseId: pu.id,
                          debt: pu.total - pu.paidAmount,
                          amount: String(pu.total - pu.paidAmount),
                        })
                      }
                      className="ml-3 text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      {t("To'lash")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* ============ HARAKATLAR ============ */}
      {tab === "harakatlar" && (
        <Card>
          <CardHeader title={t("Zaxira harakatlari")} subtitle={t("Oxirgi 1000 ta yozuv")} />
          <Table head={[t("Vaqt"), t("Mahsulot"), t("Amal"), t("O'zgarish"), t("Qoldiq"), t("Kim"), t("Izoh")]}>
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="px-5 py-3 text-xs whitespace-nowrap text-slate-500">
                  {new Date(m.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-5 py-3 font-medium">{prodName(m.productId)}</td>
                <td className="px-5 py-3 text-slate-500">{t(MOVEMENT_LABELS[m.type])}</td>
                <td
                  className={`px-5 py-3 font-semibold ${m.qtyChange > 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {m.qtyChange > 0 ? "+" : ""}
                  {m.qtyChange}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {m.stockBefore} → {m.stockAfter}
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">{m.createdByName}</td>
                <td className="max-w-48 px-5 py-3 text-xs text-slate-400">
                  <span className="line-clamp-1">{m.reason}</span>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* ============ TA'MINOTCHILAR ============ */}
      {tab === "taminotchilar" && (
        <Card>
          <CardHeader
            title={t("Ta'minotchilar")}
            action={
              canManage ? (
                <PrimaryButton
                  onClick={() => setSupModal({ name: "", contactPerson: "", phone: "", active: true })}
                >
                  <Plus size={15} /> {t("Yangi ta'minotchi")}
                </PrimaryButton>
              ) : undefined
            }
          />
          <Table head={[t("Nomi"), t("Kontakt"), t("Telefon"), t("Holat"), ""]}>
            {suppliers.map((s) => (
              <tr key={s.id} className={s.active ? "hover:bg-slate-50" : "text-slate-400"}>
                <td className="px-5 py-3 font-medium">{s.name}</td>
                <td className="px-5 py-3 text-slate-500">{s.contactPerson || "—"}</td>
                <td className="px-5 py-3 text-slate-500">{s.phone || "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.active ? t("Faol") : t("O'chirilgan")}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {canManage && (
                    <button
                      onClick={() =>
                        setSupModal({
                          id: s.id,
                          name: s.name,
                          contactPerson: s.contactPerson,
                          phone: s.phone,
                          active: s.active,
                        })
                      }
                      className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      <Pencil size={13} /> {t("Tahrir")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* ============ MODALLAR ============ */}
      {importOpen && <ImportPurchase onClose={() => setImportOpen(false)} />}

      {prodModal && (
        <Modal
          title={prodModal.id ? t("Mahsulotni tahrirlash") : t("Yangi mahsulot")}
          onClose={() => setProdModal(null)}
          wide
        >
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const m = prodModal;
              run(m.id ? "Mahsulot yangilandi" : "Mahsulot qo'shildi", async () => {
                const row = {
                  name: m.name.trim(),
                  sku: m.sku.trim(),
                  barcode: m.barcode.trim(),
                  category: m.category.trim(),
                  sell_price: Math.max(0, Math.round(Number(m.sellPrice) || 0)),
                  min_stock: Math.max(0, Number(m.minStock) || 0),
                  unit: m.unit,
                  expiry_date: m.expiryDate || null,
                  supplier_id: m.supplierId || null,
                  active: m.active,
                };
                const { error } = m.id
                  ? await sb.from("products").update(row).eq("id", m.id)
                  : await sb.from("products").insert({ ...row, tenant_id: profile!.tenantId });
                if (error)
                  throw new Error(
                    error.message.includes("products_sku_uniq")
                      ? "Bu SKU allaqachon mavjud"
                      : error.message.includes("products_barcode_uniq")
                        ? "Bu shtrix-kod allaqachon mavjud"
                        : error.message,
                  );
                setProdModal(null);
              });
            }}
          >
            <div className="sm:col-span-2">
              <Field label={t("Nomi *")}>
                <input required className={inputCls} value={prodModal.name}
                  onChange={(e) => setProdModal({ ...prodModal, name: e.target.value })} />
              </Field>
            </div>
            <Field label={t("SKU / ichki kod")}>
              <input className={inputCls} value={prodModal.sku}
                onChange={(e) => setProdModal({ ...prodModal, sku: e.target.value })} />
            </Field>
            <Field label={t("Shtrix-kod")}>
              <input className={inputCls} value={prodModal.barcode}
                onChange={(e) => setProdModal({ ...prodModal, barcode: e.target.value })} />
            </Field>
            <Field label={t("Kategoriya")}>
              <input list="prod-cats" className={inputCls} value={prodModal.category}
                onChange={(e) => setProdModal({ ...prodModal, category: e.target.value })} />
              <datalist id="prod-cats">
                {[...new Set(products.map((p) => p.category).filter(Boolean))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label={t("O'lchov birligi")}>
              <select className={inputCls} value={prodModal.unit}
                onChange={(e) => setProdModal({ ...prodModal, unit: e.target.value })}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>
            <Field label={t("Sotuv narxi (so'm) *")}>
              <input required inputMode="numeric" className={inputCls} value={prodModal.sellPrice}
                onChange={(e) => setProdModal({ ...prodModal, sellPrice: e.target.value })} />
            </Field>
            <Field label={t("Minimal zaxira (ogohlantirish)")}>
              <input inputMode="numeric" className={inputCls} value={prodModal.minStock}
                onChange={(e) => setProdModal({ ...prodModal, minStock: e.target.value })} />
            </Field>
            <Field label={t("Yaroqlilik muddati")}>
              <input type="date" className={inputCls} value={prodModal.expiryDate}
                onChange={(e) => setProdModal({ ...prodModal, expiryDate: e.target.value })} />
            </Field>
            <Field label={t("Ta'minotchi")}>
              <select className={inputCls} value={prodModal.supplierId}
                onChange={(e) => setProdModal({ ...prodModal, supplierId: e.target.value })}>
                <option value="">—</option>
                {suppliers.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={prodModal.active}
                onChange={(e) => setProdModal({ ...prodModal, active: e.target.checked })}
                className="h-4 w-4 accent-teal-600" />
              {t("Faol (POS'da sotiladi)")}
            </label>
            <p className="text-xs text-slate-400 sm:col-span-2">
              {t("Zaxira miqdori bu yerda o'zgartirilmaydi — «Zaxira» tugmasi (tuzatish)")}
              {t("yoki Kirim orqali kiritiladi, har o'zgarish tarixda qoladi.")}
            </p>
            <div className="sm:col-span-2">
              <PrimaryButton type="submit" className="w-full justify-center">
                {busy ? t("Saqlanmoqda...") : t("Saqlash")}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {cardId && (
        <ProductCard
          productId={cardId}
          onClose={() => setCardId(null)}
          canManage={!!canManage}
          canSeeCost={!!canSeeCost}
        />
      )}

      {supModal && (
        <Modal
          title={supModal.id ? t("Ta'minotchini tahrirlash") : t("Yangi ta'minotchi")}
          onClose={() => setSupModal(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = supModal;
              run(m.id ? "Ta'minotchi yangilandi" : "Ta'minotchi qo'shildi", async () => {
                const row = {
                  name: m.name.trim(),
                  contact_person: m.contactPerson.trim(),
                  phone: m.phone.trim(),
                  active: m.active,
                };
                const { error } = m.id
                  ? await sb.from("suppliers").update(row).eq("id", m.id)
                  : await sb.from("suppliers").insert({ ...row, tenant_id: profile!.tenantId });
                if (error) throw new Error(error.message);
                setSupModal(null);
              });
            }}
          >
            <Field label={t("Nomi *")}>
              <input required className={inputCls} value={supModal.name}
                onChange={(e) => setSupModal({ ...supModal, name: e.target.value })} />
            </Field>
            <Field label={t("Kontakt shaxs")}>
              <input className={inputCls} value={supModal.contactPerson}
                onChange={(e) => setSupModal({ ...supModal, contactPerson: e.target.value })} />
            </Field>
            <Field label={t("Telefon")}>
              <input className={inputCls} value={supModal.phone}
                onChange={(e) => setSupModal({ ...supModal, phone: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={supModal.active}
                onChange={(e) => setSupModal({ ...supModal, active: e.target.checked })}
                className="h-4 w-4 accent-teal-600" />
              {t("Faol")}
            </label>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("Saqlash")}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {payModal && (
        <Modal title={t("Ta'minotchiga to'lov")} onClose={() => setPayModal(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = payModal;
              run("To'lov qayd etildi", async () => {
                const { error } = await sb.rpc("pay_supplier", {
                  p_purchase_id: m.purchaseId,
                  p_amount: Math.round(Number(m.amount) || 0),
                });
                if (error) throw new Error(error.message);
                setPayModal(null);
              });
            }}
          >
            <p className="text-sm text-slate-600">
              Qolgan qarz: <b className="text-rose-600">{fmtSum(payModal.debt)}</b>
            </p>
            <Field label={t("To'lov summasi (so'm) *")}>
              <input required inputMode="numeric" autoFocus className={inputCls}
                value={payModal.amount}
                onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })} />
            </Field>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("To'lovni qayd etish")}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {purModal && (
        <Modal title={t("Yangi kirim")} onClose={() => setPurModal(null)} wide>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = purModal;
              run("Kirim qabul qilindi — zaxira va tannarx yangilandi", async () => {
                const items = m.lines
                  .filter((l) => l.productId && Number(l.qty) > 0)
                  .map((l) => ({
                    id: l.productId,
                    qty: Number(l.qty.replace(",", ".")),
                    cost: Math.max(0, Math.round(Number(l.cost) || 0)),
                  }));
                if (items.length === 0) throw new Error("Kamida bitta mahsulot kiriting");
                const { error } = await sb.rpc("create_purchase", {
                  p_supplier_id: m.supplierId || null,
                  p_items: items,
                  p_note: m.note.trim(),
                  p_receive_now: true,
                });
                if (error) throw new Error(error.message);
                setPurModal(null);
              });
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Ta'minotchi")}>
                <select className={inputCls} value={purModal.supplierId}
                  onChange={(e) => setPurModal({ ...purModal, supplierId: e.target.value })}>
                  <option value="">—</option>
                  {suppliers.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("Izoh")}>
                <input className={inputCls} value={purModal.note}
                  onChange={(e) => setPurModal({ ...purModal, note: e.target.value })} />
              </Field>
            </div>
            <div className="space-y-2">
              {purModal.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_120px_32px] items-center gap-2">
                  <select
                    className={inputCls}
                    value={l.productId}
                    onChange={(e) => {
                      const lines = [...purModal.lines];
                      lines[i] = { ...l, productId: e.target.value };
                      setPurModal({ ...purModal, lines });
                    }}
                  >
                    <option value="">{t("Mahsulot...")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input placeholder={t("Miqdor")} inputMode="decimal" className={inputCls} value={l.qty}
                    onChange={(e) => {
                      const lines = [...purModal.lines];
                      lines[i] = { ...l, qty: e.target.value };
                      setPurModal({ ...purModal, lines });
                    }} />
                  <input placeholder={t("Kirim narxi")} inputMode="numeric" className={inputCls} value={l.cost}
                    onChange={(e) => {
                      const lines = [...purModal.lines];
                      lines[i] = { ...l, cost: e.target.value };
                      setPurModal({ ...purModal, lines });
                    }} />
                  <button type="button"
                    onClick={() =>
                      setPurModal({ ...purModal, lines: purModal.lines.filter((_, j) => j !== i) })
                    }
                    className="rounded p-1 text-slate-300 hover:text-rose-500">
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setPurModal({
                    ...purModal,
                    lines: [...purModal.lines, { productId: "", qty: "", cost: "" }],
                  })
                }
                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
              >
                <Plus size={14} /> {t("Qator qo'shish")}
              </button>
            </div>
            <p className="text-sm font-semibold">
              Jami:{" "}
              {fmtSum(
                purModal.lines.reduce(
                  (s, l) => s + (Number(l.qty.replace(",", ".")) || 0) * (Number(l.cost) || 0),
                  0,
                ),
              )}
            </p>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("Kirimni qabul qilish")}
            </PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
