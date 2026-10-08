# KlinikaHMS — Klinika boshqaruv tizimi

Texnik spetsifikatsiyaning 1-bosqichi (MVP) bo'yicha qurilgan tizim.
Backend — **Supabase** (PostgreSQL + RLS). Supabase ulanmagan bo'lsa ilova
avtomatik demo (mock) rejimda ishlaydi — yuqori o'ng burchakdagi belgi manbani ko'rsatadi.

## Ishga tushirish

```bash
npm install
npm run dev        # http://localhost:5173
```

## Supabase'ni ulash

1. [supabase.com](https://supabase.com) da yangi loyiha yarating (region: Central EU yaqinroq).
2. Dashboard > **SQL Editor** ga [supabase/migrations/20260719000000_init.sql](supabase/migrations/20260719000000_init.sql)
   faylining to'liq matnini joylashtirib **Run** bosing — jadvallar, RLS va namunaviy ma'lumotlar yaratiladi.
3. Dashboard > **Project Settings > API** dan `Project URL` va `anon public` kalitni oling.
4. `.env.example` ni `.env` nomi bilan nusxalab, ikkala qiymatni to'ldiring.
5. Dev serverni qayta ishga tushiring — headerda yashil «Supabase» belgisi chiqadi.

## Autentifikatsiya

Supabase Auth (email/parol). Rol har foydalanuvchining `profiles` yozuvida saqlanadi
va interfeys shunga qarab quriladi. RLS: ma'lumotlarga faqat tizimga kirganlar kiradi
([supabase/migrations/20260719000001_auth.sql](supabase/migrations/20260719000001_auth.sql)).

Hisoblar: direktor@, registratura@, shifokor@, hisobchi@, laborant@klinika.uz.
**Parollar `HISOBLAR.md` faylida** (faqat shu kompyuterda, repo'ga kirmaydi) —
har xodimga o'z parolini alohida bering. Test skriptlari parolni env orqali oladi:
`$env:KLINIKA_PASS_DIREKTOR = "..."` va h.k.

## Granulyar RLS (DB darajasidagi huquqlar)

[supabase/migrations/20260719000002_granular_rls.sql](supabase/migrations/20260719000002_granular_rls.sql):

- **Shifokor** — faqat o'z (`profiles.doctor_id`) va faqat to'langan (`status >= TOLANDI`)
  qabullarini ko'radi/yangilaydi. Asosiy biznes-qoida (TZ 3-bo'lim) endi DB darajasida —
  frontend chetlab o'tilsa ham ishlaydi.
- **Laborant** — qabullar/tashxis tarixi va xodimlar unga umuman qaytarilmaydi, faqat `lab_orders`.
- **Registratura** — bemor va qabul yaratadi/tahrirlaydi, to'lov qabul qiladi; tahlil natijasiga tegolmaydi.
- **Hisobchi** — qabullar/to'lovlar/xodimlarni o'qiydi va to'lov holatini yangilaydi.
- **Direktor** — hammasiga to'liq huquq; ma'lumotnomalarni (narxnoma, shifokorlar) faqat u o'zgartiradi.

Tekshirish: `node scripts/test-rls.mjs` — har rol bilan real login qilib, 11 ta qoidani sinaydi.

## Audit log (TZ 2.9)

[supabase/migrations/20260719000003_audit_log.sql](supabase/migrations/20260719000003_audit_log.sql):

- **O'zgarishlar** (`patients`, `appointments`, `lab_orders`, `services`) — DB triggerlari
  orqali avtomatik qayd etiladi (kim, qachon, old/new qiymatlar bilan). Frontend chetlab
  o'tilsa ham yoziladi.
- **Ko'rishlar** — bemor kartasi ochilganda `log_view()` RPC chaqiriladi.
- Jurnal **o'zgarmas**: hech qanday rolda (direktor ham) update/delete huquqi yo'q.
- Saytda: «Audit jurnal» sahifasi — faqat direktorga ko'rinadi (RLS ham shuni ta'minlaydi).

Tekshirish: `node scripts/test-audit.mjs` — 6 ta qoidani sinaydi.

Keyingi qadam: 2FA (direktor/admin uchun, TZ 6.6).

## Chek chiqarish va XPrinter ulash

Registratsiya/Kassada to'lov qabul qilinganda 58mm termal chek avtomatik ochiladi:
navbat raqami (katta), bemor, shifokor, xizmatlar ro'yxati, jami summa va klinika
lokatsiyasi QR-kodi. Klinika rekvizitlari [src/lib/config.ts](src/lib/config.ts) da —
manzil, telefon va Google Maps havolasini haqiqiysiga almashtiring.

**XPrinter (XP-58 va sh.k.) ulash:**

