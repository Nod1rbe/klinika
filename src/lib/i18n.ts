// Yengil lokalizatsiya: o'zbekcha matn — kalit. Tarjima topilmasa o'zbekcha
// qaytadi (hech qachon bo'sh chiqmaydi). Lug'atlar shu fayl oxirida.
export type Lang = "uz" | "ru" | "en";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "uz", label: "UZ" },
  { code: "ru", label: "РУ" },
  { code: "en", label: "EN" },
];

let current: Lang = "uz";
try {
  const saved = localStorage.getItem("klinika_lang");
  if (saved === "uz" || saved === "ru" || saved === "en") current = saved;
} catch {
  /* private rejim va h.k. */
}

export function getLang(): Lang {
  return current;
}

export function setCurrentLang(l: Lang): void {
  current = l;
  try {
    localStorage.setItem("klinika_lang", l);
  } catch {
    /* saqlanmasa ham ishlayveradi */
  }
}

export function t(s: string): string {
  if (current === "uz") return s;
  const dict = current === "ru" ? RU : EN;
  return dict[s] ?? s;
}

// Lug'atlar alohida faylda (katta bo'lgani uchun)
import { RU, EN } from "./translations";
