// Platforma egasi (superadmin) hisobini yaratish — bir martalik.
// Ishlatish: $env:SB_TOKEN='sbp_...'; node scripts/create-superadmin.mjs sokhib@jett.uz
import { randomBytes } from "node:crypto";

const token = process.env.SB_TOKEN;
const email = process.argv[2];
if (!token || !email) {
  console.error("SB_TOKEN env va email argumenti kerak");
  process.exit(1);
}
const ref = "fomxlrryvxgfbfdoqymt";
const url = `https://${ref}.supabase.co`;

const kres = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
const serviceKey = (await kres.json()).find((k) => k.name === "service_role")?.api_key;
const admin = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
let pass = "";
for (const b of randomBytes(14)) pass += chars[b % chars.length];

let res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: admin,
  body: JSON.stringify({ email, password: pass, email_confirm: true }),
});
let body = await res.json();
let id = body.id;
if (!id) {
  const list = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers: admin });
  const data = await list.json();
  id = (data.users ?? []).find((x) => x.email === email)?.id;
  if (id) {
    await fetch(`${url}/auth/v1/admin/users/${id}`, {
      method: "PUT",
      headers: admin,
      body: JSON.stringify({ password: pass }),
    });
  }
}
if (!id) {
  console.error("Foydalanuvchi yaratilmadi:", JSON.stringify(body).slice(0, 300));
  process.exit(1);
}

const prof = await fetch(`${url}/rest/v1/profiles`, {
  method: "POST",
  headers: { ...admin, Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({
    id,
    tenant_id: "t1",
    full_name: "Platforma egasi",
    role: "superadmin",
    email,
  }),
});
console.log(`Superadmin tayyor: ${email}`);
console.log(`Parol: ${pass}`);
console.log(`Profil holati: ${prof.status}`);
