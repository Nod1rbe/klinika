import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Field, inputCls, Modal, PrimaryButton } from "./ui";
import { fmtSum } from "../data/mock";
import {
  buildItems,
  detectHeaderRow,
  extractDocInfo,
  FIELD_LABELS,
  FIELD_ORDER,
  fileFingerprint,
  type Mapping,
  normName,
  readSheets,
  REQUIRED_FIELDS,
} from "../lib/excelImport";
import { t } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useStore } from "../store";

interface Loaded {
  fileName: string;
  rows: unknown[][];
  headerIndex: number;
  fingerprint: string;
}

const PREVIEW_LIMIT = 60;

export default function ImportPurchase({ onClose }: { onClose: () => void }) {
  const { products, suppliers, retryLoad, notify } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [docRef, setDocRef] = useState("");
  const [supplier, setSupplier] = useState("");
  const [updatePrices, setUpdatePrices] = useState(true);
  const [paid, setPaid] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function loadFile(file: File) {
    setErr(null);
    setReading(true);
    try {
      const buf = await file.arrayBuffer();
      const sheets = await readSheets(buf);
      // Sarlavhasi tanilgan birinchi varaq olinadi
      for (const s of sheets) {
        const h = detectHeaderRow(s.rows);
        if (h) {
          const doc = extractDocInfo(s.rows, h.index);
          setLoaded({
            fileName: file.name,
            rows: s.rows,
            headerIndex: h.index,
            fingerprint: await fileFingerprint(buf),
          });
          setMapping(h.mapping);
          setDocRef(doc.ref);
          setSupplier(doc.supplier);
          return;
        }
      }
      setErr(
        "Faylda mahsulotlar jadvali topilmadi. Jadvalda kamida «Nomi» va «Miqdor» yoki «Narx» sarlavhali ustunlar bo'lishi kerak.",
      );
    } catch (e) {
      setErr(
        `${t("Faylni o'qib bo'lmadi")}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setReading(false);
    }
  }

  const header = loaded ? (loaded.rows[loaded.headerIndex] ?? []) : [];
  const colOptions = header
    .map((h, i) => ({ i, label: String(h ?? "").trim() }))
    .filter((o) => o.label);

  const built = useMemo(() => {
    if (!loaded || !mapping) return null;
    return buildItems(loaded.rows, loaded.headerIndex, mapping);
  }, [loaded, mapping]);

  const existing = useMemo(() => {
    const byName = new Set(products.map((p) => normName(p.name)));
    const bySku = new Set(products.map((p) => p.sku).filter(Boolean));
    const byBarcode = new Set(products.map((p) => p.barcode).filter(Boolean));
    return (it: { name: string; sku: string; barcode: string }) =>
      (it.barcode && byBarcode.has(it.barcode)) ||
      (it.sku && bySku.has(it.sku)) ||
      byName.has(normName(it.name));
  }, [products]);

  const missingRequired = mapping
    ? REQUIRED_FIELDS.filter((f) => mapping[f] === null)
    : [];
  const items = built?.items ?? [];
  const skipped = built?.skipped ?? [];
  // Bir faylda takrorlangan nomlar bitta mahsulotga birlashadi
  const uniqueNames = new Set(items.map((i) => normName(i.name)));
  const newCount = [...uniqueNames].filter(
    (n) => !existing({ name: n, sku: "", barcode: "" }),
  ).length;
  const total = items.reduce((a, i) => a + Math.round(i.qty * i.cost), 0);

  async function doImport() {
    if (!supabase || !loaded || busy) return;
    if (missingRequired.length > 0) return;
    if (items.length === 0) return setErr(t("Import qilinadigan qator yo'q"));
    setErr(null);
    setBusy(true);
    try {
      const ref = docRef.trim() || `${t("Fayl")}: ${loaded.fileName} #${loaded.fingerprint}`;
      const { data, error } = await supabase.rpc("import_purchase", {
        p_supplier_name: supplier.trim() || null,
        p_ref: ref,
        p_note: `${t("Excel import")}: ${loaded.fileName}`,
        p_items: items,
        p_update_prices: updatePrices,
        p_paid: paid,
      });
      if (error) throw new Error(error.message);
      notify(
        `${t("Import tugadi")}: ${data.lines} ${t("qator")} · ${data.created} ${t("yangi mahsulot")} · ${fmtSum(data.total)}`,
      );
      retryLoad();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t("Excel'dan kirim yuklash")} onClose={onClose} xl>
      {!loaded ? (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) loadFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
              dragOver
                ? "border-teal-500 bg-teal-50"
                : "border-slate-300 hover:border-teal-400 hover:bg-slate-50"
            }`}
          >
            {reading ? (
              <Loader2 size={36} className="animate-spin text-teal-600" />
            ) : (
              <FileSpreadsheet size={40} className="text-teal-600" />
            )}
            <p className="font-semibold">
              {reading ? t("Fayl o'qilmoqda...") : t("Excel faylni shu yerga tashlang yoki bosib tanlang")}
            </p>
            <p className="text-sm text-slate-500">
              {t(".xlsx, .xls yoki .csv — ta'minotchi yoki apteka dasturidan kelgan «Поступление» fayli")}
            </p>
            <input
              ref={fileRef}
              id="import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-700">{t("Qanday ishlaydi")}</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              <li>{t("Tizim sarlavhalarni o'zi taniydi (Наименование, Кол-во, Покупная цена, Розничная цена, Срок годности...) — qo'lda belgi qo'yish shart emas")}</li>
              <li>{t("Mavjud mahsulot nomi bo'yicha topiladi va zaxirasi oshadi, yangisi avtomatik yaratiladi")}</li>
              <li>{t("Bitta hujjatni ikki marta yuklab bo'lmaydi")}</li>
            </ul>
          </div>
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t(err)}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
              <FileSpreadsheet size={16} className="text-teal-600" /> {loaded.fileName}
            </span>
            <button
              onClick={() => {
                setLoaded(null);
                setMapping(null);
                setErr(null);
              }}
              className="font-medium text-teal-600 hover:text-teal-700"
            >
              {t("Boshqa fayl tanlash")}
            </button>
          </div>

          {/* Hujjat ma'lumotlari */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("Hujjat raqami (takroriy importdan himoya)")}>
              <input
                id="import-ref"
                className={inputCls}
                value={docRef}
                onChange={(e) => setDocRef(e.target.value)}
                placeholder={t("Bo'sh qolsa fayl belgisi ishlatiladi")}
              />
            </Field>
            <Field label={t("Ta'minotchi")}>
              <input
                id="import-supplier"
                list="import-suppliers"
                className={inputCls}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder={t("Tanlang yoki yangi nom yozing")}
              />
              <datalist id="import-suppliers">
                {suppliers.filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </Field>
          </div>

          {/* Ustunlarni moslash */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              {t("Ustunlar")}{" "}
              <span className="font-normal text-slate-400">
                — {t("avtomatik aniqlandi, kerak bo'lsa o'zgartiring")}
              </span>
            </p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {FIELD_ORDER.map((f) => {
                const req = REQUIRED_FIELDS.includes(f);
                const missing = req && mapping?.[f] === null;
                return (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <span className={`w-36 shrink-0 ${missing ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                      {t(FIELD_LABELS[f])}
                      {req && " *"}
                    </span>
                    <select
                      id={`map-${f}`}
                      value={mapping?.[f] ?? ""}
                      onChange={(e) =>
                        setMapping((m) =>
                          m ? { ...m, [f]: e.target.value === "" ? null : Number(e.target.value) } : m,
                        )
                      }
                      className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm ${
                        missing
                          ? "border-rose-300 bg-rose-50"
                          : mapping?.[f] !== null
                            ? "border-teal-300 bg-teal-50/50"
                            : "border-slate-200"
                      }`}
                    >
                      <option value="">— {t("ishlatilmaydi")} —</option>
                      {colOptions.map((o) => (
                        <option key={o.i} value={o.i}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Xulosa */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{t("Import qilinadi")}</p>
              <p className="text-xl font-bold">{items.length} {t("qator")}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{t("Yangi mahsulotlar")}</p>
              <p className="text-xl font-bold text-teal-700">{newCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{t("Mavjudlari yangilanadi")}</p>
              <p className="text-xl font-bold">{uniqueNames.size - newCount}</p>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
              <p className="text-xs text-teal-800">{t("Kirim summasi")}</p>
              <p className="text-xl font-bold text-teal-700">{fmtSum(total)}</p>
            </div>
          </div>

          {skipped.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <button className="font-semibold" onClick={() => setShowSkipped((v) => !v)}>
                {skipped.length} {t("qator o'tkazib yuboriladi")} {showSkipped ? "▲" : "▼"}
              </button>
              {showSkipped && (
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {skipped.map((s, i) => (
                    <li key={i}>
                      {s.row}-{t("qator")}: «{s.name}» — {t(s.reason)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Ko'rib chiqish jadvali */}
          {missingRequired.length === 0 && items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-semibold">{t("Holat")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Mahsulot")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Miqdor")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Kirim narxi")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Sotuv narxi")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Muddati")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.slice(0, PREVIEW_LIMIT).map((it, i) => {
                    const ex = existing(it);
                    return (
                      <tr key={i}>
                        <td className="px-3 py-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                              ex ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {ex ? t("Mavjud") : t("Yangi")}
                          </span>
                        </td>
                        <td className="max-w-72 px-3 py-1.5">
                          <span className="line-clamp-1">{it.name}</span>
                          {it.description && (
                            <span className="line-clamp-1 text-xs text-slate-400">{it.description}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {it.qty} {it.unit}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">{fmtSum(it.cost)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {it.price ? fmtSum(it.price) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">{it.expiry ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length > PREVIEW_LIMIT && (
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
                  {t("va yana")} {items.length - PREVIEW_LIMIT} {t("qator")}...
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                id="import-update-prices"
                type="checkbox"
                checked={updatePrices}
                onChange={(e) => setUpdatePrices(e.target.checked)}
                className="h-4 w-4 accent-teal-600"
              />
              {t("Mavjud mahsulotlarning sotuv narxini fayldagi narx bilan yangilash")}
            </label>
            <label className="flex items-center gap-2">
              <input
                id="import-paid"
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="h-4 w-4 accent-teal-600"
              />
              {t("Ta'minotchiga to'langan (qarz yozilmasin)")}
            </label>
          </div>

          {missingRequired.length > 0 && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {t("Majburiy ustunlarni tanlang")}: {missingRequired.map((f) => t(FIELD_LABELS[f])).join(", ")}
            </p>
          )}
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{t(err)}</p>}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              {t("Bekor qilish")}
            </button>
            <PrimaryButton
              onClick={doImport}
              className={
                busy || missingRequired.length > 0 || items.length === 0
                  ? "pointer-events-none opacity-60"
                  : ""
              }
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {busy ? t("Yuklanmoqda...") : `${t("Import qilish")} (${items.length})`}
            </PrimaryButton>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <CheckCircle2 size={13} />
            {t("Import bitta amal bo'lib bajariladi: xato bo'lsa hech narsa o'zgarmaydi")}
          </p>
        </div>
      )}
    </Modal>
  );
}
