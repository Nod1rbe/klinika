export type Role =
  | "superadmin"
  | "direktor"
  | "registratura"
  | "shifokor"
  | "hisobchi"
  | "laborant"
  | "omborchi";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Platforma egasi",
  direktor: "Klinika rahbari",
  registratura: "Registratura",
  shifokor: "Shifokor",
  hisobchi: "Hisobchi / Kassa",
  laborant: "Laborant",
  omborchi: "Omborchi",
};

// Direktor xodim qo'shishda tanlay oladigan rollar
export const STAFF_ROLES: Role[] = [
  "direktor",
  "registratura",
  "shifokor",
  "hisobchi",
  "laborant",
  "omborchi",
];

// 3-bo'lim: bemor holati zanjiri. Shifokor faqat TOLANDI va undan keyingi
// bosqichdagi qabullarni ko'radi (status index >= TOLANDI).
export const STATUS_FLOW = [
  "ROYXATDA",
  "TOLOV_KUTILMOQDA",
  "TOLANDI",
  "NAVBATDA",
  "QABULDA",
  "YAKUNLANDI",
] as const;

export type AppointmentStatus = (typeof STATUS_FLOW)[number] | "BEKOR";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  ROYXATDA: "Ro'yxatga olindi",
  TOLOV_KUTILMOQDA: "To'lov kutilmoqda",
  TOLANDI: "To'landi",
  NAVBATDA: "Navbatda",
  QABULDA: "Qabulda",
  YAKUNLANDI: "Yakunlandi",
  BEKOR: "Bekor qilindi",
};

export function statusRank(s: AppointmentStatus): number {
  return s === "BEKOR" ? -1 : STATUS_FLOW.indexOf(s);
}

export const PAID_RANK = STATUS_FLOW.indexOf("TOLANDI");

export interface Patient {
  id: string; // ichki ID: P-2026-000xxx
  fullName: string;
  birthDate: string;
  gender: "Erkak" | "Ayol";
  phone: string;
  address: string;
  passport?: string;
  pinfl?: string;
  allergies: string[];
  chronic: string[];
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  department: string;
  category: string;
  price: number;
  active: boolean;
}

// Registratsiya sahifasida kategoriyalar shu tartibda chiqadi
export const CATEGORY_ORDER = [
  "Ko'rik va konsultatsiya",
  "Muolajalar",
  "LOR amaliyotlari",
  "Klinik tahlil",
  "Ekspress-test",
  "Koagulogramma",
  "Bioximik tahlil",
  "Revmoproba",
  "SPID-markaz",
  "Statsionar",
];

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  room: string;
  active: boolean;
}

export type PaymentMethod = "Naqd" | "Click" | "Payme" | "Uzum" | "Karta (POS)";

// Qabul tarkibidagi bitta xizmat — narx snapshoti bilan
// (narxnoma keyin o'zgarsa ham to'lov tarixi buzilmaydi)
export interface AppointmentItem {
  serviceId: string;
  price: number; // birlik narxi
  qty?: number; // miqdor (statsionar kunlari); yo'q bo'lsa 1
}

export const itemTotal = (it: AppointmentItem): number =>
  it.price * (it.qty ?? 1);

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  items: AppointmentItem[];
  queueNo?: number; // kunlik navbat raqami (chekda katta chiqadi)
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  complaint?: string;
  diagnosis?: string; // ICD-10 + nomi
  recommendation?: string;
}

export const apptTotal = (a: Appointment): number =>
  a.items.reduce((sum, it) => sum + itemTotal(it), 0);

// ============ MAHSULOT SAVDOSI (POS / OMBOR) ============

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  description: string;
  purchasePrice: number; // oxirgi kirim narxi
  avgCost: number; // o'rtacha tannarx (foyda hisobida ishlatiladi)
  sellPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  expiryDate?: string;
  supplierId?: string;
  active: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  notes: string;
  active: boolean;
}

export type PurchaseStatus = "QORALAMA" | "QABUL_QILINDI" | "BEKOR";

export interface PurchaseItem {
  id: string;
  productId: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  supplierId?: string;
  status: PurchaseStatus;
  note: string;
  total: number;
  paidAmount: number; // ta'minotchiga to'langan qism
  createdByName: string;
  createdAt: string;
  receivedAt?: string;
  items: PurchaseItem[];
}

export type SaleStatus = "TOLANDI" | "QISMAN_QAYTARILGAN" | "QAYTARILGAN";

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  TOLANDI: "To'landi",
  QISMAN_QAYTARILGAN: "Qisman qaytarilgan",
  QAYTARILGAN: "Qaytarilgan",
};

export interface SaleItemRec {
  id: string;
  productId: string;
  name: string; // nom snapshoti
  qty: number;
  unitPrice: number;
  costAtSale: number;
  lineTotal: number;
  refundedQty: number;
}

export interface SalePaymentRec {
  method: PaymentMethod;
  amount: number;
}

export interface SaleRec {
  id: string;
  saleNo: string;
  patientId?: string;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  total: number;
  date: string;
  time: string;
  cashierName: string;
  note: string;
  items: SaleItemRec[];
  payments: SalePaymentRec[];
}

export type MovementType =
  | "KIRIM"
  | "SOTUV"
  | "QAYTARISH"
  | "CHIQIM"
  | "TUZATISH"
  | "TAMINOTCHI_QAYTARISH";

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  KIRIM: "Kirim",
  SOTUV: "Sotuv",
  QAYTARISH: "Mijoz qaytardi",
  CHIQIM: "Hisobdan chiqarish",
  TUZATISH: "Tuzatish",
  TAMINOTCHI_QAYTARISH: "Ta'minotchiga qaytarish",
};

export interface InventoryMovement {
  id: number;
  productId: string;
  type: MovementType;
  qtyChange: number;
  stockBefore: number;
  stockAfter: number;
  refTable: string;
  refId: string;
  reason: string;
  createdByName: string;
  createdAt: string;
}

export interface RefundRec {
  id: string;
  saleId: string;
  amount: number;
  reason: string;
  createdByName: string;
  date: string;
  time: string;
}

// Sotuvdan qaytarilmagan (haqiqiy) summa
export const saleNet = (s: SaleRec, refunds: RefundRec[]): number =>
  s.total - refunds.filter((r) => r.saleId === s.id).reduce((a, r) => a + r.amount, 0);

// Tushumga kiradigan qabul: to'langan VA bekor qilinmagan.
// Bekor qilingan (qaytarilgan) to'lovlar tushum/Z-hisobotga KIRMAYDI.
export const isRevenue = (a: Appointment): boolean =>
  !!a.paidAt && a.status !== "BEKOR";

// To'langan, keyin bekor qilingan — "qaytarilgan" sifatida alohida ko'rsatiladi
export const isRefunded = (a: Appointment): boolean =>
  !!a.paidAt && a.status === "BEKOR";

export interface LabOrder {
  id: string;
  patientId: string;
  doctorId: string;
  test: string;
  unit: string;
  normMin: number;
  normMax: number;
  result?: number;
  status: "KUTILMOQDA" | "TAYYOR";
  orderedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  branch: string;
  salaryBase: number;
  kpiPercent: number; // jalb qilingan tushumdan foiz
  licenseUntil?: string;
  todayIn?: string;
  todayOut?: string;
}
