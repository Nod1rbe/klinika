import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  appointments as seedAppointments,
  doctors as seedDoctors,
  employees as seedEmployees,
  labOrders as seedLabOrders,
  patients as seedPatients,
  services as seedServices,
  TODAY,
} from "./data/mock";
import {
  mapAppointment,
  mapDoctor,
  mapEmployee,
  mapLabOrder,
  mapMovement,
  mapPatient,
  mapProduct,
  mapPurchase,
  mapRefund,
  mapSale,
  mapService,
  mapSupplier,
  newPatientRow,
  TENANT_ID,
} from "./lib/db";
import { tashkentToday } from "./lib/date";
import { getLang, setCurrentLang, type Lang } from "./lib/i18n";
import { supabase } from "./lib/supabase";
import type {
  Appointment,
  AppointmentItem,
  AppointmentStatus,
  Doctor,
  Employee,
  InventoryMovement,
  LabOrder,
  Patient,
  PaymentMethod,
  Product,
  Purchase,
  RefundRec,
  Role,
  SaleRec,
  Service,
  Supplier,
} from "./types";

// error — Supabase sozlangan, lekin yuklash muvaffaqiyatsiz (mock ko'rsatilmaydi!)
export type DataSource = "supabase" | "mock" | "loading" | "error";
export type AuthState = "disabled" | "loading" | "signedOut" | "signedIn";

export interface Profile {
  fullName: string;
  role: Role;
  doctorId?: string; // shifokor roli uchun: doctors jadvalidagi o'z yozuvi
  tenantId: string; // qaysi klinikaga tegishli
}

// Joriy klinika rekvizitlari — chek va sarlavhalarda ishlatiladi
export interface ClinicInfo {
  name: string;
  address: string;
  phone: string;
  mapsUrl: string;
}

interface Store {
  role: Role;
  setRole: (r: Role) => void; // faqat mock rejimda ishlatiladi
  today: string; // Toshkent bo'yicha bugungi sana — muntazam yangilanadi
  lang: Lang;
  setLang: (l: Lang) => void;
  clinic: ClinicInfo;
  source: DataSource;
  loadError: string | null;
  retryLoad: () => void;
  dbError: string | null;
  clearDbError: () => void;
  toast: string | null;
  notify: (msg: string) => void;
  authState: AuthState;
  profile: Profile | null;
  userEmail: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  patients: Patient[];
  appointments: Appointment[];
  labOrders: LabOrder[];
  doctors: Doctor[];
  services: Service[];
  employees: Employee[];
  products: Product[];
  suppliers: Supplier[];
  salesList: SaleRec[];
  purchases: Purchase[];
  movements: InventoryMovement[]; // oxirgi 1000 ta harakat
  refundsList: RefundRec[];
  addPatient: (p: Omit<Patient, "id" | "createdAt">) => Promise<Patient>;
  registerVisit: (input: {
    patientId: string;
    doctorId: string;
    items: { serviceId: string; qty?: number }[];
    payNow: boolean;
    method?: PaymentMethod;
  }) => Promise<Appointment>;
  setAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  pay: (id: string, method: PaymentMethod) => Promise<void>;
  finishVisit: (
    id: string,
    data: { complaint: string; diagnosis: string; recommendation: string },
  ) => void;
  enterLabResult: (id: string, result: number) => void;
}

