// Excel/CSV kirim hujjatini o'qish: sarlavha qatorini topish, ustunlarni
// avtomatik tanish (RU/UZ/EN), qatorlarni import elementlariga aylantirish.
// Bu modul sof funksiyalardan iborat — UI'dan mustaqil.

export type ImportField =
  | "name"
  | "qty"
  | "cost"
  | "price"
  | "expiry"
  | "manufacturer"
  | "country"
  | "category"
  | "unit"
  | "sku"
  | "barcode";

export const FIELD_ORDER: ImportField[] = [
  "name",
  "qty",
  "cost",
  "price",
  "expiry",
  "category",
  "unit",
  "manufacturer",
  "country",
  "sku",
  "barcode",
];

export const REQUIRED_FIELDS: ImportField[] = ["name", "qty", "cost"];

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Mahsulot nomi",
  qty: "Miqdor",
  cost: "Kirim narxi",
  price: "Sotuv narxi",
  expiry: "Yaroqlilik muddati",
  category: "Kategoriya",
  unit: "O'lchov birligi",
  manufacturer: "Ishlab chiqaruvchi",
  country: "Mamlakat",
  sku: "SKU / ichki kod",
  barcode: "Shtrix-kod",
};

// Sarlavha sinonimlari (kichik harflarda). Tartib muhim: aniqroq iboralar oldinda.
const SYNONYMS: Record<ImportField, string[]> = {
  name: ["наименование", "название", "номенклатура", "препарат", "товар", "mahsulot", "nomlanish", "nomi", "product", "item", "name"],
  qty: ["кол-во", "количество", "колич", "кол.", "miqdor", "soni", "quantity", "qty", "count"],
  cost: ["покупная цена", "цена закупки", "закупочная цена", "цена прихода", "приходная цена", "покупная", "закупочная", "закуп", "kirim narxi", "xarid narxi", "tannarx", "purchase price", "buy price", "cost"],
  price: ["розничная цена", "цена продажи", "продажная цена", "розничная", "розн", "sotuv narxi", "chakana narx", "retail price", "sell price", "sale price", "retail"],
  expiry: ["срок год", "годен до", "годность", "yaroqlilik", "muddati", "expiry", "exp. date", "exp date", "best before"],
  manufacturer: ["производитель", "изготовитель", "ishlab chiqaruvchi", "manufacturer", "producer", "brand"],
  country: ["страна", "mamlakat", "davlat", "country"],
  category: ["форма выпуска", "категория", "группа", "kategoriya", "guruh", "category", "group"],
  unit: ["ед. изм", "ед.изм", "единица", "birlik", "uom", "unit"],
  sku: ["артикул", "код товара", "sku", "kod", "code"],
  barcode: ["штрих", "barcode", "bar code", "shtrix", "ean"],
};

// Bu so'zlar bo'lgan ustunlar narx/miqdor emas (jami summalar)
const SUM_WORDS = ["сумма", "итого", "всего", "summa", "jami", "total", "ндс", "наценка", "реф"];

export interface ParsedSheet {
  rows: unknown[][];
  sheetName: string;
}

export type Mapping = Record<ImportField, number | null>;

export interface ImportItem {
  name: string;
  qty: number;
  cost: number;
  price: number | null;
  expiry: string | null; // YYYY-MM-DD
  category: string;
  unit: string;
  description: string;
  sku: string;
  barcode: string;
}

export interface SkippedRow {
  row: number; // fayldagi qator raqami (1 dan)
  name: string;
  reason: string;
}

const norm = (v: unknown): string =>
  String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const normName = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

// Bitta sarlavha qatori uchun ustunlarni maydonlarga moslash
export function detectMapping(header: unknown[]): Mapping {
  const mapping = Object.fromEntries(FIELD_ORDER.map((f) => [f, null])) as Mapping;
  const used = new Set<number>();
  const cells = header.map(norm);

  // Aniq maydonlar avval: shtrix-kod "код"ni sku'dan oldin egallab olsin
  const order: ImportField[] = [
    "barcode", "cost", "price", "expiry", "qty", "name",
    "manufacturer", "country", "category", "unit", "sku",
  ];
  for (const field of order) {
    for (const syn of SYNONYMS[field]) {
      const idx = cells.findIndex((c, i) => {
        if (!c || used.has(i)) return false;
        if (!c.includes(syn)) return false;
        if (["cost", "price", "qty"].includes(field) && SUM_WORDS.some((w) => c.includes(w)))
          return false;
        // "Unit price" kabi narx ustunlari birlik deb olinmasin
        if (field === "unit" && /price|цена|narx/.test(c)) return false;
        return true;
      });
      if (idx >= 0) {
        mapping[field] = idx;
        used.add(idx);
        break;
      }
    }
  }
  // Faqat oddiy "Цена/Narx/Price" ustuni bo'lsa — kirim hujjatida bu kirim narxi
  if (mapping.cost === null) {
    const idx = cells.findIndex(
      (c, i) => !used.has(i) && ["цена", "narx", "narxi", "price"].includes(c),
    );
    if (idx >= 0) {
      mapping.cost = idx;
      used.add(idx);
    }
  }
  return mapping;
}

const mappedCount = (m: Mapping) => FIELD_ORDER.filter((f) => m[f] !== null).length;

// Birinchi 40 qator ichidan eng ko'p ustun tanilgan qatorni sarlavha deb olamiz
export function detectHeaderRow(rows: unknown[][]): { index: number; mapping: Mapping } | null {
  let best: { index: number; mapping: Mapping } | null = null;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const m = detectMapping(rows[i] ?? []);
    if (m.name === null) continue;
    if (mappedCount(m) < 2) continue;
    if (!best || mappedCount(m) > mappedCount(best.mapping)) best = { index: i, mapping: m };
  }
  return best;
}

