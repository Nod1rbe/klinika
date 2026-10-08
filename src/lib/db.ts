// Supabase qator (snake_case) <-> frontend tip (camelCase) mapperlari
import type {
  Appointment,
  Doctor,
  Employee,
  LabOrder,
  Patient,
  Service,
} from "../types";

// Pilot bosqichida bitta tenant (TZ 5-bo'lim: kod boshidanoq tenant_id bilan yoziladi)
export const TENANT_ID = "t1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export const mapPatient = (r: Row): Patient => ({
  id: r.id,
  fullName: r.full_name,
  birthDate: r.birth_date,
  gender: r.gender,
  phone: r.phone,
  address: r.address,
  passport: r.passport ?? undefined,
  pinfl: r.pinfl ?? undefined,
  allergies: r.allergies ?? [],
  chronic: r.chronic ?? [],
  createdAt: r.created_at,
});

// Yangi bemor: id va created_at bazada beriladi (default'lar)
export const newPatientRow = (
  p: Omit<Patient, "id" | "createdAt">,
  tenantId: string,
): Row => ({
  tenant_id: tenantId,
  full_name: p.fullName,
  birth_date: p.birthDate,
  gender: p.gender,
  phone: p.phone,
  address: p.address,
  passport: p.passport ?? null,
  pinfl: p.pinfl ?? null,
  allergies: p.allergies,
  chronic: p.chronic,
});

// items alohida jadvaldan (appointment_services) keladi — store'da biriktiriladi
export const mapAppointment = (
  r: Row,
  items: { serviceId: string; price: number }[],
): Appointment => ({
  id: r.id,
  patientId: r.patient_id,
  doctorId: r.doctor_id,
  items,
  queueNo: r.queue_no ?? undefined,
  date: r.date,
  time: r.time,
  status: r.status,
  paymentMethod: r.payment_method ?? undefined,
  paidAt: r.paid_at ?? undefined,
  complaint: r.complaint ?? undefined,
  diagnosis: r.diagnosis ?? undefined,
  recommendation: r.recommendation ?? undefined,
});

export const appointmentToRow = (a: Appointment): Row => ({
  id: a.id,
  tenant_id: TENANT_ID,
  patient_id: a.patientId,
  doctor_id: a.doctorId,
  service_id: null,
  queue_no: a.queueNo ?? null,
  date: a.date,
  time: a.time,
  status: a.status,
  payment_method: a.paymentMethod ?? null,
  paid_at: a.paidAt ?? null,
  complaint: a.complaint ?? null,
  diagnosis: a.diagnosis ?? null,
  recommendation: a.recommendation ?? null,
});

export const appointmentItemRows = (a: Appointment): Row[] =>
  a.items.map((it) => ({
    tenant_id: TENANT_ID,
    appointment_id: a.id,
    service_id: it.serviceId,
    price: it.price,
  }));

export const mapLabOrder = (r: Row): LabOrder => ({
  id: r.id,
  patientId: r.patient_id,
  doctorId: r.doctor_id,
  test: r.test,
  unit: r.unit,
  normMin: Number(r.norm_min),
  normMax: Number(r.norm_max),
  result: r.result === null ? undefined : Number(r.result),
  status: r.status,
  orderedAt: r.ordered_at,
});

export const mapDoctor = (r: Row): Doctor => ({
  id: r.id,
  name: r.name,
  specialty: r.specialty,
  room: r.room ?? "",
  active: r.active ?? true,
});

export const mapService = (r: Row): Service => ({
  id: r.id,
  name: r.name,
  department: r.department,
  category: r.category ?? "",
  price: Number(r.price),
  active: r.active ?? true,
});

export const mapProduct = (r: Row): import("../types").Product => ({
  id: r.id,
  name: r.name,
  sku: r.sku ?? "",
  barcode: r.barcode ?? "",
  category: r.category ?? "",
  description: r.description ?? "",
  purchasePrice: Number(r.purchase_price ?? 0),
  avgCost: Number(r.avg_cost ?? 0),
  sellPrice: Number(r.sell_price ?? 0),
  stock: Number(r.stock ?? 0),
  minStock: Number(r.min_stock ?? 0),
  unit: r.unit ?? "dona",
  expiryDate: r.expiry_date ?? undefined,
  supplierId: r.supplier_id ?? undefined,
  active: r.active ?? true,
});

export const mapSupplier = (r: Row): import("../types").Supplier => ({
  id: r.id,
  name: r.name,
  contactPerson: r.contact_person ?? "",
  phone: r.phone ?? "",
  address: r.address ?? "",
  notes: r.notes ?? "",
  active: r.active ?? true,
});

export const mapPurchase = (r: Row): import("../types").Purchase => ({
  id: r.id,
  supplierId: r.supplier_id ?? undefined,
  status: r.status,
  note: r.note ?? "",
  total: Number(r.total ?? 0),
  paidAmount: Number(r.paid_amount ?? 0),
  createdByName: r.created_by_name ?? "",
  createdAt: r.created_at ?? "",
  receivedAt: r.received_at ?? undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: (r.purchase_items ?? []).map((it: any) => ({
    id: it.id,
    productId: it.product_id,
    qty: Number(it.qty),
    unitCost: Number(it.unit_cost),
    lineTotal: Number(it.line_total ?? 0),
  })),
});

export const mapSale = (r: Row): import("../types").SaleRec => ({
  id: r.id,
  saleNo: r.sale_no,
  patientId: r.patient_id ?? undefined,
  status: r.status,
  subtotal: Number(r.subtotal ?? 0),
  discount: Number(r.discount ?? 0),
  total: Number(r.total ?? 0),
  date: r.date,
  time: r.time ?? "",
  cashierName: r.cashier_name ?? "",
  note: r.note ?? "",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: (r.sale_items ?? []).map((it: any) => ({
    id: it.id,
    productId: it.product_id,
    name: it.name,
    qty: Number(it.qty),
    unitPrice: Number(it.unit_price),
    costAtSale: Number(it.cost_at_sale ?? 0),
    lineTotal: Number(it.line_total ?? 0),
    refundedQty: Number(it.refunded_qty ?? 0),
  })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payments: (r.sale_payments ?? []).map((p: any) => ({
    method: p.method,
    amount: Number(p.amount),
  })),
});

export const mapMovement = (r: Row): import("../types").InventoryMovement => ({
  id: Number(r.id),
  productId: r.product_id,
  type: r.type,
  qtyChange: Number(r.qty_change),
  stockBefore: Number(r.stock_before),
  stockAfter: Number(r.stock_after),
  refTable: r.ref_table ?? "",
  refId: r.ref_id ?? "",
  reason: r.reason ?? "",
  createdByName: r.created_by_name ?? "",
  createdAt: r.created_at ?? "",
});

export const mapRefund = (r: Row): import("../types").RefundRec => ({
  id: r.id,
  saleId: r.sale_id,
  amount: Number(r.amount ?? 0),
  reason: r.reason ?? "",
  createdByName: r.created_by_name ?? "",
  date: r.date ?? "",
  time: r.time ?? "",
});

export const mapEmployee = (r: Row): Employee => ({
  id: r.id,
  name: r.name,
  position: r.position,
  branch: r.branch,
  salaryBase: Number(r.salary_base),
  kpiPercent: r.kpi_percent,
  licenseUntil: r.license_until ?? undefined,
  todayIn: r.today_in ?? undefined,
  todayOut: r.today_out ?? undefined,
});
