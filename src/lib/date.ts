// Sana formatlash — joriy interfeys tiliga mos
import { getLang } from "./i18n";

export const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
export const UZ_WEEKDAYS = [
  "yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba",
];

const RU_MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const RU_WEEKDAYS = [
  "воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота",
];
const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const EN_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// "2026-10-08" -> tilga mos: "2026-yil 8-oktabr" / "8 октября 2026" / "October 8, 2026"
export function formatUzDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const lang = getLang();
  if (lang === "ru") return `${d} ${RU_MONTHS[m - 1]} ${y}`;
  if (lang === "en") return `${EN_MONTHS[m - 1]} ${d}, ${y}`;
  return `${y}-yil ${d}-${UZ_MONTHS[m - 1]}`;
}

// Bugungi sana to'liq (haftaning kuni bilan)
export function todayUzFull(): string {
  const now = new Date();
  const lang = getLang();
  if (lang === "ru")
    return `${now.getDate()} ${RU_MONTHS[now.getMonth()]} ${now.getFullYear()}, ${RU_WEEKDAYS[now.getDay()]}`;
  if (lang === "en")
    return `${EN_WEEKDAYS[now.getDay()]}, ${EN_MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  return `${now.getFullYear()}-yil ${now.getDate()}-${UZ_MONTHS[now.getMonth()]}, ${UZ_WEEKDAYS[now.getDay()]}`;
}

// Qisqa: "8-okt" / "8 окт" / "Oct 8" (grafik o'qlari uchun)
export function shortUzDate(d: Date): string {
  const lang = getLang();
  if (lang === "ru") return `${d.getDate()} ${RU_MONTHS[d.getMonth()].slice(0, 3)}`;
  if (lang === "en") return `${EN_MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Toshkent bo'yicha bugungi sana (UTC+5, O'zbekistonda DST yo'q).
// Epoch vaqtdan hisoblanadi — kompyuter boshqa mintaqaga sozlangan bo'lsa ham to'g'ri.
export function tashkentToday(): string {
  const t = new Date(Date.now() + 5 * 3600 * 1000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
