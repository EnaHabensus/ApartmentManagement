import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, Font, renderToBuffer,
} from '@react-pdf/renderer';
import { INTER_400, INTER_600, INTER_700 } from './invoice-fonts';

// ── Fonts (Inter latin-ext, embedded as base64 — no network needed) ───────────
Font.register({
  family: 'Inter',
  fonts: [
    { src: INTER_400, fontWeight: 400 },
    { src: INTER_600, fontWeight: 600 },
    { src: INTER_700, fontWeight: 700 },
  ],
});

// Disable automatic hyphenation
Font.registerHyphenationCallback((word) => [word]);

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  navy:    '#0F2544',
  navyMid: '#1D3A6B',
  blue:    '#2563EB',
  slate:   '#64748B',
  slateL:  '#94A3B8',
  border:  '#E2E8F0',
  bg:      '#F8FAFC',
  white:   '#FFFFFF',
  text:    '#0F172A',
  textMid: '#334155',
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 9,
    color: C.text,
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 56,
    paddingHorizontal: 0,
  },

  // ─ Header band ─────────────────────────────────────────────────────────────
  headerBand: {
    backgroundColor: C.navy,
    paddingHorizontal: 40,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerAptName: {
    fontWeight: 700,
    fontSize: 14,
    color: C.white,
    letterSpacing: 0.5,
  },
  headerAptSub: {
    fontSize: 8,
    color: '#93C5FD',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: '#93C5FD',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerNumber: {
    fontSize: 22,
    fontWeight: 700,
    color: C.white,
    marginTop: 2,
  },

  // ─ Body ────────────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
  },

  // ─ Two-column info section ──────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 28,
  },
  infoBlock: {
    flex: 1,
  },
  infoBlockRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: C.slateL,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoName: {
    fontSize: 11,
    fontWeight: 700,
    color: C.text,
    marginBottom: 4,
  },
  infoLine: {
    fontSize: 9,
    color: C.textMid,
    marginBottom: 2,
  },
  infoLabelInline: {
    fontWeight: 600,
    color: C.textMid,
  },

  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 24,
  },

  // ─ Table ───────────────────────────────────────────────────────────────────
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.navy,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 0,
  },
  tableHeadCell: {
    fontSize: 8,
    fontWeight: 700,
    color: C.white,
  },
  tableHeadCellSub: {
    fontSize: 7,
    fontWeight: 400,
    color: '#93C5FD',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 9.5,
    color: C.textMid,
  },
  tableCellBold: {
    fontSize: 9.5,
    fontWeight: 700,
    color: C.text,
  },

  // Column widths
  cService:  { flex: 3 },
  cUnit:     { flex: 2 },
  cQty:      { flex: 1, alignItems: 'center' },
  cPrice:    { flex: 2, alignItems: 'flex-end' },
  cTotal:    { flex: 2, alignItems: 'flex-end' },

  // ─ Summary ─────────────────────────────────────────────────────────────────
  summaryWrap: {
    marginTop: 12,
    alignItems: 'flex-end',
    marginBottom: 28,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    gap: 48,
  },
  summaryLabel: {
    fontSize: 9,
    color: C.slate,
    textAlign: 'right',
  },
  summaryValue: {
    fontSize: 9,
    color: C.textMid,
    textAlign: 'right',
    minWidth: 80,
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 8,
    marginTop: 4,
    width: 260,
    alignSelf: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 48,
    backgroundColor: C.bg,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: C.navy,
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 11,
    fontWeight: 700,
    color: C.blue,
    textAlign: 'right',
    minWidth: 80,
  },

  // ─ Footer ──────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  footerDate: {
    fontSize: 9,
    fontWeight: 600,
    color: C.textMid,
    marginBottom: 10,
  },
  footerNote: {
    fontSize: 7.5,
    color: C.slateL,
    marginBottom: 3,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}.`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '— EUR';
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
  generatedAt: string;
  // Apartment / owner
  apartmentName: string;
  ownerName: string;
  ownerOib: string;
  ownerAddress: string;
  ownerPostalCode: string;
  ownerCity: string;
  ownerCountry: string;
  // Reservation / guest
  guestName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  numGuests: number;
  amountGross: number | null;
  paymentType: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
const InvoiceDoc = ({ d }: { d: InvoiceData }) => {
  const pricePerNight = d.amountGross !== null && d.numNights > 0
    ? d.amountGross / d.numNights
    : null;

  const genDate = new Date(d.generatedAt);
  const genDateStr = `${String(genDate.getDate()).padStart(2, '0')}. ${String(genDate.getMonth() + 1).padStart(2, '0')}. ${genDate.getFullYear()}.`;
  const genTimeStr = `${String(genDate.getHours()).padStart(2, '0')}:${String(genDate.getMinutes()).padStart(2, '0')}`;

  const paymentLabel = d.paymentType ? (PAYMENT_LABELS[d.paymentType] ?? d.paymentType) : '—';

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Dark header band ───────────────────────────────────────────── */}
        <View style={s.headerBand}>
          <View>
            <Text style={s.headerAptName}>{d.apartmentName}</Text>
            <Text style={s.headerAptSub}>Iznajmljivanje apartmana</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>Račun / Invoice</Text>
            <Text style={s.headerNumber}>#{d.invoiceNumberDisplay}</Text>
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <View style={s.body}>

          {/* ── Two-column info ─────────────────────────────────────────── */}
          <View style={s.infoRow}>

            {/* Left: Owner */}
            <View style={s.infoBlock}>
              <Text style={s.infoLabel}>Iznajmljivač / Owner</Text>
              <Text style={s.infoName}>{d.ownerName}</Text>
              <Text style={s.infoLine}>
                <Text style={s.infoLabelInline}>OIB / PIN: </Text>
                {d.ownerOib}
              </Text>
              <Text style={s.infoLine}>{d.ownerAddress}</Text>
              <Text style={s.infoLine}>{d.ownerPostalCode} {d.ownerCity}</Text>
              <Text style={s.infoLine}>{d.ownerCountry}</Text>
            </View>

            {/* Right: Guest + stay */}
            <View style={s.infoBlockRight}>
              <Text style={s.infoLabel}>Gost / Guest</Text>
              <Text style={s.infoName}>{d.guestName}</Text>
              {d.numGuests > 1 && (
                <Text style={s.infoLine}>{d.numGuests} gosta</Text>
              )}
              <Text style={[s.infoLine, { marginTop: 8 }]}>
                <Text style={s.infoLabelInline}>Vrijeme boravka / Time of stay: </Text>
              </Text>
              <Text style={s.infoLine}>
                {fmtDate(d.checkIn)} - {fmtDate(d.checkOut)}
              </Text>
              <Text style={[s.infoLine, { marginTop: 6 }]}>
                <Text style={s.infoLabelInline}>Način plaćanja / Payment type: </Text>
              </Text>
              <Text style={s.infoLine}>{paymentLabel}</Text>
            </View>

          </View>

          <View style={s.divider} />

          {/* ── Table ───────────────────────────────────────────────────── */}
          <View style={s.tableHead}>
            <View style={s.cService}>
              <Text style={s.tableHeadCell}>Usluga</Text>
              <Text style={s.tableHeadCellSub}>/ Service</Text>
            </View>
            <View style={s.cUnit}>
              <Text style={s.tableHeadCell}>Jedinica</Text>
              <Text style={s.tableHeadCellSub}>/ Unit</Text>
            </View>
            <View style={[s.cQty, { alignItems: 'center' }]}>
              <Text style={s.tableHeadCell}>Kol.</Text>
              <Text style={s.tableHeadCellSub}>/ Qty</Text>
            </View>
            <View style={[s.cPrice, { alignItems: 'flex-end' }]}>
              <Text style={s.tableHeadCell}>Cijena</Text>
              <Text style={s.tableHeadCellSub}>/ Price</Text>
            </View>
            <View style={[s.cTotal, { alignItems: 'flex-end' }]}>
              <Text style={s.tableHeadCell}>Ukupno</Text>
              <Text style={s.tableHeadCellSub}>/ Total</Text>
            </View>
          </View>

          <View style={s.tableRow}>
            <View style={s.cService}>
              <Text style={s.tableCellBold}>Noćenje</Text>
              <Text style={[s.tableCell, { fontSize: 8, color: C.slate }]}>/ Accommodation</Text>
            </View>
            <View style={s.cUnit}>
              <Text style={s.tableCell}>{d.apartmentName}</Text>
            </View>
            <View style={[s.cQty, { alignItems: 'center' }]}>
              <Text style={s.tableCell}>{d.numNights}</Text>
            </View>
            <View style={[s.cPrice, { alignItems: 'flex-end' }]}>
              <Text style={s.tableCell}>
                {pricePerNight !== null ? fmtMoney(pricePerNight) : '—'}
              </Text>
            </View>
            <View style={[s.cTotal, { alignItems: 'flex-end' }]}>
              <Text style={s.tableCellBold}>{fmtMoney(d.amountGross)}</Text>
            </View>
          </View>

          {/* ── Summary ─────────────────────────────────────────────────── */}
          <View style={s.summaryWrap}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Ukupna cijena / Total price</Text>
              <Text style={s.summaryValue}>{fmtMoney(d.amountGross)}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Ukupno / Total</Text>
              <Text style={s.totalValue}>{fmtMoney(d.amountGross)}</Text>
            </View>
          </View>

        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerDate}>
            Datum / Date: {genDateStr} {genTimeStr}
          </Text>
          <Text style={s.footerNote}>
            PDV nije uračunat u cijenu temeljem čl. 90, st. 2 Zakona o PDV-u / VAT is not included in the price according to Art. 90, paragraph 2 of the VAT Law
          </Text>
          <Text style={s.footerNote}>
            Turistička pristojba uključena je u cijenu / Tourist tax included in the price of service
          </Text>
        </View>

      </Page>
    </Document>
  );
};

// ── Export ────────────────────────────────────────────────────────────────────
export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return await renderToBuffer(React.createElement(InvoiceDoc, { d: data }));
}
