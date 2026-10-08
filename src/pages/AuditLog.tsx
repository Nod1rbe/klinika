import { useEffect, useState } from "react";
import { t } from "../lib/i18n";
import { Card, CardHeader, Table } from "../components/ui";
import { supabase } from "../lib/supabase";
import { ROLE_LABELS, type Role } from "../types";

interface Entry {
  id: number;
  userName: string | null;
  userRole: string | null;
  action: "view" | "insert" | "update" | "delete";
  entity: string;
  entityId: string | null;
  changed: string[];
  createdAt: string;
}

const ACTION_LABELS: Record<Entry["action"], string> = {
  view: "Ko'rdi",
  insert: "Yaratdi",
  update: "O'zgartirdi",
  delete: "O'chirdi",
};

const ACTION_STYLES: Record<Entry["action"], string> = {
  view: "bg-sky-100 text-sky-700",
  insert: "bg-emerald-100 text-emerald-700",
  update: "bg-amber-100 text-amber-700",
  delete: "bg-rose-100 text-rose-700",
};

const ENTITY_LABELS: Record<string, string> = {
  patients: "Bemor",
  appointments: "Qabul",
  lab_orders: "Tahlil",
  services: "Xizmat/narx",
};

// UPDATE yozuvidan o'zgargan ustunlar ro'yxatini chiqarish
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function changedFields(details: any): string[] {
  if (!details?.old || !details?.new) return [];
  return Object.keys(details.new).filter(
    (k) => JSON.stringify(details.old[k]) !== JSON.stringify(details.new[k]),
  );
}

export default function AuditLog() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setEntries([]);
      return;
    }
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          setEntries([]);
          return;
        }
        setEntries(
          (data ?? []).map((r) => ({
            id: r.id,
            userName: r.user_name,
            userRole: r.user_role,
            action: r.action,
            entity: r.entity,
            entityId: r.entity_id,
            changed: r.action === "update" ? changedFields(r.details) : [],
            createdAt: r.created_at,
          })),
        );
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Audit jurnal")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("Kim, qachon, nimani ko'rgani va o'zgartirgani. O'zgarishlar bazada")}
          {t("avtomatik qayd etiladi, jurnal o'chirilmaydi.")}
        </p>
      </div>

      <Card>
        <CardHeader
          title={t("Oxirgi harakatlar")}
          subtitle={entries ? `${entries.length} ${t("ta yozuv (oxirgi 200 tagacha)")}` : "Yuklanmoqda..."}
        />
        {error && (
          <p className="px-5 py-4 text-sm text-rose-600">Xatolik: {t(error)}</p>
        )}
        <Table head={[t("Vaqt"), t("Xodim"), t("Amal"), t("Obyekt"), t("Tafsilot")]}>
          {entries?.length === 0 && !error && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-sm text-slate-400">
                {supabase
                  ? "Hozircha yozuvlar yo'q"
                  : "Audit jurnal Supabase ulanganida ishlaydi"}
              </td>
            </tr>
          )}
          {entries?.map((e) => (
            <tr key={e.id}>
              <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                {new Date(e.createdAt).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </td>
              <td className="px-5 py-3">
                <p className="font-medium">{e.userName ?? "—"}</p>
                <p className="text-xs text-slate-400">
                  {e.userRole ? t(ROLE_LABELS[e.userRole as Role] ?? e.userRole) : ""}
                </p>
              </td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLES[e.action]}`}
                >
                  {t(ACTION_LABELS[e.action])}
                </span>
              </td>
              <td className="px-5 py-3">
                {t(ENTITY_LABELS[e.entity] ?? e.entity)}
                {e.entityId && (
                  <span className="block font-mono text-xs text-slate-400">
                    {e.entityId}
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-xs text-slate-500">
                {e.changed.length > 0 ? `O'zgardi: ${e.changed.join(", ")}` : "—"}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
