import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Plus } from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  inputCls,
  Modal,
  PrimaryButton,
  Table,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";
import { useStore } from "../store";

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  for (const b of buf) p += chars[b % chars.length];
  return p;
}

interface TenantRow {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  mapsUrl: "",
  directorName: "",
  directorEmail: "",
  directorPassword: "",
};

export default function Tenants() {
  const { profile, notify } = useStore();
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Yangi klinika yaratilgach login/parol bir marta ko'rsatiladi
  const [created, setCreated] = useState<null | {
    clinic: string;
    email: string;
    password: string;
  }>(null);

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at");
    if (error) {
      setErr(error.message);
      return;
    }
    setRows(
      (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address ?? "",
        phone: r.phone ?? "",
        active: r.active ?? true,
        createdAt: (r.created_at ?? "").slice(0, 10),
      })),
    );
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (profile && profile.role !== "superadmin") {
    return <p className="text-sm text-slate-500">{t("Bu sahifa faqat platforma egasi uchun.")}</p>;
  }
  if (!supabase) {
    return <p className="text-sm text-slate-500">{t("Supabase ulanmagan.")}</p>;
  }
  const sb = supabase;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      const { error } = await sb.rpc("create_tenant", {
        p_name: form.name.trim(),
        p_address: form.address.trim(),
        p_phone: form.phone.trim(),
        p_maps_url: form.mapsUrl.trim(),
        p_director_email: form.directorEmail.trim(),
        p_director_password: form.directorPassword,
        p_director_name: form.directorName.trim(),
      });
      if (error) throw new Error(error.message);
      setCreated({
        clinic: form.name.trim(),
        email: form.directorEmail.trim(),
        password: form.directorPassword,
      });
      setOpen(false);
      setForm(emptyForm);
      notify(t("Yangi klinika ochildi"));
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Klinikalar")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Platformadagi barcha klinikalar. Yangi klinika ochilganda direktor")}
            {t("hisobidan hammasi o'zi boshqariladi.")}
          </p>
        </div>
        <PrimaryButton
          onClick={() => {
            setCreated(null);
            setForm({ ...emptyForm, directorPassword: genPassword() });
            setOpen(true);
          }}
        >
          <Plus size={16} /> {t("Yangi klinika")}
        </PrimaryButton>
      </div>

      {err && (
        <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{t(err)}</p>
      )}

      {created && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-5">
          <p className="flex items-center gap-2 font-semibold text-emerald-800">
            <CheckCircle2 size={18} /> «{created.clinic}» ochildi
          </p>
          <p className="mt-2 text-sm text-emerald-800">
            Direktor login: <b>{created.email}</b> · Parol:{" "}
            <b className="font-mono">{created.password}</b>
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            {t("Bu ma'lumotlarni hoziroq klinika rahbariga yozib bering — parol qayta")}
            {t("ko'rsatilmaydi. Direktor tizimga kirib, Sozlamalar bo'limidan")}
            {t("xodimlar va narxnomani o'zi kiritadi.")}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader
          title={t("Klinikalar ro'yxati")}
          subtitle={rows ? `${rows.length} ${t("ta klinika")}` : "Yuklanmoqda..."}
        />
        <Table head={[t("Klinika"), t("Manzil"), t("Telefon"), t("Ochilgan"), t("Holat")]}>
          {(rows ?? []).map((tn) => (
            <tr key={tn.id} className="hover:bg-slate-50">
              <td className="px-5 py-3">
                <span className="flex items-center gap-2.5 font-medium">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <Building2 size={15} />
                  </span>
                  {tn.name}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-500">{tn.address || "—"}</td>
              <td className="px-5 py-3 text-slate-500">{tn.phone || "—"}</td>
              <td className="px-5 py-3 text-slate-500">{tn.createdAt}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    tn.active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tn.active ? t("Faol") : t("To'xtatilgan")}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <Modal title={t("Yangi klinika ochish")} onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t("Klinika ma'lumotlari")}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Klinika nomi *")}>
                <input
                  required
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label={t("Telefon")}>
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label={t("Manzil")}>
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label={t("Google Maps havolasi (chek QR)")}>
                <input
                  className={inputCls}
                  placeholder={t("https://maps.google.com/?q=...")}
                  value={form.mapsUrl}
                  onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                />
              </Field>
            </div>
            <p className="pt-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t("Direktor hisobi")}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Direktor F.I.Sh. *")}>
                <input
                  required
                  className={inputCls}
                  value={form.directorName}
                  onChange={(e) => setForm({ ...form, directorName: e.target.value })}
                />
              </Field>
              <Field label={t("Direktor email (login) *")}>
                <input
                  required
                  type="email"
                  className={inputCls}
                  value={form.directorEmail}
                  onChange={(e) => setForm({ ...form, directorEmail: e.target.value })}
                />
              </Field>
              <Field label={t("Direktor paroli *")}>
                <div className="flex gap-2">
                  <input
                    required
                    minLength={8}
                    className={inputCls}
                    value={form.directorPassword}
                    onChange={(e) =>
                      setForm({ ...form, directorPassword: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, directorPassword: genPassword() })}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {t("Yangi")}
                  </button>
                </div>
              </Field>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t("Bekor qilish")}
              </button>
              <PrimaryButton type="submit">
                {busy ? t("Ochilmoqda...") : t("Klinikani ochish")}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
