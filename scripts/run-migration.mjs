// Supabase Management API orqali migratsiya faylini ishga tushirish.
// Ishlatish: $env:SB_TOKEN='sbp_...'; node scripts/run-migration.mjs supabase/migrations/<fayl>.sql
import { readFileSync } from "node:fs";

const token = process.env.SB_TOKEN;
if (!token) {
  console.error("SB_TOKEN env o'rnatilmagan");
  process.exit(1);
}
const ref = "fomxlrryvxgfbfdoqymt";
const sql = readFileSync(process.argv[2], "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);
const text = await res.text();
console.log("HTTP", res.status);
console.log(text.slice(0, 2000));
if (!res.ok) process.exit(1);
