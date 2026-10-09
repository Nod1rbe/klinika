// Termal chek (XPrinter 58mm) — brauzer print oqimi orqali.
// window.open sinxron chaqiriladi (popup-bloker uchun), QR tayyor bo'lgach yoziladi.
import QRCode from "qrcode";
import { CLINIC } from "./config";
import { t } from "./i18n";

export interface ReceiptClinic {
  name: string;
  address: string;
  phone: string;
  mapsUrl: string;
}

export interface ReceiptData {
  queueNo?: number;
  saleNo?: string; // POS sotuv cheki raqami
  patientName: string;
  doctorName: string; // POS'da bo'sh bo'lishi mumkin
  items: { name: string; price: number; qty?: number }[];
  total: number;
  method?: string;
  date: string;
  time: string;
  clinic?: ReceiptClinic; // klinikaning o'z rekvizitlari (SaaS); bo'lmasa CLINIC fallback
}

const money = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");

// Popup-bloker chetlab o'tish: oynani click hodisasida SINXRON oching (async
// amaldan OLDIN), ma'lumot tayyor bo'lgach renderReceiptInto bilan to'ldiring.
export function openReceiptWindow(): Window | null {
  const w = window.open("", "_blank", "width=420,height=700");
  if (w) {
    w.document.write(
      `<p style="font-family:sans-serif;padding:16px;color:#555">${t("Chek tayyorlanmoqda...")}</p>`,
    );
  }
  return w;
}

export function renderReceiptInto(w: Window, r: ReceiptData): void {
  QRCode.toDataURL(r.clinic?.mapsUrl || CLINIC.mapsUrl, { margin: 0, width: 168 })
    .then((qr) => {
      w.document.open();
      w.document.write(buildHtml(r, qr));
      w.document.close();
    })
    .catch(() => {
      w.document.open();
      w.document.write(buildHtml(r, null));
      w.document.close();
    });
}

// Tayyor ma'lumot bilan darhol chop etish (qayta chiqarish tugmalari uchun)
export function printReceipt(r: ReceiptData): void {
  const w = openReceiptWindow();
  if (!w) {
    alert("Chek oynasi ochilmadi — brauzerda popup'ga ruxsat bering");
    return;
  }
  renderReceiptInto(w, r);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(r: ReceiptData, qrDataUrl: string | null): string {
  const rows = r.items
    .map((it) => {
      const qty = it.qty ?? 1;
      const label = qty !== 1 ? `${it.name} x${qty}` : it.name;
      return `
      <tr>
        <td class="nm">${esc(label)}</td>
        <td class="pr">${money(Math.round(it.price * qty))}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Chek — ${esc(r.patientName)}</title>
<style>
  @page { size: 58mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 58mm;
    padding: 2mm 3mm 4mm;
    font-family: "Courier New", monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .clinic { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
  .sub { font-size: 9px; }
  .hr { border-top: 1px dashed #000; margin: 4px 0; }
  .queue-label { font-size: 10px; margin-top: 2px; }
  .queue { font-size: 42px; font-weight: bold; line-height: 1.05; }
  .kv { display: flex; justify-content: space-between; gap: 6px; margin: 1px 0; }
  .kv b { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  td.nm { padding-right: 4px; }
  td.pr { text-align: right; white-space: nowrap; }
  .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 2px; }
  .qr { margin-top: 5px; }
  .qr img { width: 42mm; height: 42mm; }
  .footer { font-size: 9px; margin-top: 3px; }
  .noprint { margin-top: 10px; }
  .noprint button {
    width: 100%; padding: 8px; font-size: 13px; cursor: pointer;
    border: 1px solid #888; border-radius: 6px; background: #f5f5f5;
  }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
  <div class="center">
    <div class="clinic">${esc(r.clinic?.name || CLINIC.name)}</div>
    <div class="sub">${esc(r.clinic?.address || CLINIC.address)} · ${esc(r.clinic?.phone || CLINIC.phone)}</div>
  </div>
  <div class="hr"></div>
  ${
    r.queueNo !== undefined
      ? `<div class="center">
          <div class="queue-label">${esc(t("NAVBAT"))}</div>
          <div class="queue">${r.queueNo}</div>
        </div>
        <div class="hr"></div>`
      : ""
  }
  ${r.saleNo ? `<div class="kv"><span>${esc(t("Chek"))}:</span><b>${esc(r.saleNo)}</b></div>` : ""}
  <div class="kv"><span>${esc(t("Sana"))}:</span><b>${esc(r.date)} ${esc(r.time)}</b></div>
  ${r.patientName ? `<div class="kv"><span>${esc(r.saleNo ? t("Mijoz") : t("Bemor"))}:</span><b>${esc(r.patientName)}</b></div>` : ""}
  ${r.doctorName ? `<div class="kv"><span>${esc(t("Shifokor"))}:</span><b>${esc(r.doctorName)}</b></div>` : ""}
  <div class="hr"></div>
  <table>${rows}</table>
  <div class="hr"></div>
  <div class="total"><span>${esc(t("JAMI"))}:</span><span>${money(r.total)} ${esc(t("so'm"))}</span></div>
  ${r.method ? `<div class="kv"><span>${esc(t("To'lov usuli"))}:</span><b>${esc(r.method)}</b></div>` : ""}
  ${
    qrDataUrl
      ? `<div class="center qr">
          <img src="${qrDataUrl}" alt="QR">
          <div class="sub">${esc(t("Manzilimiz — QR kodni skanerlang"))}</div>
        </div>`
      : ""
  }
  <div class="center footer">${esc(t("Sog'lik tilaymiz!"))}</div>
  <div class="noprint">
    <button onclick="window.print()">${esc(t("Qayta chop etish"))}</button>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;
}
