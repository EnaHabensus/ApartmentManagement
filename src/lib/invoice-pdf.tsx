// ── Invoice PDF generator — pdf-lib (pure JS, no WASM, works on Cloudflare Workers) ──
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { inflateRawSync } from 'fflate';
import { INTER_400, INTER_600, INTER_700 } from './invoice-fonts';

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
function dataUriToBytes(uri: string): Uint8Array {
  const b64 = uri.split(',')[1];
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Convert WOFF1 to raw TrueType/OpenType binary.
 * fontkit can parse TTF directly without needing Node.js zlib, which may
 * not be fully available in Cloudflare Workers even with nodejs_compat.
 * We decompress the WOFF table data ourselves using fflate (pure JS).
 */
function woff1ToTtf(woff: Uint8Array): Uint8Array {
  const v = new DataView(woff.buffer, woff.byteOffset);
  if (v.getUint32(0) !== 0x774F4646) throw new Error('Not a WOFF1 file');

  const sfVersion = v.getUint32(4);
  const n         = v.getUint16(12);

  type Entry = { tag: number; checksum: number; origLength: number; data: Uint8Array };
  const tables: Entry[] = [];
  let p = 44;

  for (let i = 0; i < n; i++) {
    const tag      = v.getUint32(p);
    const off      = v.getUint32(p + 4);
    const compLen  = v.getUint32(p + 8);
    const origLen  = v.getUint32(p + 12);
    const checksum = v.getUint32(p + 16);
    p += 20;

    const raw = woff.subarray(off, off + compLen);
    let data: Uint8Array = compLen < origLen
      ? inflateRawSync(raw)          // decompress with fflate (pure JS)
      : new Uint8Array(raw);         // already uncompressed

    // Pad each table to 4-byte boundary (required by TrueType spec)
    if (data.length % 4 !== 0) {
      const padded = new Uint8Array((data.length + 3) & ~3);
      padded.set(data);
      data = padded;
    }

    tables.push({ tag, checksum, origLength: origLen, data });
  }

  // Build TrueType binary
  const log2n       = Math.floor(Math.log2(n));
  const searchRange = (1 << log2n) * 16;
  const entrySelector = log2n;
  const rangeShift  = n * 16 - searchRange;

  const dirEnd = 12 + n * 16;
  const offsets: number[] = [];
  let totalSize = dirEnd;
  for (const t of tables) { offsets.push(totalSize); totalSize += t.data.length; }

  const out = new Uint8Array(totalSize);
  const ov  = new DataView(out.buffer);

  ov.setUint32(0, sfVersion);
  ov.setUint16(4, n);
  ov.setUint16(6, searchRange);
  ov.setUint16(8, entrySelector);
  ov.setUint16(10, rangeShift);

  let rec = 12;
  for (let i = 0; i < n; i++) {
    const t = tables[i];
    ov.setUint32(rec,      t.tag);        rec += 4;
    ov.setUint32(rec,      t.checksum);   rec += 4;
    ov.setUint32(rec,      offsets[i]);   rec += 4;
    ov.setUint32(rec,      t.origLength); rec += 4;
    out.set(t.data, offsets[i]);
  }

  return out;
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

  // Register fontkit so pdf-lib can embed custom (non-standard) fonts
  pdfDoc.registerFontkit(fontkit);

  // Decode base64 WOFF1 → raw TTF using our pure-JS converter, then embed
  const f4 = await pdfDoc.embedFont(woff1ToTtf(dataUriToBytes(INTER_400)));
  const f6 = await pdfDoc.embedFont(woff1ToTtf(dataUriToBytes(INTER_600)));
  const f7 = await pdfDoc.embedFont(woff1ToTtf(dataUriToBytes(INTER_700)));

  // ── Footer (drawn first so body draws on top if overlap ever occurs) ──────
  const footerH = 80;
  page.drawRectangle({ x: 0, y: 0, width, height: footerH, color: C.bg });
  page.drawLine({
    start: { x: 0, y: footerH }, end: { x: width, y: footerH },
    thickness: 1, color: C.border,
  });

  const gd = new Date(data.generatedAt);
  const dateStr = `${String(gd.getDate()).padStart(2, '0')}. ${String(gd.getMonth() + 1).padStart(2, '0')}. ${gd.getFullYear()}. ${String(gd.getHours()).padStart(2, '0')}:${String(gd.getMinutes()).padStart(2, '0')}`;

  page.drawText(`Datum / Date: ${dateStr}`, {
    x: pad, y: footerH - 16, size: 9, font: f6, color: C.mid,
  });
  page.drawText(
    'PDV nije uracunat u cijenu temeljem cl. 90, st. 2 Zakona o PDV-u /',
    { x: pad, y: footerH - 30, size: 7, font: f4, color: C.slateL }
  );
  page.drawText(
    'VAT is not included in the price according to Art. 90, paragraph 2 of the VAT Law',
    { x: pad, y: footerH - 40, size: 7, font: f4, color: C.slateL }
  );
  page.drawText(
    'Turisticka pristojba ukljucena je u cijenu / Tourist tax included in the price of service',
    { x: pad, y: footerH - 52, size: 7, font: f4, color: C.slateL }
  );

  // ── Header band ──────────────────────────────────────────────────────────────
  const headerH = 80;
  const headerY = height - headerH;  // 762
  page.drawRectangle({ x: 0, y: headerY, width, height: headerH, color: C.navy });

  page.drawText(data.apartmentName, {
    x: pad, y: headerY + 46, size: 14, font: f7, color: C.white,
  });
  page.drawText('Iznajmljivanje apartmana', {
    x: pad, y: headerY + 30, size: 8, font: f4, color: C.blueL,
  });

  const lblText = 'RACUN / INVOICE';
  const lblW = f4.widthOfTextAtSize(lblText, 9);
  page.drawText(lblText, {
    x: width - pad - lblW, y: headerY + 54, size: 9, font: f4, color: C.blueL,
  });

  const numText = `#${data.invoiceNumberDisplay}`;
  const numW = f7.widthOfTextAtSize(numText, 20);
  page.drawText(numText, {
    x: width - pad - numW, y: headerY + 24, size: 20, font: f7, color: C.white,
  });

  // ── Two-column info section ───────────────────────────────────────────────────
  const colL = pad;
  const colR = Math.floor(width / 2) + 10;
  let y = headerY - 28;  // 734

  page.drawText('IZNAJMLJIVAC / OWNER', { x: colL, y, size: 7, font: f6, color: C.slateL });
  page.drawText('GOST / GUEST',         { x: colR, y, size: 7, font: f6, color: C.slateL });
  y -= 16;

  page.drawText(data.ownerName, { x: colL, y, size: 11, font: f7, color: C.text });
  page.drawText(data.guestName, { x: colR, y, size: 11, font: f7, color: C.text });
  y -= 14;

  // Helper: draw one row on both columns and advance y by 12
  const row = (
    left: string | null, lf: typeof f4,
    right: string | null, rf: typeof f4,
    sz = 9,
  ) => {
    if (left)  page.drawText(left,  { x: colL, y, size: sz, font: lf, color: C.mid });
    if (right) page.drawText(right, { x: colR, y, size: sz, font: rf, color: C.mid });
    y -= 12;
  };

  row(`OIB / PIN: ${data.ownerOib}`,               f4, data.numGuests > 1 ? `${data.numGuests} gosta` : null, f4);
  row(data.ownerAddress,                            f4, 'Vrijeme boravka / Time of stay:',       f6);
  row(`${data.ownerPostalCode} ${data.ownerCity}`,  f4, `${fmtDate(data.checkIn)} - ${fmtDate(data.checkOut)}`, f4);
  row(data.ownerCountry,                            f4, 'Nacin placanja / Payment type:',         f6);
  row(null, f4, data.paymentType ? (PAYMENT_LABELS[data.paymentType] ?? data.paymentType) : '-', f4);

  y -= 12;

  // Divider
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

  page.drawText('Usluga / Service', { x: c1, y: thY, size: 8, font: f7, color: C.white });
  page.drawText('Jedinica / Unit',  { x: c2, y: thY, size: 8, font: f7, color: C.white });
  page.drawText('Kol.',             { x: c3, y: thY, size: 8, font: f7, color: C.white });
  page.drawText('Cijena / Price',   { x: c4, y: thY, size: 8, font: f7, color: C.white });
  const totHdr = 'Ukupno / Total';
  page.drawText(totHdr, {
    x: cR - f7.widthOfTextAtSize(totHdr, 8), y: thY, size: 8, font: f7, color: C.white,
  });
  y -= thH;

  // ── Table row ─────────────────────────────────────────────────────────────────
  const pricePN = data.amountGross != null && data.numNights > 0
    ? data.amountGross / data.numNights : null;
  const rY1 = y - 14;
  const rY2 = y - 25;

  page.drawText('Nocenje',         { x: c1, y: rY1, size: 9,   font: f7, color: C.text });
  page.drawText('/ Accommodation', { x: c1, y: rY2, size: 7.5, font: f4, color: C.slate });

  const aptDisp = data.apartmentName.length > 18
    ? data.apartmentName.slice(0, 16) + '...' : data.apartmentName;
  page.drawText(aptDisp,               { x: c2, y: rY1, size: 9, font: f4, color: C.mid });
  page.drawText(String(data.numNights),{ x: c3, y: rY1, size: 9, font: f4, color: C.mid });
  page.drawText(pricePN != null ? fmtMoney(pricePN) : '-', { x: c4, y: rY1, size: 9, font: f4, color: C.mid });

  const totStr = fmtMoney(data.amountGross);
  page.drawText(totStr, {
    x: cR - f7.widthOfTextAtSize(totStr, 9), y: rY1, size: 9, font: f7, color: C.text,
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
  page.drawText('Ukupna cijena / Total price', { x: sumX, y, size: 9, font: f4, color: C.slate });
  page.drawText(sumV, {
    x: width - pad - f4.widthOfTextAtSize(sumV, 9), y, size: 9, font: f4, color: C.mid,
  });
  y -= 14;

  page.drawLine({ start: { x: sumX, y }, end: { x: width - pad, y }, thickness: 1, color: C.border });
  y -= 10;

  // Total highlight box
  page.drawRectangle({
    x: sumX - 14, y: y - 8, width: width - pad - (sumX - 14), height: 28, color: C.bg,
  });

  page.drawText('Ukupno / Total', { x: sumX, y: y + 2, size: 11, font: f7, color: C.navy });
  const grand = fmtMoney(data.amountGross);
  page.drawText(grand, {
    x: width - pad - f7.widthOfTextAtSize(grand, 11), y: y + 2, size: 11, font: f7, color: C.blue,
  });

  return pdfDoc.save();
}