1. Printerni USB orqali ulang va XPrinter drayverini o'rnating
   ([xprinter.net](https://www.xprinter.net) → Download → o'z modelingiz).
2. Windows: **Settings → Bluetooth & devices → Printers** da printer paydo bo'ladi.
   Uni **default printer** qilib belgilang.
3. Printer Properties → Paper size: **58(48) x 210mm** (yoki 80mm model uchun mos o'lcham).
4. Saytda chek oynasi ochilganda Chrome print dialogida: Destination = XPrinter,
   Margins = **None**, Scale = 100, "Headers and footers" = o'chiq.
   Chrome bu tanlovlarni eslab qoladi — keyingi cheklar bir bosishda chiqadi.
5. **Dialogsiz (silent) chop etish** uchun Chrome yorlig'ini shu flag bilan ishga tushiring:
   `chrome.exe --kiosk-printing` — chek ochilishi bilan to'g'ridan-to'g'ri default
   printerga yuboriladi (registratura kompyuteri uchun tavsiya).
6. Brauzer saytdan popup ochishga ruxsat so'rasa — **Allow** qiling (chek alohida
   oynada ochiladi).

## Deploy (Firebase Hosting)

Jonli sayt: **https://klinika-hms.web.app** (Firebase loyihasi: `klinika-hms`)

```bash
npm run build
npx firebase-tools deploy --only hosting
```

Eslatma: `VITE_SUPABASE_*` qiymatlar build vaqtida bundlega kiradi — `.env`
o'zgargan bo'lsa, avval qayta build qiling.

## SaaS (ko'p klinikali) rejim

[supabase/migrations/20261007000008_saas.sql](supabase/migrations/20261007000008_saas.sql):

- **RLS tenant bo'yicha** — har klinika faqat o'z ma'lumotini ko'radi, navbat
  raqamlari ham har klinikada o'zinikidan yuradi
- **superadmin** (platforma egasi) — «Klinikalar» sahifasida yangi klinika +
  direktor hisobini ochadi (`create_tenant` RPC)
- **Direktor kabineti → Sozlamalar**: klinika rekvizitlari (chek/QR), narxnoma
  (qo'shish/tahrirlash/o'chirish), shifokorlar, xodim hisoblari
  (`admin_create_staff`, `admin_reset_password`, `admin_set_disabled` RPC'lari)
- Chek har klinikaning o'z nomi, manzili va QR-lokatsiyasi bilan chiqadi

Superadmin yaratish (bir martalik): `node scripts/create-superadmin.mjs <email>`

## Texnologiyalar

React 18 + TypeScript + Vite · TailwindCSS 4 · React Router · Recharts · lucide-react · Supabase (PostgreSQL)

## Modullar

| Sahifa | Yo'l | Kim uchun |
|---|---|---|
| Boshqaruv paneli | `/` | Direktor, hisobchi |
| Bemorlar (+ EMR karta) | `/bemorlar` | Registratura |
| Qabullar / Navbat | `/qabullar` | Registratura |
| Kassa / To'lovlar | `/kassa` | Hisobchi, registratura |
| Shifokor kabineti | `/shifokor` | Shifokor |
| Laboratoriya | `/laboratoriya` | Laborant |
| HR / Xodimlar | `/xodimlar` | Direktor |
| KPI / Hisobotlar | `/hisobotlar` | Direktor, hisobchi |

Chap paneldagi **rol almashtirgich** orqali har bir rol ko'radigan interfeysni sinash mumkin.

## Asosiy biznes-qoida (TZ 3-bo'lim)

Bemor holati zanjiri: `Ro'yxatda → To'lov kutilmoqda → TO'LANDI → Navbatda → Qabulda → Yakunlandi`.
Shifokor kabinetida faqat `status >= TO'LANDI` bo'lgan qabullar ko'rinadi — filtr
[src/pages/Doctor.tsx](src/pages/Doctor.tsx) da, holat zanjiri [src/types.ts](src/types.ts) da.

## Sinab ko'rish ssenariysi

1. **Registratura** roli → Bemorlar → «Yangi bemor» (dublikat tekshiruvi bor)
2. Qabullar → «Qabulga yozish» → holat «To'lov kutilmoqda» bo'ladi
3. **Kassa** → to'lovni qabul qiling (Naqd/Click/Payme/Uzum)
4. **Shifokor** roli → bemor endi ro'yxatda: Navbatga olish → Qabulni boshlash → Yakunlash (ICD-10 tashxis bilan)
5. **Laborant** roli → kutilayotgan tahlilga natija kiriting — normadan chetga chiqsa qizil/sariq belgilanadi

## Keyingi qadamlar (TZ bo'yicha)

- Django + DRF backend (multi-tenant, `tenant_id` + RLS)
- Autentifikatsiya (JWT) va haqiqiy rol-huquqlar (RBAC)
- PayTechUZ (Click/Payme/Uzum) va Eskiz.uz SMS integratsiyasi
- Rus tili (react-i18next)