const Ctx = createContext<Store | null>(null);

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Supabase bitta so'rovda maksimal 1000 qator qaytaradi. Klinika faol ishlaganda
// yozuvlar bundan oshadi (masalan appointment_services > 1000 bo'lganda bugungi
// summalar 0 ko'rinib qolgan edi) — shuning uchun hammasi sahifalab olinadi.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T = any>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let i = 0; ; i++) {
    const { data, error } = await build(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [manualRole, setManualRole] = useState<Role>("direktor");
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>(
    supabase ? "loading" : "disabled",
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [source, setSource] = useState<DataSource>(
    supabase ? "loading" : "mock",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [today, setToday] = useState<string>(tashkentToday());
  const [lang, setLangState] = useState<Lang>(getLang());
  const loadedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tenantRows, setTenantRows] = useState<any[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }
  const [patients, setPatients] = useState<Patient[]>(
    supabase ? [] : seedPatients,
  );
  const [appointments, setAppointments] = useState<Appointment[]>(
    supabase ? [] : seedAppointments,
  );
  const [labOrders, setLabOrders] = useState<LabOrder[]>(
    supabase ? [] : seedLabOrders,
  );
  const [doctors, setDoctors] = useState<Doctor[]>(supabase ? [] : seedDoctors);
  const [services, setServices] = useState<Service[]>(
    supabase ? [] : seedServices,
  );
  const [employees, setEmployees] = useState<Employee[]>(
    supabase ? [] : seedEmployees,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesList, setSalesList] = useState<SaleRec[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [refundsList, setRefundsList] = useState<RefundRec[]>([]);

  // Fon amallaridagi (holat o'zgartirish va h.k.) DB xatolarini foydalanuvchiga ko'rsatish
  function reportDbError(op: string) {
    return ({ error }: { error: { message: string } | null }) => {
      if (error) {
        console.error(`Supabase xatosi (${op}):`, error.message);
        setDbError(`${op} bazaga saqlanmadi — internetni tekshirib qayta urining`);
      }
    };
  }

  // Sessiya kuzatuvi
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthState(data.session ? "signedIn" : "signedOut");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthState(s ? "signedIn" : "signedOut");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Profil (rol) yuklash
  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          console.error("Profil topilmadi:", error?.message);
          return;
        }
        setProfile({
          fullName: data.full_name,
          role: data.role,
          doctorId: data.doctor_id ?? undefined,
          tenantId: data.tenant_id,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Ma'lumotlarni yuklash. Xato bo'lsa mock KO'RSATILMAYDI —
  // foydalanuvchi soxta ma'lumot bilan ishlab qolmasligi uchun error ekrani chiqadi.
  // Bir marta yuklangandan keyingi yangilanishlar "jim" bo'ladi (ekran lipillamaydi),
  // jim yangilash xato bersa — eski ma'lumot saqlanib qoladi.
  useEffect(() => {
    if (!supabase) return;
    if (!session) {
      loadedRef.current = false;
      setSource("loading");
      return;
    }
    const sb = supabase;
    let cancelled = false;
    const silent = loadedRef.current;
    if (!silent) {
      setSource("loading");
      setLoadError(null);
    }
    (async () => {
      try {
        const [
          patRows,
          apptRows,
          labRows,
          doc,
          srv,
          emp,
          ten,
          prodRows,
          supRows,
          saleRows,
          purRows,
          mov,
          refRows,
        ] = await Promise.all([
          fetchAll((f, t) =>
            sb.from("patients").select("*").order("id").range(f, t),
          ),
          // Xizmatlar qabulga biriktirilgan holda (embedded) keladi —
          // alohida 1000-qatorli so'rovga bog'liq emas
          fetchAll((f, t) =>
            sb
              .from("appointments")
              .select("*, appointment_services(*)")
              .order("created_at")
              .range(f, t),
          ),
          fetchAll((f, t) =>
            sb.from("lab_orders").select("*").order("id").range(f, t),
          ),
          sb.from("doctors").select("*").order("id"),
          sb.from("services").select("*").order("id"),
          sb.from("employees").select("*").order("id"),
          sb.from("tenants").select("*").order("id"),
          // products_v: ruxsatsiz rollarga tannarx NULL qaytaradi (DB darajasida)
          fetchAll((f, t) =>
            sb.from("products_v").select("*").order("name").range(f, t),
          ),
          fetchAll((f, t) =>
            sb.from("suppliers").select("*").order("name").range(f, t),
          ),
          fetchAll((f, t) =>
            sb
              .from("sales")
              .select("*, sale_items(*), sale_payments(*)")
              .order("created_at")
              .range(f, t),
          ),
          fetchAll((f, t) =>
            sb
              .from("purchases")
              .select("*, purchase_items(*)")
              .order("created_at")
              .range(f, t),
          ),
          sb
            .from("inventory_movements")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000),
          fetchAll((f, t) =>
            sb.from("refunds").select("*").order("created_at").range(f, t),
          ),
        ]);
        const failed = [doc, srv, emp].find((r) => r.error);
        if (failed?.error) throw new Error(failed.error.message);
        if (cancelled) return;
        setPatients(
          patRows
            .map(mapPatient)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        );
        setAppointments(
          apptRows.map((r) =>
            mapAppointment(
              r,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (r.appointment_services ?? []).map((row: any) => {
                const qty = Number(row.qty ?? 1);
                return {
                  serviceId: row.service_id as string,
                  price: Number(row.price),
                  qty: qty > 1 ? qty : undefined,
                };
              }),
            ),
          ),
        );
        setLabOrders(labRows.map(mapLabOrder));
        setDoctors((doc.data ?? []).map(mapDoctor));
        setServices((srv.data ?? []).map(mapService));
        setEmployees((emp.data ?? []).map(mapEmployee));
        setTenantRows(ten.data ?? []);
        setProducts(prodRows.map(mapProduct));
        setSuppliers(supRows.map(mapSupplier));
        setSalesList(saleRows.map(mapSale));
        setPurchases(purRows.map(mapPurchase));
        setMovements((mov.data ?? []).map(mapMovement));
        setRefundsList(refRows.map(mapRefund));
        setToday(tashkentToday());
        loadedRef.current = true;
        setSource("supabase");
      } catch (e) {
        console.error("Ma'lumotlarni yuklab bo'lmadi:", e);
        if (cancelled) return;
        if (!silent) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setSource("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, retryTick]);

  // Fonda avtomatik yangilash: har 3 daqiqada va oyna qaytib ochilganda.
  // Registraturada tab kunlab ochiq turadi — sana o'tsa ham "bugun" va
  // summalar o'z-o'zidan yangilanib turishi kerak.
  useEffect(() => {
    if (!supabase || !session) return;
    const refresh = () => {
      setToday(tashkentToday());
      setRetryTick((t) => t + 1);
    };
    const intervalId = setInterval(refresh, 180000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session]);

  const store = useMemo<Store>(
    () => ({
      role: profile?.role ?? manualRole,
      setRole: setManualRole,
      today,
      lang,
      setLang(l: Lang) {
        setCurrentLang(l);
        setLangState(l);
      },
      clinic: (() => {
        const row =
          tenantRows.find((t) => t.id === profile?.tenantId) ?? tenantRows[0];
        return row
          ? {
              name: row.name ?? "",
              address: row.address ?? "",
              phone: row.phone ?? "",
              mapsUrl: row.maps_url ?? "",
            }
          : { name: "KlinikaHMS", address: "", phone: "", mapsUrl: "" };
      })(),
      source,
      loadError,
      retryLoad: () => setRetryTick((t) => t + 1),
      dbError,
      clearDbError: () => setDbError(null),
      toast,
      notify,
      authState,
      profile,
      userEmail: session?.user.email ?? null,
      async signIn(email, password) {
        if (!supabase) return "Supabase sozlanmagan";
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error) return null;
        return error.message === "Invalid login credentials"
          ? "Email yoki parol noto'g'ri"
          : error.message;
      },
      signOut() {
        supabase?.auth.signOut();
      },
      patients,
      appointments,
      labOrders,
      doctors,
      services,
      employees,
      products,
      suppliers,
      salesList,
      purchases,
      movements,
      refundsList,
      // ID bazada beriladi (P-<yil>-NNNNNN) — parallel registratorlarda to'qnashmaydi
      async addPatient(p) {
        if (!supabase) {
          const maxNum = patients.reduce((m, x) => {
            const n = parseInt(x.id.split("-").pop() ?? "0", 10);
            return Number.isNaN(n) ? m : Math.max(m, n);
          }, 0);
          const patient: Patient = {
            ...p,
            id: `P-${new Date().getFullYear()}-${String(maxNum + 1).padStart(6, "0")}`,
            createdAt: TODAY,
          };
          setPatients((prev) => [patient, ...prev]);
          return patient;
        }
        const { data, error } = await supabase
          .from("patients")
          .insert(newPatientRow(p, profile?.tenantId ?? TENANT_ID))
          .select()
          .single();
        if (error || !data)
          throw new Error(error?.message ?? "Bemor saqlanmadi");
        const patient = mapPatient(data);
        setPatients((prev) => [patient, ...prev]);
        return patient;
      },
      // Qabul + xizmatlar + navbat raqami — DB'da bitta tranzaksiya (create_visit RPC).
      // Muvaffaqiyatli qaytmaguncha chek chiqarilmaydi.
      async registerVisit({ patientId, doctorId, items: inputItems, payNow, method }) {
        if (!supabase) {
          const hhmm = nowHHMM();
          const queueNo =
            appointments
              .filter((a) => a.date === TODAY)
              .reduce((m, a) => Math.max(m, a.queueNo ?? 0), 0) + 1;
          const items: AppointmentItem[] = inputItems.map((it) => ({
            serviceId: it.serviceId,
            price: services.find((s) => s.id === it.serviceId)?.price ?? 0,
            qty: it.qty && it.qty > 1 ? it.qty : undefined,
          }));
          const appt: Appointment = {
            id: crypto.randomUUID(),
            patientId,
            doctorId,
            items,
            queueNo,
            date: TODAY,
            time: hhmm,
            status: payNow ? "TOLANDI" : "TOLOV_KUTILMOQDA",
            paymentMethod: payNow ? method : undefined,
            paidAt: payNow ? hhmm : undefined,
          };
          setAppointments((prev) => [...prev, appt]);
          return appt;
        }
        const { data, error } = await supabase.rpc("create_visit", {
          p_patient_id: patientId,
          p_doctor_id: doctorId,
          p_items: inputItems.map((it) => ({
            id: it.serviceId,
            qty: it.qty ?? 1,
          })),
          p_pay_now: payNow,
          p_method: method ?? null,
        });
        if (error || !data)
          throw new Error(error?.message ?? "Qabul yaratilmadi");
        const appt: Appointment = {
          id: data.id,
          patientId,
          doctorId,
          items: (data.items ?? []).map(
            (it: { serviceId: string; price: number; qty?: number }) => ({
              serviceId: it.serviceId,
              price: it.price,
              qty: it.qty && it.qty > 1 ? it.qty : undefined,
            }),
          ),
          queueNo: data.queueNo,
          date: data.date,
          time: data.time,
          status: data.status,
          paymentMethod: data.paymentMethod ?? undefined,
          paidAt: data.paidAt ?? undefined,
        };
        setAppointments((prev) => [...prev, appt]);
        return appt;
      },
      setAppointmentStatus(id, status) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a)),
        );
        supabase
          ?.from("appointments")
          .update({ status })
          .eq("id", id)
          .then(reportDbError("Holat o'zgarishi"));
      },
      // To'lov awaited — chek faqat baza tasdiqlagach chiqadi.
      // Vaqt serverda (Asia/Tashkent) belgilanadi — kompyuter soati noto'g'ri
      // bo'lsa ham chek/hisobotdagi vaqt to'g'ri bo'ladi.
      async pay(id, method) {
        let paidAt = nowHHMM();
        if (supabase) {
          const { data, error } = await supabase.rpc("pay_visit", {
            p_appt_id: id,
            p_method: method,
          });
          if (error) throw new Error(error.message);
          paidAt = data?.paidAt ?? paidAt;
        }
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, status: "TOLANDI", paymentMethod: method, paidAt }
              : a,
          ),
        );
      },
      finishVisit(id, data) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, ...data, status: "YAKUNLANDI" } : a,
          ),
        );
        supabase
          ?.from("appointments")
          .update({
            status: "YAKUNLANDI",
            complaint: data.complaint,
            diagnosis: data.diagnosis,
            recommendation: data.recommendation,
          })
          .eq("id", id)
          .then(reportDbError("Qabul yakuni"));
      },
      enterLabResult(id, result) {
        setLabOrders((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, result, status: "TAYYOR" } : l,
          ),
        );
        supabase
          ?.from("lab_orders")
          .update({ result, status: "TAYYOR" })
          .eq("id", id)
          .then(reportDbError("Tahlil natijasi"));
      },
    }),
    [
      manualRole,
      profile,
      session,
      authState,
      today,
      lang,
      source,
      loadError,
      dbError,
      toast,
      patients,
      appointments,
      labOrders,
      doctors,
      services,
      employees,
      tenantRows,
      products,
      suppliers,
      salesList,
      purchases,
      movements,
      refundsList,
    ],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider topilmadi");
  return s;
}

export { TENANT_ID };
