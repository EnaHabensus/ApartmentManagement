import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase';
import { generateInvoicePdf } from '../../../lib/invoice-pdf';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const adminSupabase = createSupabaseAdminClient();
  const { data: au } = await adminSupabase.from('apartment_users').select('role').eq('user_id', user.id).eq('role', 'admin').limit(1);
  if (!au?.length) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const { reservation_id, invoice_number_display } = await request.json();
  if (!reservation_id || !invoice_number_display?.trim()) {
    return new Response(JSON.stringify({ error: 'Rezervacija i broj računa su obavezni.' }), { status: 400 });
  }

  // Dohvati rezervaciju
  const { data: rez } = await adminSupabase
    .from('reservations')
    .select('id, apartment_id, guest_name, check_in, check_out, num_guests, amount_gross, payment_type')
    .eq('id', reservation_id)
    .single();
  if (!rez) return new Response(JSON.stringify({ error: 'Rezervacija nije pronađena.' }), { status: 404 });

  // Dohvati apartman s podacima o iznajmljivaču
  const { data: apt } = await adminSupabase
    .from('apartments')
    .select('name, owner_name, owner_oib, owner_address, owner_postal_code, owner_city, owner_country')
    .eq('id', rez.apartment_id)
    .single();

  // Provjeri da već ne postoji račun za tu rezervaciju
  const { data: existing } = await adminSupabase
    .from('invoices')
    .select('id')
    .eq('reservation_id', reservation_id)
    .maybeSingle();
  if (existing) return new Response(JSON.stringify({ error: 'Račun za ovu rezervaciju već postoji.' }), { status: 400 });

  // Broj računa (integer) = count postojećih + 1
  const { count } = await adminSupabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('apartment_id', rez.apartment_id);
  const invoice_number = (count ?? 0) + 1;

  // Izračunaj broj noćenja
  const checkInDate = new Date(rez.check_in);
  const checkOutDate = new Date(rez.check_out);
  const numNights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  const generatedAt = new Date().toISOString();

  // Generiraj PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateInvoicePdf({
      invoiceNumberDisplay: invoice_number_display.trim(),
      generatedAt,
      apartmentName: apt?.name ?? 'Apartman',
      ownerName: apt?.owner_name ?? '',
      ownerOib: apt?.owner_oib ?? '',
      ownerAddress: apt?.owner_address ?? '',
      ownerPostalCode: apt?.owner_postal_code ?? '',
      ownerCity: apt?.owner_city ?? '',
      ownerCountry: apt?.owner_country ?? 'Hrvatska',
      guestName: rez.guest_name,
      checkIn: rez.check_in,
      checkOut: rez.check_out,
      numNights,
      numGuests: rez.num_guests ?? 1,
      amountGross: rez.amount_gross ?? null,
      paymentType: rez.payment_type ?? null,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Greška pri generiranju PDF-a: ${err?.message ?? 'Nepoznata greška'}` }), { status: 500 });
  }

  // Upload PDF u Supabase Storage
  const storagePath = `${reservation_id}/${Date.now()}.pdf`;
  const { error: uploadError } = await adminSupabase.storage
    .from('invoices')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    return new Response(JSON.stringify({ error: `Greška pri uploadu PDF-a: ${uploadError.message}` }), { status: 500 });
  }

  const { data: { publicUrl } } = adminSupabase.storage.from('invoices').getPublicUrl(storagePath);

  // Spremi u bazu
  const { error } = await adminSupabase.from('invoices').insert({
    reservation_id,
    apartment_id: rez.apartment_id,
    invoice_number,
    invoice_number_display: invoice_number_display.trim(),
    generated_at: generatedAt,
    generated_by: user.id,
    pdf_url: publicUrl,
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true, pdf_url: publicUrl }), { status: 200 });
};
