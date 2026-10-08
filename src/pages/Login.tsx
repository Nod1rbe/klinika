import { useState } from "react";
import { HeartPulse, Loader2, LogIn } from "lucide-react";
import { Field, inputCls, PrimaryButton } from "../components/ui";
import { t } from "../lib/i18n";
import { useStore } from "../store";

export default function Login() {
  const { signIn, lang, setLang } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim(), password);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-slate-100 to-sky-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500">
            <HeartPulse size={24} className="text-white" />
          </div>
          <div>
            <p className="text-xl leading-tight font-bold">KlinikaHMS</p>
            <p className="text-xs text-slate-500">{t("Klinika boshqaruv tizimi")}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-xl shadow-slate-200/60">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">{t("Tizimga kirish")}</h1>
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(["uz", "ru", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    lang === l ? "bg-teal-600 text-white" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {l === "uz" ? "UZ" : l === "ru" ? "РУ" : "EN"}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t("Xodim hisobingiz bilan kiring")}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label={t("Email")}>
              <input
                required
                type="email"
                autoComplete="username"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siz@klinika.uz"
              />
            </Field>
            <Field label={t("Parol")}>
              <input
                required
                type="password"
                autoComplete="current-password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {t(error)}
              </p>
            )}
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {busy ? t("Kirilmoqda...") : t("Kirish")}
            </PrimaryButton>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          {t("Parolni unutdingizmi? Klinika rahbariga murojaat qiling.")} ·{" "}
          <a
            href="/qollanma.html"
            target="_blank"
            rel="noopener"
            className="font-medium text-teal-600 hover:text-teal-700"
          >
            {t("Qo'llanma")}
          </a>
        </p>
      </div>
    </div>
  );
}