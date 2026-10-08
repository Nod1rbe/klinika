import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, UserPlus } from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  inputCls,
  Modal,
  PrimaryButton,
  Table,
} from "../components/ui";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import type { Patient } from "../types";

const emptyForm = {
  fullName: "",
  birthDate: "",
  gender: "Erkak" as Patient["gender"],
  phone: "",
  address: "",
  passport: "",
  pinfl: "",
  allergies: "",
  chronic: "",
};

export default function Patients() {
  const { patients, addPatient } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [duplicate, setDuplicate] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return patients;
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")) ||
        (p.pinfl ?? "").includes(s) ||
        (p.passport ?? "").toLowerCase().includes(s),
    );
  }, [q, patients]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaveErr(null);
    // Dublikatni tekshirish: F.I.Sh. + tug'ilgan sana yoki telefon mosligi
    const dup = patients.find(
      (p) =>
        (p.fullName.toLowerCase() === form.fullName.trim().toLowerCase() &&
          p.birthDate === form.birthDate) ||
        (form.phone.trim() !== "" &&
          p.phone.replace(/\s/g, "") === form.phone.replace(/\s/g, "")),
    );
    if (dup && !duplicate) {
      setDuplicate(dup);
      return;
    }
    setSaving(true);
    try {
      await addPatient({
        fullName: form.fullName.trim(),
        birthDate: form.birthDate,
        gender: form.gender,
        phone: form.phone.trim(),
        address: form.address.trim(),
        passport: form.passport.trim() || undefined,
        pinfl: form.pinfl.trim() || undefined,
        allergies: form.allergies ? form.allergies.split(",").map((s) => s.trim()) : [],
        chronic: form.chronic ? form.chronic.split(",").map((s) => s.trim()) : [],
      });
      setOpen(false);
      setForm(emptyForm);
      setDuplicate(null);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Bemor saqlanmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Bemorlar")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Jami {patients.length} ta bemor ro'yxatda
          </p>
        </div>
        <PrimaryButton onClick={() => setOpen(true)}>
          <UserPlus size={16} /> {t("Yangi bemor")}
        </PrimaryButton>
      </div>

      <Card>
        <CardHeader
          title={t("Bemorlar ro'yxati")}
          action={
            <div className="relative">
              <Search
                size={16}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("F.I.Sh., ID, telefon, JSHSHIR...")}
                className={`${inputCls} w-72 pl-9`}
              />
            </div>
          }
        />
        <Table head={[t("ID"), t("F.I.Sh."), t("Tug'ilgan sana"), t("Telefon"), t("JSHSHIR"), ""]}>
          {filtered.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.id}</td>
              <td className="px-5 py-3 font-medium">{p.fullName}</td>
              <td className="px-5 py-3 text-slate-500">{p.birthDate}</td>
              <td className="px-5 py-3 text-slate-500">{p.phone}</td>
              <td className="px-5 py-3 font-mono text-xs text-slate-500">
                {p.pinfl ?? "—"}
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  to={`/bemorlar/${p.id}`}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  Karta →
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && (
        <Modal
          title={t("Yangi bemorni ro'yxatga olish")}
          onClose={() => {
            setOpen(false);
            setDuplicate(null);
          }}
          wide
        >
          <form onSubmit={submit} className="space-y-4">
            {duplicate && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <b>{t("Ehtimoliy dublikat topildi:")}</b> {duplicate.fullName} (
                {duplicate.id}, tel: {duplicate.phone}). Baribir yangi bemor
                {t("sifatida saqlash uchun yana bir marta «Saqlash» bosing.")}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t("F.I.Sh. *")}>
                  <input
                    required
                    className={inputCls}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </Field>
              </div>
              <Field label={t("Tug'ilgan sana *")}>
                <input
                  required
                  type="date"
                  className={inputCls}
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </Field>
              <Field label={t("Jinsi")}>
                <select
                  className={inputCls}
                  value={form.gender}
                  onChange={(e) =>
                    setForm({ ...form, gender: e.target.value as Patient["gender"] })
                  }
                >
                  <option value="Erkak">{t("Erkak")}</option>
                  <option value="Ayol">{t("Ayol")}</option>
                </select>
              </Field>
              <Field label={t("Telefon *")}>
                <input
                  required
                  placeholder="+998 90 123 45 67"
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
              <Field label={t("Pasport seriya-raqami")}>
                <input
                  placeholder={t("AB 1234567")}
                  className={inputCls}
                  value={form.passport}
                  onChange={(e) => setForm({ ...form, passport: e.target.value })}
                />
              </Field>
              <Field label={t("JSHSHIR (PINFL)")}>
                <input
                  placeholder={t("14 raqam")}
                  className={inputCls}
                  value={form.pinfl}
                  onChange={(e) => setForm({ ...form, pinfl: e.target.value })}
                />
              </Field>
              <Field label={t("Allergiyalar (vergul bilan)")}>
                <input
                  placeholder={t("Penitsillin, ...")}
                  className={inputCls}
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                />
              </Field>
              <Field label={t("Surunkali kasalliklar (vergul bilan)")}>
                <input
                  className={inputCls}
                  value={form.chronic}
                  onChange={(e) => setForm({ ...form, chronic: e.target.value })}
                />
              </Field>
            </div>
            {saveErr && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {t(saveErr)}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setDuplicate(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t("Bekor qilish")}
              </button>
              <PrimaryButton type="submit">
                {saving ? t("Saqlanmoqda...") : t("Saqlash")}
              </PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
