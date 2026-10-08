// RLS tekshiruvi: har rol bilan kirib, DB nimani qaytarishini sinaymiz.
// Ishga tushirish: node scripts/test-rls.mjs
import { createClient } from "@supabase/supabase-js";

const URL = "https://fomxlrryvxgfbfdoqymt.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbXhscnJ5dnhnZmJmZG9xeW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjE1NjQsImV4cCI6MjEwMDAzNzU2NH0.BcZBQfeJ2WxVrTaKdfejTt496rfOJKOylZhyuRen16E";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
}

// Parollar almashtirilgan — testdan oldin: $env:KLINIKA_PASS_<ROL> yoki
// HISOBLAR.md dagi parollarni env orqali bering. Yagona parol bo'lsa KLINIKA_PASS.
const PASS = (email) =>
  process.env[`KLINIKA_PASS_${email.split("@")[0].toUpperCase()}`] ??
  process.env.KLINIKA_PASS ??
  "klinika123";

async function asUser(email) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({
    email,
    password: PASS(email),
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  return sb;
}

// 1) Anonim (login yo'q) — hech narsa ko'rmasligi kerak
{
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data } = await sb.from("patients").select("id");
  check("anonim bemorlarni ko'rmaydi", (data ?? []).length === 0);
}

// 2) Shifokor — faqat o'z (d1) va to'langan qabullari
{
  const sb = await asUser("shifokor@klinika.uz");
  const { data: appts } = await sb.from("appointments").select("*");
  const onlyOwnPaid = (appts ?? []).every(
    (a) =>
      a.doctor_id === "d1" &&
      ["TOLANDI", "NAVBATDA", "QABULDA", "YAKUNLANDI"].includes(a.status),
  );
  check(
    "shifokor faqat o'zining to'langan qabullarini ko'radi",
    (appts ?? []).length > 0 && onlyOwnPaid,
    `${(appts ?? []).length} ta qator`,
  );

  // Boshqa shifokorning qabulini o'zgartira olmasligi kerak (a2 — d3'niki)
  const { data: upd } = await sb
    .from("appointments")
    .update({ complaint: "hack" })
    .eq("id", "a2")
    .select();
  check("shifokor boshqa shifokor qabulini o'zgartira olmaydi", (upd ?? []).length === 0);

  // Narxnomani o'zgartira olmasligi kerak
  const { data: srv } = await sb
    .from("services")
    .update({ price: 1 })
    .eq("id", "s1")
    .select();
  check("shifokor narxnomani o'zgartira olmaydi", (srv ?? []).length === 0);
  await sb.auth.signOut();
}

// 3) Laborant — qabullar/tashxis tarixi yashirin, tahlillar ochiq
{
  const sb = await asUser("laborant@klinika.uz");
  const { data: appts } = await sb.from("appointments").select("id");
  check("laborant qabullarni (tashxis tarixini) ko'rmaydi", (appts ?? []).length === 0);
  const { data: labs } = await sb.from("lab_orders").select("id");
  check("laborant tahlil buyurtmalarini ko'radi", (labs ?? []).length > 0);
  const { data: emp } = await sb.from("employees").select("id");
  check("laborant xodimlar/ish haqini ko'rmaydi", (emp ?? []).length === 0);
  await sb.auth.signOut();
}

// 4) Registratura — bemor yozadi, lekin tahlil natijasini o'zgartira olmaydi
{
  const sb = await asUser("registratura@klinika.uz");
  const { error: insErr } = await sb.from("patients").insert({
    id: "P-TEST-RLS",
    tenant_id: "t1",
    full_name: "RLS Test",
    birth_date: "1990-01-01",
    gender: "Erkak",
  });
  check("registratura bemor qo'sha oladi", !insErr, insErr?.message);
  await sb.from("patients").delete().eq("id", "P-TEST-RLS"); // direktor emas — o'chira olmaydi, tozalashni direktor qiladi
  const { data: lab } = await sb
    .from("lab_orders")
    .update({ result: 1 })
    .eq("id", "l1")
    .select();
  check("registratura tahlil natijasini o'zgartira olmaydi", (lab ?? []).length === 0);
  await sb.auth.signOut();
}

// 5) Direktor — hammasini ko'radi + test yozuvni tozalaydi
{
  const sb = await asUser("direktor@klinika.uz");
  const { data: appts } = await sb.from("appointments").select("id");
  check("direktor barcha qabullarni ko'radi", (appts ?? []).length >= 8);
  await sb.from("patients").delete().eq("id", "P-TEST-RLS");
  const { data: left } = await sb.from("patients").select("id").eq("id", "P-TEST-RLS");
  check("test yozuv tozalandi", (left ?? []).length === 0);
  await sb.auth.signOut();
}

console.log(failed === 0 ? "\nBarcha RLS testlar o'tdi ✔" : `\n${failed} ta test YIQILDI`);
process.exit(failed === 0 ? 0 : 1);
