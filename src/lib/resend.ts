import { Resend } from 'resend';

export function createResendClient() {
  return new Resend(import.meta.env.RESEND_API_KEY);
}

const FROM_EMAIL = 'onboarding@resend.dev'; // Zamijeni sa svojom domenom kad verificiraš

// ─── Email #1: Dodijeljeno čišćenje ──────────────────────────────────────────
export async function sendCleaningAssignedEmail({
  to,
  assigneeName,
  apartmentName,
  checkOutDate,
  checkOutTime,
  checkInDate,
}: {
  to: string;
  assigneeName: string;
  apartmentName: string;
  checkOutDate: string;
  checkOutTime: string;
  checkInDate: string;
}) {
  const resend = createResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Dodano čišćenje ${checkOutDate} za ${apartmentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Dodijeljeno čišćenje</h2>
        <p>Pozdrav ${assigneeName},</p>
        <p>Dodijeljeno ti je čišćenje apartmana <strong>${apartmentName}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Apartman</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${apartmentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Check-out (čišćenje)</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${checkOutDate} u ${checkOutTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Sljedeći check-in</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${checkInDate}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px;">ApartMan</p>
      </div>
    `,
  });
}

// ─── Email #2: Podsjetnik čišćenje ───────────────────────────────────────────
export async function sendCleaningReminderEmail({
  to,
  assigneeName,
  apartmentName,
  checkOutDate,
  checkOutTime,
}: {
  to: string;
  assigneeName: string;
  apartmentName: string;
  checkOutDate: string;
  checkOutTime: string;
}) {
  const resend = createResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Podsjetnik za čišćenje ${apartmentName} — ${checkOutDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Podsjetnik za čišćenje</h2>
        <p>Pozdrav ${assigneeName},</p>
        <p>Sutra je čišćenje apartmana <strong>${apartmentName}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Apartman</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${apartmentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Datum i vrijeme</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${checkOutDate} u ${checkOutTime}</td>
          </tr>
        </table>
        <p style="color: #666; font-size: 12px;">ApartMan</p>
      </div>
    `,
  });
}

// ─── Email #3: Pozivnica — novi profil ───────────────────────────────────────
export async function sendInviteNewUserEmail({
  to,
  inviteeName,
  inviterName,
  apartmentName,
  inviteUrl,
}: {
  to: string;
  inviteeName: string;
  inviterName: string;
  apartmentName: string;
  inviteUrl: string;
}) {
  const resend = createResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: 'Pozivnica — ApartMan',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Dobrodošli u ApartMan</h2>
        <p>Pozdrav ${inviteeName},</p>
        <p><strong>${inviterName}</strong> te poziva kao osoblje na apartman <strong>${apartmentName}</strong>.</p>
        <p>Klikni gumb ispod da kreiraš račun i prihvatiš pozivnicu:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Kreiraj račun
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">Link vrijedi 7 dana. ApartMan</p>
      </div>
    `,
  });
}

// ─── Email #4: Pozivnica — postojeći profil ──────────────────────────────────
export async function sendInviteExistingUserEmail({
  to,
  inviteeName,
  inviterName,
  apartmentName,
  acceptUrl,
}: {
  to: string;
  inviteeName: string;
  inviterName: string;
  apartmentName: string;
  acceptUrl: string;
}) {
  const resend = createResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${inviterName} te poziva na apartman ${apartmentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Nova pozivnica</h2>
        <p>Pozdrav ${inviteeName},</p>
        <p><strong>${inviterName}</strong> te poziva kao osoblje na apartman <strong>${apartmentName}</strong>.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptUrl}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Prihvati pozivnicu
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">Link vrijedi 7 dana. ApartMan</p>
      </div>
    `,
  });
}