// Sarlavhadan yuqoridagi hujjat ma'lumotlari: raqam va ta'minotchi
export function extractDocInfo(rows: unknown[][], headerIndex: number): { ref: string; supplier: string } {
  let ref = "";
  let supplier = "";
  for (let i = 0; i < headerIndex; i++) {
    const row = (rows[i] ?? []).map((c) => String(c ?? "").trim());
    const nonEmpty = row.filter(Boolean);
    if (nonEmpty.length === 0) continue;
    const label = nonEmpty[0].toLowerCase();
    const value = nonEmpty.slice(1).join(" ").trim();
    if (!ref && /поступлени|приход|накладн|kirim|invoice|документ/.test(label)) {
      ref = [nonEmpty[0], value].filter(Boolean).join(" ").trim();
    }
    if (!supplier && /поставщик|ta.?minotchi|supplier|vendor/.test(label) && value) {
      supplier = value;
    }
  }
  return { ref, supplier };
}

// "75 000", "75,000.50", "75000,5" va oddiy sonlarni o'qish
export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[\s ']/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isoOf = (y: number, m: number, d: number): string | null => {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

// Excel sana raqami (45931), "01.09.2025", "2025-09-01", "09/2025"
export function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime()))
    return isoOf(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === "number" || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
    const serial = Math.floor(Number(v));
    if (serial < 20000 || serial > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return isoOf(y, Number(m[2]), Number(m[1]));
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoOf(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[./](\d{4})$/); // oy/yil — oyning oxirgi kuni
  if (m) {
    const y = Number(m[2]);
    const mo = Number(m[1]);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return isoOf(y, mo, last);
  }
  return null;
}

function normUnit(raw: string, category: string): string {
  const s = raw.toLowerCase().trim();
  if (s) {
    if (/^(шт|штук|dona|pcs|piece)/.test(s)) return "dona";
    if (/^(уп|упак|pack|qadoq)/.test(s)) return "upakovka";
    if (/^(фл|флакон|flakon)/.test(s)) return "flakon";
    if (/^(кор|коробк|quti|box)/.test(s)) return "quti";
    if (/^(мл|ml)$/.test(s)) return "ml";
    if (/^(г|гр|gr|g)$/.test(s)) return "gr";
    if (/^(кг|kg)$/.test(s)) return "kg";
    if (/^(л|литр|litr|l)$/.test(s)) return "litr";
    return s;
  }
  // Birlik ustuni yo'q: dori shakli berilgan bo'lsa — upakovka, "штука" — dona
  const c = category.toLowerCase();
  if (!c) return "dona";
  return /штук|шт\.?$|dona/.test(c) ? "dona" : "upakovka";
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function buildItems(
  rows: unknown[][],
  headerIndex: number,
  mapping: Mapping,
): { items: ImportItem[]; skipped: SkippedRow[] } {
  const items: ImportItem[] = [];
  const skipped: SkippedRow[] = [];
  const cell = (row: unknown[], f: ImportField) =>
    mapping[f] === null ? null : (row[mapping[f] as number] ?? null);
  const text = (row: unknown[], f: ImportField) => String(cell(row, f) ?? "").trim();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const name = text(row, "name").replace(/\s+/g, " ");
    if (!name) continue; // bo'sh yoki jami qatori — jimgina o'tkaziladi
    if (/^(итого|всего|jami|total)\b/i.test(name)) continue;

    const qtyRaw = parseNum(cell(row, "qty"));
    const qty = qtyRaw === null ? null : Math.round(qtyRaw * 1000) / 1000;
    const cost = parseNum(cell(row, "cost"));
    if (qty === null || qty <= 0) {
      skipped.push({ row: i + 1, name, reason: "Miqdor yo'q yoki noto'g'ri" });
      continue;
    }
    if (cost === null || cost < 0) {
      skipped.push({ row: i + 1, name, reason: "Kirim narxi yo'q yoki noto'g'ri" });
      continue;
    }
    const price = parseNum(cell(row, "price"));
    const category = cap(text(row, "category"));
    const description = [text(row, "manufacturer"), text(row, "country")]
      .filter(Boolean)
      .join(", ");
    items.push({
      name,
      qty,
      cost: Math.round(cost),
      price: price !== null && price > 0 ? Math.round(price) : null,
      expiry: parseDate(cell(row, "expiry")),
      category,
      unit: normUnit(text(row, "unit"), category),
      description,
      sku: text(row, "sku"),
      barcode: text(row, "barcode").replace(/\s/g, ""),
    });
  }
  return { items, skipped };
}

// Fayl tarkibidan qisqa xesh — hujjat raqami bo'lmasa takroriy importni ushlash uchun
export async function fileFingerprint(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Faylni o'qish (kutubxona faqat kerak bo'lganda yuklanadi)
export async function readSheets(buf: ArrayBuffer): Promise<ParsedSheet[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    // Ko'p dasturlar (1C, apteka tizimlari) varaq o'lchamini noto'g'ri yozadi —
    // haqiqiy diapazonni mavjud hujayralardan qayta hisoblaymiz
    let maxR = -1;
    let maxC = -1;
    for (const key of Object.keys(ws)) {
      if (key.startsWith("!")) continue;
      const a = XLSX.utils.decode_cell(key);
      if (a.r > maxR) maxR = a.r;
      if (a.c > maxC) maxC = a.c;
    }
    if (maxR >= 0) {
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    }
    return {
      sheetName,
      rows: XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      }),
    };
  });
}
