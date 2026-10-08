// O'zbekcha sana formatlash yordamchilari
export const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

export const UZ_WEEKDAYS = [
  "yakshanba",
  "dushanba",
  "seshanba",
  "chorshanba",
  "payshanba",
  "juma",
  "shanba",
];

// "2026-07-23" -> "2026-yil 23-iyul"
export function formatUzDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${y}-yil ${d}-${UZ_MONTHS[m - 1]}`;
}

// Bugungi sana to'liq: "2026-yil 23-iyul, payshanba"
export function todayUzFull(): string {
  const now = new Date();
  return `${now.getFullYear()}-yil ${now.getDate()}-${UZ_MONTHS[now.getMonth()]}, ${UZ_WEEKDAYS[now.getDay()]}`;
}

// "23-iyul" (grafik o'qlari uchun)
export function shortUzDate(d: Date): string {
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
