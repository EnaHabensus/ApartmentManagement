import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// ─── Tipovi ───────────────────────────────────────────────────────────────────

export interface InvoicePDFProps {
  invoice: {
    invoice_number_display: string;
    generated_at: string;
  };
  apartment: {
    name: string;
    owner_name: string;
    owner_oib: string;
    owner_address: string;
    owner_postal_code: string;
    owner_city: string;
    owner_country: string;
  };
  reservation: {
    guest_name: string;
    check_in: string;
    check_out: string;
    amount_gross: number;
    payment_type: string;
  };
}

// ─── Pomoćne funkcije ─────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  // YYYY-MM-DD → DD.MM.YYYY
  const parts = isoDate.slice(0, 10).split('-');
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function formatDateTime(isoDate: string): string {
  // ISO string → DD. MM. YYYY. HH:MM
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}. ${mm}. ${yyyy}. ${hh}:${min}`;
}

function countNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn.slice(0, 10));
  const outDate = new Date(checkOut.slice(0, 10));
  const diffMs = outDate.getTime() - inDate.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  credit_card: 'Kartica / Credit card',
  cash: 'Gotovina / Cash',
  bank_transfer: 'Bankovni prijenos / Bank transfer',
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
};

// ─── Stilovi ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    color: '#1a1a1a',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  labelCell: {
    width: '38%',
    color: '#555555',
  },
  valueCell: {
    width: '62%',
    fontFamily: 'Helvetica-Bold',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginVertical: 12,
  },
  // Tablica
  table: {
    marginTop: 12,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  colDescription: {
    width: '44%',
  },
  colUnit: {
    width: '12%',
    textAlign: 'center',
  },
  colUnitPrice: {
    width: '22%',
    textAlign: 'right',
  },
  colTotal: {
    width: '22%',
    textAlign: 'right',
  },
  tableHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#374151',
  },
  // Ukupno
  totalSection: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  totalLabel: {
    width: 180,
    textAlign: 'right',
    paddingRight: 8,
    color: '#555555',
  },
  totalValue: {
    width: 90,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalLabel: {
    width: 180,
    textAlign: 'right',
    paddingRight: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  grandTotalValue: {
    width: 90,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
  },
  // Datum
  dateRow: {
    marginTop: 16,
    fontSize: 9,
    color: '#555555',
  },
  // Napomene
  noteSection: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  noteText: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 4,
  },
});

// ─── Komponenta ───────────────────────────────────────────────────────────────

export function InvoicePDF({ invoice, apartment, reservation }: InvoicePDFProps) {
  const nights = countNights(reservation.check_in, reservation.check_out);
  const pricePerNight = reservation.amount_gross / nights;
  const paymentLabel =
    PAYMENT_TYPE_LABELS[reservation.payment_type] ?? reservation.payment_type;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Naslov */}
        <Text style={styles.title}>
          RAČUN / INVOICE #{invoice.invoice_number_display}
        </Text>

        <View style={styles.divider} />

        {/* Iznajmljivač */}
        <Text style={styles.sectionLabel}>Iznajmljivač / Owner</Text>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Ime / Name</Text>
          <Text style={styles.valueCell}>{apartment.owner_name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelCell}>OIB / PIN</Text>
          <Text style={styles.valueCell}>{apartment.owner_oib}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Adresa / Address</Text>
          <Text style={styles.valueCell}>{apartment.owner_address}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Grad / City</Text>
          <Text style={styles.valueCell}>{apartment.owner_city}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Poštanski br. / Postal code</Text>
          <Text style={styles.valueCell}>{apartment.owner_postal_code}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Država / Country</Text>
          <Text style={styles.valueCell}>{apartment.owner_country}</Text>
        </View>

        <View style={styles.divider} />

        {/* Gost */}
        <Text style={styles.sectionLabel}>Gost / Guest</Text>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Ime i prezime / Full name</Text>
          <Text style={styles.valueCell}>{reservation.guest_name}</Text>
        </View>

        <View style={styles.divider} />

        {/* Boravak */}
        <Text style={styles.sectionLabel}>Vrijeme boravka / Time of stay</Text>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Check-in</Text>
          <Text style={styles.valueCell}>{formatDate(reservation.check_in)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Check-out</Text>
          <Text style={styles.valueCell}>{formatDate(reservation.check_out)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.labelCell}>Broj noćenja / Nights</Text>
          <Text style={styles.valueCell}>{nights}</Text>
        </View>

        <View style={styles.divider} />

        {/* Način plaćanja */}
        <View style={styles.row}>
          <Text style={styles.labelCell}>Način plaćanja / Payment type</Text>
          <Text style={styles.valueCell}>{paymentLabel}</Text>
        </View>

        {/* Tablica usluga */}
        <View style={styles.table}>
          {/* Zaglavlje tablice */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colDescription, styles.tableHeaderText]}>
              Opis / Description
            </Text>
            <Text style={[styles.colUnit, styles.tableHeaderText]}>
              Jed. / Unit
            </Text>
            <Text style={[styles.colUnitPrice, styles.tableHeaderText]}>
              Cijena/noć / Price/night
            </Text>
            <Text style={[styles.colTotal, styles.tableHeaderText]}>
              Ukupno / Total
            </Text>
          </View>

          {/* Redak usluge */}
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>
              Noćenje {apartment.name} / Accommodation {apartment.name}
            </Text>
            <Text style={styles.colUnit}>1.0</Text>
            <Text style={styles.colUnitPrice}>
              {formatAmount(pricePerNight)} EUR
            </Text>
            <Text style={styles.colTotal}>
              {formatAmount(reservation.amount_gross)} EUR
            </Text>
          </View>
        </View>

        {/* Ukupno */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Ukupna cijena / Total price</Text>
            <Text style={styles.totalValue}>
              {formatAmount(reservation.amount_gross)} EUR
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Ukupno / Total</Text>
            <Text style={styles.grandTotalValue}>
              {formatAmount(reservation.amount_gross)} EUR
            </Text>
          </View>
        </View>

        {/* Datum */}
        <Text style={styles.dateRow}>
          Datum / Date: {formatDateTime(invoice.generated_at)}
        </Text>

        {/* Napomene */}
        <View style={styles.noteSection}>
          <Text style={styles.noteText}>
            PDV nije uračunat temeljem čl. 90, st. 2 Zakona o PDV-u / VAT not
            included pursuant to Art. 90 par. 2 of the VAT Act
          </Text>
          <Text style={styles.noteText}>
            Turistička pristojba uključena / Tourist tax included
          </Text>
        </View>

      </Page>
    </Document>
  );
}
