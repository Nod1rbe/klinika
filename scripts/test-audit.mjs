// Audit log tekshiruvi: trigger, log_view RPC va RLS.
// Ishga tushirish: node scripts/test-audit.mjs
import { createClient } from "@supabase/supabase-js";

const URL = "https://fomxlrryvxgfbfdoqymt.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbXhscnJ5dnhnZmJmZG9xeW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NjE1NjQsImV4cCI6MjEwMDAzNzU2NH0.BcZBQfeJ2WxVrTaKdfejTt496rfOJKOylZhyuRen16E";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed++;
}

// Parollar almashtirilgan — HISOBLAR.md dagi parollarni env orqali bering:
// $env:KLINIKA_PASS_DIREKTOR, $env:KLINIKA_PASS_REGISTRATURA va h.k.
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

// 1) Registratura bemor kartasini "ko'radi" (log_view) va qabul holatini o'zgartiradi (trigger)
{
  const sb = await asUser("registratura@klinika.uz");
  const { error: vErr } = await sb.rpc("log_view", {
    p_entity: "patients",
    p_entity_id: "P-2026-000341",
  });
  check("log_view RPC ishlaydi", !vErr, vErr?.message);

  // a6 (ROYXATDA) -> TOLOV_KUTILMOQDA -> qaytarish; trigger 2 ta update yozadi
  await sb.from("appointments").update({ status: "TOLOV_KUTILMOQDA" }).eq("id", "a6");
  await sb.from("appointments").update({ status: "ROYXATDA" }).eq("id", "a6");

  // Registratura jurnalni O'QIY OLMASLIGI kerak
  const { data: rows } = await sb.from("audit_logs").select("id");
  check("registratura jurnalni ko'rmaydi", (rows ?? []).length === 0);
  await sb.auth.signOut();
}

// 2) Direktor jurnalni ko'radi va yozuvlar to'g'ri
{
  const sb = await asUser("direktor@klinika.uz");
  const { data: logs, error } = await sb
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  check("direktor jurnalni o'qiydi", !error && (logs ?? []).length >= 3, error?.message);

  const view = (logs ?? []).find(
    (l) => l.action === "view" && l.entity_id === "P-2026-000341",
  );
  check(
    "ko'rish qayd etilgan (kim ko'rgani bilan)",
    !!view && view.user_name === "Zulfiya Ergasheva" && view.user_role === "registratura",
  );

  const upd = (logs ?? []).find(
    (l) => l.action === "update" && l.entity === "appointments" && l.entity_id === "a6",
  );
  check(
    "o'zgarish trigger orqali qayd etilgan (old/new bilan)",
    !!upd && !!upd.details?.old && !!upd.details?.new,
  );

  // Jurnal o'zgarmasligi: direktor ham o'chira olmasligi kerak
  const delRes = await sb.from("audit_logs").delete().eq("id", (logs ?? [])[0]?.id ?? -1).select();
  check("jurnaldan hech kim o'chira olmaydi", (delRes.data ?? []).length === 0);
  await sb.auth.signOut();
}

console.log(failed === 0 ? "\nBarcha audit testlar o'tdi ✔" : `\n${failed} ta test YIQILDI`);
process.exit(failed === 0 ? 0 : 1);
