import { useEffect, useState } from "react";
import {
  Building2,
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Stethoscope,
  Tag,
  UserPlus,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Field,
  inputCls,
  Modal,
  PrimaryButton,
  Table,
} from "../components/ui";
import { fmtSum } from "../data/mock";
import { supabase } from "../lib/supabase";
import { t } from "../lib/i18n";
import { useStore } from "../store";
import type { Role } from "../types";
import { CATEGORY_ORDER, ROLE_LABELS, STAFF_ROLES } from "../types";

type Tab = "klinika" | "xizmatlar" | "shifokorlar" | "xodimlar";

const TABS: { key: Tab; label: string; icon: typeof Tag }[] = [
  { key: "klinika", label: "Klinika", icon: Building2 },
  { key: "xizmatlar", label: "Xizmatlar", icon: Tag },
  { key: "shifokorlar", label: "Shifokorlar", icon: Stethoscope },
  { key: "xodimlar", label: "Xodimlar", icon: UserPlus },
];

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  for (const b of buf) p += chars[b % chars.length];
  return p;
}

interface StaffRow {
  id: string;
  fullName: string;
  email: string | null;
  role: Role;
  doctorId: string | null;
  disabled: boolean;
}

export default function Settings() {
  const { profile, clinic, doctors, services, retryLoad, notify } = useStore();
  const [tab, setTab] = useState<Tab>("klinika");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ---- Klinika rekvizitlari ----
  const [cForm, setCForm] = useState({ name: "", address: "", phone: "", mapsUrl: "" });
  useEffect(() => {
    setCForm({
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      mapsUrl: clinic.mapsUrl,
    });
  }, [clinic.name, clinic.address, clinic.phone, clinic.mapsUrl]);

  // ---- Xizmat modal ----
  const [svcModal, setSvcModal] = useState<null | {
    id?: string;
    name: string;
    category: string;
    price: string;
    active: boolean;
  }>(null);

  // ---- Shifokor modal ----
  const [docModal, setDocModal] = useState<null | {
    id?: string;
    name: string;
    specialty: string;
    room: string;
    active: boolean;
  }>(null);

  // ---- Xodimlar ----
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [staffModal, setStaffModal] = useState<null | {
    fullName: string;
    email: string;
    password: string;
    role: Role;
    doctorId: string;
  }>(null);
  const [resetModal, setResetModal] = useState<null | {
    row: StaffRow;
    password: string;
  }>(null);
  const [createdInfo, setCreatedInfo] = useState<string | null>(null);

  async function loadStaff() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (error) {
      setErr(error.message);
      return;
    }
    setStaff(
      (data ?? []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
        email: r.email,
        role: r.role,
        doctorId: r.doctor_id,
        disabled: r.disabled ?? false,
      })),
    );
  }
  useEffect(() => {
    if (tab === "xodimlar" && staff === null) loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (profile && profile.role !== "direktor") {
    return <p className="text-sm text-slate-500">{t("Bu sahifa faqat direktor uchun.")}</p>;
  }
  if (!supabase) {
    return <p className="text-sm text-slate-500">{t("Sozlamalar Supabase ulanganda ishlaydi.")}</p>;
  }
  const sb = supabase;

  async function run(op: string, fn: () => Promise<void>) {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      await fn();
      notify(op);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const categories = [
    ...CATEGORY_ORDER,
    ...[...new Set(services.map((s) => s.category))].filter(
      (c) => c && !CATEGORY_ORDER.includes(c),
    ),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Sozlamalar")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("Klinika rekvizitlari, narxnoma, shifokorlar va xodim hisoblari — hammasi shu yerdan")}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:inline-flex">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              tab === tb.key
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <tb.icon size={15} /> {t(tb.label)}
          </button>
        ))}
      </div>

      {err && (
        <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{t(err)}</p>
      )}

      {/* ============ KLINIKA ============ */}
      {tab === "klinika" && (
        <Card className="max-w-2xl">
          <CardHeader
            title={t("Klinika rekvizitlari")}
            subtitle={t("Chekda va QR-kodda ko'rinadi")}
          />
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              run("Klinika rekvizitlari saqlandi", async () => {
                const { error } = await sb
                  .from("tenants")
                  .update({
                    name: cForm.name.trim(),
                    address: cForm.address.trim(),
                    phone: cForm.phone.trim(),
                    maps_url: cForm.mapsUrl.trim(),
                  })
                  .eq("id", profile!.tenantId);
                if (error) throw new Error(error.message);
                retryLoad();
              });
            }}
          >
            <Field label={t("Klinika nomi *")}>
              <input
                required
                className={inputCls}
                value={cForm.name}
                onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
              />
            </Field>
            <Field label={t("Manzil")}>
              <input
                className={inputCls}
                value={cForm.address}
                onChange={(e) => setCForm({ ...cForm, address: e.target.value })}
              />
            </Field>
            <Field label={t("Telefon")}>
              <input
                className={inputCls}
                value={cForm.phone}
                onChange={(e) => setCForm({ ...cForm, phone: e.target.value })}
              />
            </Field>
            <Field label={t("Google Maps havolasi (chekdagi QR shu manzilni ochadi)")}>
              <input
                className={inputCls}
                placeholder={t("https://maps.google.com/?q=...")}
                value={cForm.mapsUrl}
                onChange={(e) => setCForm({ ...cForm, mapsUrl: e.target.value })}
              />
            </Field>
            <PrimaryButton type="submit">
              {busy ? t("Saqlanmoqda...") : t("Saqlash")}
            </PrimaryButton>
          </form>
        </Card>
      )}

      {/* ============ XIZMATLAR ============ */}
      {tab === "xizmatlar" && (
        <Card>
          <CardHeader
            title={t("Narxnoma")}
            subtitle={`${services.filter((s) => s.active).length} ${t("ta faol xizmat")}`}
            action={
              <PrimaryButton
                onClick={() =>
                  setSvcModal({ name: "", category: categories[0] ?? "", price: "", active: true })
                }
              >
                <Plus size={15} /> {t("Yangi xizmat")}
              </PrimaryButton>
            }
          />
          <Table head={[t("Xizmat"), t("Kategoriya"), t("Narx"), t("Holat"), ""]}>
            {services.map((s) => (
              <tr key={s.id} className={s.active ? "hover:bg-slate-50" : "text-slate-400"}>
                <td className="px-5 py-3 font-medium">{s.name}</td>
                <td className="px-5 py-3 text-slate-500">{s.category}</td>
                <td className="px-5 py-3">{fmtSum(s.price)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {s.active ? t("Faol") : t("O'chirilgan")}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() =>
                      setSvcModal({
                        id: s.id,
                        name: s.name,
                        category: s.category,
                        price: String(s.price),
                        active: s.active,
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    <Pencil size={13} /> {t("Tahrirlash")}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* ============ SHIFOKORLAR ============ */}
      {tab === "shifokorlar" && (
        <Card>
          <CardHeader
            title={t("Shifokorlar")}
            subtitle={t("Qabulga yoziladigan shifokorlar ro'yxati")}
            action={
              <PrimaryButton
                onClick={() =>
                  setDocModal({ name: "", specialty: "", room: "", active: true })
                }
              >
                <Plus size={15} /> {t("Yangi shifokor")}
              </PrimaryButton>
            }
          />
          <Table head={[t("Shifokor"), t("Mutaxassislik"), t("Xona"), t("Holat"), ""]}>
            {doctors.map((d) => (
              <tr key={d.id} className={d.active ? "hover:bg-slate-50" : "text-slate-400"}>
                <td className="px-5 py-3 font-medium">{d.name}</td>
                <td className="px-5 py-3 text-slate-500">{d.specialty}</td>
                <td className="px-5 py-3">{d.room || "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      d.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {d.active ? t("Faol") : t("O'chirilgan")}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() =>
                      setDocModal({
                        id: d.id,
                        name: d.name,
                        specialty: d.specialty,
                        room: d.room,
                        active: d.active,
                      })
                    }
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    <Pencil size={13} /> {t("Tahrirlash")}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* ============ XODIMLAR ============ */}
      {tab === "xodimlar" && (
        <Card>
          <CardHeader
            title={t("Xodim hisoblari")}
            subtitle={t("Tizimga kirish hisoblari va ruxsatlar")}
            action={
              <PrimaryButton
                onClick={() => {
                  setCreatedInfo(null);
                  setStaffModal({
                    fullName: "",
                    email: "",
                    password: genPassword(),
                    role: "registratura",
                    doctorId: "",
                  });
                }}
              >
                <UserPlus size={15} /> {t("Yangi xodim")}
              </PrimaryButton>
            }
          />
          {createdInfo && (
            <p className="mx-5 mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
              {createdInfo} — login va parolni xodimga yozib bering, parol qayta
              {t("ko'rsatilmaydi!")}
            </p>
          )}
          <Table head={[t("Xodim"), t("Email"), t("Rol"), t("Holat"), ""]}>
            {staff === null && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-sm text-slate-400">
                  {t("Yuklanmoqda...")}
                </td>
              </tr>
            )}
            {(staff ?? []).map((r) => (
              <tr key={r.id} className={r.disabled ? "text-slate-400" : "hover:bg-slate-50"}>
                <td className="px-5 py-3 font-medium">
                  {r.fullName}
                  {r.doctorId && (
                    <span className="block text-xs text-slate-400">
                      Kabinet: {doctors.find((d) => d.id === r.doctorId)?.name ?? r.doctorId}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500">{r.email ?? "—"}</td>
                <td className="px-5 py-3">{t(ROLE_LABELS[r.role] ?? r.role)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.disabled
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {r.disabled ? "Bloklangan" : "Faol"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setResetModal({ row: r, password: genPassword() })}
                    className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    <KeyRound size={13} /> {t("Parol")}
                  </button>
                  {
                    <button
                      onClick={() =>
                        run(
                          r.disabled ? "Xodim qayta ochildi" : "Xodim bloklandi",
                          async () => {
                            const { error } = await sb.rpc("admin_set_disabled", {
                              p_profile_id: r.id,
                              p_disabled: !r.disabled,
                            });
                            if (error) throw new Error(error.message);
                            await loadStaff();
                          },
                        )
                      }
                      className={`ml-3 inline-flex items-center gap-1 text-sm font-medium ${
                        r.disabled
                          ? "text-emerald-600 hover:text-emerald-700"
                          : "text-rose-500 hover:text-rose-600"
                      }`}
                    >
                      {r.disabled ? <LockOpen size={13} /> : <Lock size={13} />}
                      {r.disabled ? "Ochish" : "Bloklash"}
                    </button>
                  }
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* ============ MODALLAR ============ */}
      {svcModal && (
        <Modal
          title={svcModal.id ? t("Xizmatni tahrirlash") : t("Yangi xizmat")}
          onClose={() => setSvcModal(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = svcModal;
              run(m.id ? "Xizmat yangilandi" : "Xizmat qo'shildi", async () => {
                const row = {
                  name: m.name.trim(),
                  category: m.category.trim(),
                  department: m.category.trim(),
                  price: Math.max(0, Math.round(Number(m.price) || 0)),
                  active: m.active,
                };
                const { error } = m.id
                  ? await sb.from("services").update(row).eq("id", m.id)
                  : await sb.from("services").insert({
                      ...row,
                      id: crypto.randomUUID(),
                      tenant_id: profile!.tenantId,
                    });
                if (error) throw new Error(error.message);
                setSvcModal(null);
                retryLoad();
              });
            }}
          >
            <Field label={t("Xizmat nomi *")}>
              <input
                required
                className={inputCls}
                value={svcModal.name}
                onChange={(e) => setSvcModal({ ...svcModal, name: e.target.value })}
              />
            </Field>
            <Field label={t("Kategoriya *")}>
              <input
                required
                list="svc-cats"
                className={inputCls}
                value={svcModal.category}
                onChange={(e) => setSvcModal({ ...svcModal, category: e.target.value })}
              />
              <datalist id="svc-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label={t("Narx (so'm) *")}>
              <input
                required
                inputMode="numeric"
                className={inputCls}
                value={svcModal.price}
                onChange={(e) => setSvcModal({ ...svcModal, price: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={svcModal.active}
                onChange={(e) => setSvcModal({ ...svcModal, active: e.target.checked })}
                className="h-4 w-4 accent-teal-600"
              />
              {t("Faol (registratsiyada ko'rinadi)")}
            </label>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("Saqlash")}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {docModal && (
        <Modal
          title={docModal.id ? t("Shifokorni tahrirlash") : t("Yangi shifokor")}
          onClose={() => setDocModal(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = docModal;
              run(m.id ? "Shifokor yangilandi" : "Shifokor qo'shildi", async () => {
                const row = {
                  name: m.name.trim(),
                  specialty: m.specialty.trim(),
                  room: m.room.trim(),
                  active: m.active,
                };
                const { error } = m.id
                  ? await sb.from("doctors").update(row).eq("id", m.id)
                  : await sb.from("doctors").insert({
                      ...row,
                      id: crypto.randomUUID(),
                      tenant_id: profile!.tenantId,
                    });
                if (error) throw new Error(error.message);
                setDocModal(null);
                retryLoad();
              });
            }}
          >
            <Field label={t("F.I.Sh. *")}>
              <input
                required
                className={inputCls}
                value={docModal.name}
                onChange={(e) => setDocModal({ ...docModal, name: e.target.value })}
              />
            </Field>
            <Field label={t("Mutaxassislik *")}>
              <input
                required
                placeholder={t("Masalan: Otorinolaringolog (LOR)")}
                className={inputCls}
                value={docModal.specialty}
                onChange={(e) => setDocModal({ ...docModal, specialty: e.target.value })}
              />
            </Field>
            <Field label={t("Xona")}>
              <input
                className={inputCls}
                value={docModal.room}
                onChange={(e) => setDocModal({ ...docModal, room: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={docModal.active}
                onChange={(e) => setDocModal({ ...docModal, active: e.target.checked })}
                className="h-4 w-4 accent-teal-600"
              />
              {t("Faol (qabulga yozish mumkin)")}
            </label>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("Saqlash")}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {staffModal && (
        <Modal title={t("Yangi xodim hisobi")} onClose={() => setStaffModal(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = staffModal;
              run("Xodim hisobi yaratildi", async () => {
                const { error } = await sb.rpc("admin_create_staff", {
                  p_email: m.email.trim(),
                  p_password: m.password,
                  p_full_name: m.fullName.trim(),
                  p_role: m.role,
                  p_doctor_id: m.role === "shifokor" && m.doctorId ? m.doctorId : null,
                });
                if (error) throw new Error(error.message);
                setCreatedInfo(`${m.fullName.trim()} — ${m.email.trim()} / parol: ${m.password}`);
                setStaffModal(null);
                await loadStaff();
                retryLoad();
              });
            }}
          >
            <Field label={t("F.I.Sh. *")}>
              <input
                required
                className={inputCls}
                value={staffModal.fullName}
                onChange={(e) => setStaffModal({ ...staffModal, fullName: e.target.value })}
              />
            </Field>
            <Field label={t("Email (login) *")}>
              <input
                required
                type="email"
                className={inputCls}
                value={staffModal.email}
                onChange={(e) => setStaffModal({ ...staffModal, email: e.target.value })}
              />
            </Field>
            <Field label={t("Parol *")}>
              <div className="flex gap-2">
                <input
                  required
                  minLength={8}
                  className={inputCls}
                  value={staffModal.password}
                  onChange={(e) => setStaffModal({ ...staffModal, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setStaffModal({ ...staffModal, password: genPassword() })}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {t("Yangi")}
                </button>
              </div>
            </Field>
            <Field label={t("Rol *")}>
              <select
                className={inputCls}
                value={staffModal.role}
                onChange={(e) => setStaffModal({ ...staffModal, role: e.target.value as Role })}
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE_LABELS[r])}
                  </option>
                ))}
              </select>
            </Field>
            {staffModal.role === "shifokor" && (
              <Field label={t("Shifokor kabineti (doctors ro'yxatidan)")}>
                <select
                  className={inputCls}
                  value={staffModal.doctorId}
                  onChange={(e) => setStaffModal({ ...staffModal, doctorId: e.target.value })}
                >
                  <option value="">{t("Bog'lanmasin")}</option>
                  {doctors
                    .filter((d) => d.active)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.specialty}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Yaratilmoqda...") : t("Hisob yaratish")}
            </PrimaryButton>
          </form>
        </Modal>
      )}

      {resetModal && (
        <Modal title={t("Parolni tiklash")} onClose={() => setResetModal(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const m = resetModal;
              run("Parol yangilandi", async () => {
                const { error } = await sb.rpc("admin_reset_password", {
                  p_profile_id: m.row.id,
                  p_password: m.password,
                });
                if (error) throw new Error(error.message);
                setCreatedInfo(`${m.row.fullName} — yangi parol: ${m.password}`);
                setResetModal(null);
              });
            }}
          >
            <p className="text-sm text-slate-600">
              <b>{resetModal.row.fullName}</b> ({resetModal.row.email}) uchun yangi parol:
            </p>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                className={inputCls}
                value={resetModal.password}
                onChange={(e) => setResetModal({ ...resetModal, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setResetModal({ ...resetModal, password: genPassword() })}
                className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t("Yangi")}
              </button>
            </div>
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? t("Saqlanmoqda...") : t("Parolni o'rnatish")}
            </PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
