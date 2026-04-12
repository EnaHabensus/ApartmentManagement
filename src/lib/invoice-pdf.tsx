// ── Invoice PDF generator — pdf-lib standard fonts (no fontkit, works everywhere) ──
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  navy:   rgb( 15/255,  37/255,  68/255),   // #0F2544
  blue:   rgb( 37/255,  99/255, 235/255),   // #2563EB
  blueL:  rgb(147/255, 197/255, 253/255),   // #93C5FD
  slate:  rgb(100/255, 116/255, 139/255),   // #64748B
  slateL: rgb(148/255, 163/255, 184/255),   // #94A3B8
  border: rgb(226/255, 232/255, 240/255),   // #E2E8F0
  bg:     rgb(248/255, 250/255, 252/255),   // #F8FAFC
  white:  rgb(1, 1, 1),
  text:   rgb( 15/255,  23/255,  42/255),   // #0F172A
  mid:    rgb( 51/255,  65/255,  85/255),   // #334155
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// Helvetica uses WinAnsiEncoding — transliterate Croatian diacritics to ASCII.
function tr(s: string): string {
  return s
    .replace(/[ćč]/g, 'c').replace(/[ĆČ]/g, 'C')
    .replace(/š/g, 's').replace(/Š/g, 'S')
    .replace(/ž/g, 'z').replace(/Ž/g, 'Z')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}.`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '- EUR';
  return `${new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} EUR`;
}

const PAYMENT_LABELS: Record<string, string> = {
  credit_card:   'Kreditna kartica / Credit card',
  cash:          'Gotovina / Cash',
  bank_transfer: 'Bankovni transfer / Bank transfer',
  airbnb:        'Airbnb',
  booking_com:   'Booking.com',
};

// ── Data shape ────────────────────────────────────────────────────────────────
export interface InvoiceData {
  invoiceNumberDisplay: string;
  generatedAt:      string;
  apartmentName:    string;
  ownerName:        string;
  ownerOib:         string;
  ownerAddress:     string;
  ownerPostalCode:  string;
  ownerCity:        string;
  ownerCountry:     string;
  guestName:        string;
  checkIn:          string;
  checkOut:         string;
  numNights:        number;
  numGuests:        number;
  amountGross:      number | null;
  paymentType:      string | null;
}

// ── Generator ─────────────────────────────────────────────────────────────────
export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const pad = 40;

  // Standard PDF fonts — built into every PDF viewer, no embedding needed.
  // Helvetica = regular/semibold labels, HelveticaBold = headings/totals.
  const fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Footer (drawn first so body draws on top if needed) ───────────────────
  const footerH = 80;
  page.drawRectangle({ x: 0, y: 0, width, height: footerH, color: C.bg });
  page.drawLine({
    start: { x: 0, y: footerH }, end: { x: width, y: footerH },
    thickness: 1, color: C.border,
  });

  const gd = new Date(data.generatedAt);
  const dateStr = `${String(gd.getDate()).padStart(2, '0')}. ${String(gd.getMonth() + 1).padStart(2, '0')}. ${gd.getFullYear()}. ${String(gd.getHours()).padStart(2, '0')}:${String(gd.getMinutes()).padStart(2, '0')}`;

  page.drawText(`Datum / Date: ${dateStr}`, {
    x: pad, y: footerH - 16, size: 9, font: fB, color: C.mid,
  });
  page.drawText(
    'PDV nije uracunat u cijenu temeljem cl. 90, st. 2 Zakona o PDV-u /',
    { x: pad, y: footerH - 30, size: 7, font: fR, color: C.slateL }
  );
  page.drawText(
    'VAT is not included in the price according to Art. 90, paragraph 2 of the VAT Law',
    { x: pad, y: footerH - 40, size: 7, font: fR, color: C.slateL }
  );
  page.drawText(
    'Turisticka pristojba ukljucena je u cijenu / Tourist tax included in the price of service',
    { x: pad, y: footerH - 52, size: 7, font: fR, color: C.slateL }
  );

  // ── Header band ──────────────────────────────────────────────────────────────
  const headerH = 80;
  const headerY = height - headerH;
  page.drawRectangle({ x: 0, y: headerY, width, height: headerH, color: C.navy });

  page.drawText(tr(data.apartmentName), {
    x: pad, y: headerY + 46, size: 14, font: fB, color: C.white,
  });
  page.drawText('Iznajmljivanje apartmana', {
    x: pad, y: headerY + 30, size: 8, font: fR, color: C.blueL,
  });

  const lblText = 'RACUN / INVOICE';
  const lblW = fR.widthOfTextAtSize(lblText, 9);
  page.drawText(lblText, {
    x: width - pad - lblW, y: headerY + 54, size: 9, font: fR, color: C.blueL,
  });

  const numText = `#${data.invoiceNumberDisplay}`;
  const numW = fB.widthOfTextAtSize(numText, 20);
  page.drawText(numText, {
    x: width - pad - numW, y: headerY + 24, size: 20, font: fB, color: C.white,
  });

  // ── Two-column info section ───────────────────────────────────────────────────
  const colL = pad;
  const colR = Math.floor(width / 2) + 10;
  let y = headerY - 28;

  page.drawText('IZNAJMLJIVAC / OWNER', { x: colL, y, size: 7, font: fB, color: C.slateL });
  page.drawText('GOST / GUEST',         { x: colR, y, size: 7, font: fB, color: C.slateL });
  y -= 16;

  page.drawText(tr(data.ownerName), { x: colL, y, size: 11, font: fB, color: C.text });
  page.drawText(tr(data.guestName), { x: colR, y, size: 11, font: fB, color: C.text });
  y -= 14;

  const row = (
    left: string | null, lf: typeof fR,
    right: string | null, rf: typeof fR,
    sz = 9,
  ) => {
    if (left)  page.drawText(tr(left),  { x: colL, y, size: sz, font: lf, color: C.mid });
    if (right) page.drawText(tr(right), { x: colR, y, size: sz, font: rf, color: C.mid });
    y -= 12;
  };

  row(`OIB / PIN: ${data.ownerOib}`,               fR, data.numGuests > 1 ? `${data.numGuests} gosta` : null, fR);
  row(data.ownerAddress,                            fR, 'Vrijeme boravka / Time of stay:',       fB);
  row(`${data.ownerPostalCode} ${data.ownerCity}`,  fR, `${fmtDate(data.checkIn)} - ${fmtDate(data.checkOut)}`, fR);
  row(data.ownerCountry,                            fR, 'Nacin placanja / Payment type:',         fB);
  row(null, fR, data.paymentType ? (PAYMENT_LABELS[data.paymentType] ?? data.paymentType) : '-', fR);

  y -= 12;

  page.drawLine({
    start: { x: pad, y }, end: { x: width - pad, y },
    thickness: 1, color: C.border,
  });
  y -= 16;

  // ── Table header ─────────────────────────────────────────────────────────────
  const thH = 28;
  page.drawRectangle({ x: pad, y: y - thH, width: width - pad * 2, height: thH, color: C.navy });

  const c1 = pad + 10;
  const c2 = pad + 155;
  const c3 = pad + 295;
  const c4 = pad + 340;
  const cR = width - pad - 10;
  const thY = y - thH + 10;

  page.drawText('Usluga / Service', { x: c1, y: thY, size: 8, font: fB, color: C.white });
  page.drawText('Jedinica / Unit',  { x: c2, y: thY, size: 8, font: fB, color: C.white });
  page.drawText('Kol.',             { x: c3, y: thY, size: 8, font: fB, color: C.white });
  page.drawText('Cijena / Price',   { x: c4, y: thY, size: 8, font: fB, color: C.white });
  const totHdr = 'Ukupno / Total';
  page.drawText(totHdr, {
    x: cR - fB.widthOfTextAtSize(totHdr, 8), y: thY, size: 8, font: fB, color: C.white,
  });
  y -= thH;

  // ── Table row ─────────────────────────────────────────────────────────────────
  const pricePN = data.amountGross != null && data.numNights > 0
    ? data.amountGross / data.numNights : null;
  const rY1 = y - 14;
  const rY2 = y - 25;

  page.drawText('Nocenje',         { x: c1, y: rY1, size: 9,   font: fB, color: C.text });
  page.drawText('/ Accommodation', { x: c1, y: rY2, size: 7.5, font: fR, color: C.slate });

  const aptDisp = tr(data.apartmentName.length > 18
    ? data.apartmentName.slice(0, 16) + '...' : data.apartmentName);
  page.drawText(aptDisp,               { x: c2, y: rY1, size: 9, font: fR, color: C.mid });
  page.drawText(String(data.numNights),{ x: c3, y: rY1, size: 9, font: fR, color: C.mid });
  page.drawText(pricePN != null ? fmtMoney(pricePN) : '-', { x: c4, y: rY1, size: 9, font: fR, color: C.mid });

  const totStr = fmtMoney(data.amountGross);
  page.drawText(totStr, {
    x: cR - fB.widthOfTextAtSize(totStr, 9), y: rY1, size: 9, font: fB, color: C.text,
  });

  y -= 36;
  page.drawLine({
    start: { x: pad, y }, end: { x: width - pad, y },
    thickness: 1, color: C.border,
  });
  y -= 12;

  // ── Summary ───────────────────────────────────────────────────────────────────
  const sumX = width - pad - 200;

  const sumV = fmtMoney(data.amountGross);
  page.drawText('Ukupna cijena / Total price', { x: sumX, y, size: 9, font: fR, color: C.slate });
  page.drawText(sumV, {
    x: width - pad - fR.widthOfTextAtSize(sumV, 9), y, size: 9, font: fR, color: C.mid,
  });
  y -= 14;

  page.drawLine({ start: { x: sumX, y }, end: { x: width - pad, y }, thickness: 1, color: C.border });
  y -= 10;

  page.drawRectangle({
    x: sumX - 14, y: y - 8, width: width - pad - (sumX - 14), height: 28, color: C.bg,
  });

  page.drawText('Ukupno / Total', { x: sumX, y: y + 2, size: 11, font: fB, color: C.navy });
  const grand = fmtMoney(data.amountGross);
  page.drawText(grand, {
    x: width - pad - fB.widthOfTextAtSize(grand, 11), y: y + 2, size: 11, font: fB, color: C.blue,
  });

  return pdfDoc.save();
}
