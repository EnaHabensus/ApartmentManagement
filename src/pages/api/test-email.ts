import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const GET: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const fromEmail = import.meta.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY nije postavljen' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const resend = new Resend(apiKey);

  const url = new URL(request.url);
  const to = url.searchParams.get('to');

  if (!to) {
    return new Response(JSON.stringify({ error: 'Dodaj ?to=tvojemail@gmail.com u URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await resend.emails.send({
    from: fromEmail,
    to,
    subject: 'Test email — ApartMan',
    html: '<p>Ovo je test email iz ApartMan aplikacije.</p>',
  });

  return new Response(JSON.stringify({ apiKey: apiKey.slice(0, 8) + '...', fromEmail, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
