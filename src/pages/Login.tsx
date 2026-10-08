import { useState } from "react";
import { HeartPulse, Loader2, LogIn } from "lucide-react";
import { Field, inputCls, PrimaryButton } from "../components/ui";
import { useStore } from "../store";

export default function Login() {
  const { signIn } = useStore();
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
            <p className="text-xl font-bold leading-tight">KlinikaHMS</p>
            <p className="text-xs text-slate-500">Klinika boshqaruv tizimi</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-xl shadow-slate-200/60">
          <h1 className="text-lg font-bold">Tizimga kirish</h1>
          <p className="mt-1 text-sm text-slate-500">
            Xodim hisobingiz bilan kiring
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Email">
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
            <Field label="Parol">
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
                {error}
              </p>
            )}
            <PrimaryButton type="submit" className="w-full justify-center">
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {busy ? "Kirilmoqda..." : "Kirish"}
            </PrimaryButton>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Parolni unutdingizmi? Klinika rahbariga murojaat qiling. ·{" "}
          <a
            href="/qollanma.html"
            target="_blank"
            rel="noopener"
            className="font-medium text-teal-600 hover:text-teal-700"
          >
            Qo'llanma
          </a>
        </p>
      </div>
    </div>
  );
}
