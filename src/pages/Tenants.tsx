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
    return <p className="text-sm text-slate-500">Bu sahifa faqat platforma egasi uchun.</p>;
  }
  if (!supabase) {
    return <p className="text-sm text-slate-500">Supabase ulanmagan.</p>;
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
      notify("Yangi klinika ochildi");
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
          <h1 className="text-2xl font-bold tracking-tight">Klinikalar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Platformadagi barcha klinikalar. Yangi klinika ochilganda direktor
            hisobidan hammasi o'zi boshqariladi.
          </p>
        </div>
        <PrimaryButton
          onClick={() => {
            setCreated(null);
            setForm({ ...emptyForm, directorPassword: genPassword() });
            setOpen(true);
          }}
        >
          <Plus size={16} /> Yangi klinika
        </PrimaryButton>
      </div>

      {err && (
        <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{err}</p>
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
            Bu ma'lumotlarni hoziroq klinika rahbariga yozib bering — parol qayta
            ko'rsatilmaydi. Direktor tizimga kirib, Sozlamalar bo'limidan
            xodimlar va narxnomani o'zi kiritadi.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Klinikalar ro'yxati"
          subtitle={rows ? `${rows.length} ta klinika` : "Yuklanmoqda..."}
        />
        <Table head={["Klinika", "Manzil", "Telefon", "Ochilgan", "Holat"]}>
          {(rows ?? []).map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="px-5 py-3">
                <span className="flex items-center gap-2.5 font-medium">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <Building2 size={15} />
                  </span>
                  {t.name}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-500">{t.address || "—"}</td>
              <td className="px-5 py-3 text-slate-500">{t.phone || "—"}</td>
              <td className="px-5 py-3 text-slate-500">{t.createdAt}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    t.active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.active ? "Faol" : "To'xtatilgan"}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <Modal title="Yangi klinika ochish" onClose={() => setOpen(false)} wide>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Klinika ma'lumotlari
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Klinika nomi *">
                <input
                  required
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Telefon">
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Manzil">
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label="Google Maps havolasi (chek QR)">
                <input
                  className={inputCls}
                  placeholder="https://maps.google.com/?q=..."
                  value={form.mapsUrl}
                  onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                />
              </Field>
            </div>
            <p className="pt-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Direktor hisobi
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Direktor F.I.Sh. *">
                <input
                  required
                  className={inputCls}
                  value={form.directorName}
                  onChange={(e) => setForm({ ...form, directorName: e.target.value })}
                />
              </Field>
              <Field label="Direktor email (login) *">
                <input
                  required
                  type="email"
                  className={inputCls}
                  value={form.directorEmail}
                  onChange={(e) => setForm({ ...form, directorEmail: e.target.value })}
                />
              </Field>
              <Field label="Direktor paroli *">
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
                    Yangi
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
                Bekor qilish
              </button>
              <PrimaryButton type="submit">
                {busy ? "Ochilmoqda..." : "Klinikani ochish"}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
