import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 48,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 36,
  },
  headerLeft: {
    flex: 1,
  },
  aptName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  aptSubtitle: {
    fontSize: 9,
    color: '#6B7280',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: '#1D4ED8',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  invoiceDate: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginVertical: 20,
  },
  // Guest section
  sectionRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  sectionBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 4,
    padding: 12,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 9,
    color: '#6B7280',
  },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1D4ED8',
    borderRadius: 4,
    padding: 8,
    marginBottom: 1,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 8,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 8,
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
  },
  tableCellBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  // Total row
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    padding: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1D4ED8',
    flex: 3,
  },
  totalValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1D4ED8',
    textAlign: 'right',
    flex: 1,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
  // Col widths
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'center' },
  col3: { flex: 1, textAlign: 'right' },
});

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}.`;
}

function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0,00 €';
  return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(n);
}

function nightsLabel(n: number): string {
  if (n === 1) return '1 noćenje';
  if (n >= 2 && n <= 4) return `${n} noćenja`;
  return `${n} noćenja`;
}

export interface InvoiceData {
  invoiceNumberDisplay: string;
  generatedAt: string;
  apartmentName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  numNights: number;
  numGuests: number;
  amountGross: number | null;
}

const InvoiceDocument = ({ data }: { data: InvoiceData }) => {
  const pricePerNight =
    data.amountGross !== null && data.numNights > 0
      ? data.amountGross / data.numNights
      : null;

  const genDate = new Date(data.generatedAt);
  const genDateStr = genDate.toLocaleDateString('hr-HR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.aptName}>{data.apartmentName}</Text>
            <Text style={styles.aptSubtitle}>Iznajmljivanje apartmana</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>RAČUN</Text>
            <Text style={styles.invoiceNumber}>Br. {data.invoiceNumberDisplay}</Text>
            <Text style={styles.invoiceDate}>Datum: {genDateStr}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Guest + Stay info */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>Gost</Text>
            <Text style={styles.sectionValue}>{data.guestName}</Text>
            {data.numGuests > 1 && (
              <Text style={styles.sectionSub}>{data.numGuests} gosta</Text>
            )}
          </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>Check-in</Text>
            <Text style={styles.sectionValue}>{formatDate(data.checkIn)}</Text>
          </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>Check-out</Text>
            <Text style={styles.sectionValue}>{formatDate(data.checkOut)}</Text>
          </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>Trajanje</Text>
            <Text style={styles.sectionValue}>{nightsLabel(data.numNights)}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.col1]}>Opis</Text>
          <Text style={[styles.tableHeaderCell, styles.col2]}>Kol.</Text>
          <Text style={[styles.tableHeaderCell, styles.col3]}>Iznos</Text>
        </View>

        {pricePerNight !== null ? (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.col1]}>
              Noćenje — {data.apartmentName}
            </Text>
            <Text style={[styles.tableCell, styles.col2]}>{data.numNights}</Text>
            <Text style={[styles.tableCellBold, styles.col3]}>
              {formatCurrency(data.amountGross)}
            </Text>
          </View>
        ) : (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.col1]}>
              Noćenje — {data.apartmentName} ({nightsLabel(data.numNights)})
            </Text>
            <Text style={[styles.tableCell, styles.col2]}>1</Text>
            <Text style={[styles.tableCellBold, styles.col3]}>—</Text>
          </View>
        )}

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>UKUPNO ZA PLATITI</Text>
          <Text style={styles.totalValue}>{formatCurrency(data.amountGross)}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{data.apartmentName}</Text>
          <Text style={styles.footerText}>
            Račun br. {data.invoiceNumberDisplay} · {genDateStr}
          </Text>
        </View>

      </Page>
    </Document>
  );
};

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const element = React.createElement(InvoiceDocument, { data });
  return await renderToBuffer(element);
}
