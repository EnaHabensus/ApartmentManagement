import { Resend } from 'resend';

export function createResendClient() {
  return new Resend(import.meta.env.RESEND_API_KEY);
}

const FROM_EMAIL = import.meta.env.FROM_EMAIL || 'onboarding@resend.dev';

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
        <p style="color: #666; font-size: 12px;">Moji Apartmani</p>
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
        <p style="color: #666; font-size: 12px;">Moji Apartmani</p>
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
    subject: 'Pozivnica — Moji Apartmani',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Dobrodošli u Moji Apartmani</h2>
        <p>Pozdrav ${inviteeName},</p>
        <p><strong>${inviterName}</strong> te poziva kao osoblje na apartman <strong>${apartmentName}</strong>.</p>
        <p>Klikni gumb ispod da kreiraš račun i prihvatiš pozivnicu:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Kreiraj račun
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">Link vrijedi 7 dana. Moji Apartmani</p>
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
        <p style="color: #666; font-size: 12px;">Link vrijedi 7 dana. Moji Apartmani</p>
      </div>
    `,
  });
}

// ─── Email #5: Zadatak dodijeljen ─────────────────────────────────────────────
export async function sendTaskAssignedEmail({
  to,
  assigneeName,
  apartmentName,
  taskTitle,
  dueDate,
  dueTime,
}: {
  to: string;
  assigneeName: string;
  apartmentName: string;
  taskTitle: string;
  dueDate: string;
  dueTime?: string | null;
}) {
  const resend = createResendClient();
  const dateTime = dueTime ? `${dueDate} u ${dueTime}` : dueDate;
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${apartmentName} — ${taskTitle} ${dateTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin: 0 0 8px;">Hej <strong>${assigneeName}</strong>,</p>
          <p style="font-size: 15px; color: #374151; margin: 0 0 24px;">novi zadatak ti je dodijeljen za <strong>${apartmentName}</strong>.</p>
          <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 18px; font-weight: bold; color: #0F2544;">${taskTitle}</p>
            <p style="margin: 0; color: #6B7280; font-size: 14px;">📅 ${dateTime}</p>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #6: Zadatak otkazan/promijenjen ───────────────────────────────────
export async function sendTaskCancelledEmail({
  to,
  assigneeName,
  apartmentName,
  taskTitle,
  dueDate,
  dueTime,
}: {
  to: string;
  assigneeName: string;
  apartmentName: string;
  taskTitle: string;
  dueDate: string;
  dueTime?: string | null;
}) {
  const resend = createResendClient();
  const dateTime = dueTime ? `${dueDate} u ${dueTime}` : dueDate;
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${apartmentName} — ${taskTitle} OTKAZANO`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin: 0 0 8px;">Hej <strong>${assigneeName}</strong>,</p>
          <p style="font-size: 15px; color: #374151; margin: 0 0 24px;">zadatak koji ti je bio dodijeljen za <strong>${apartmentName}</strong> je otkazan ili dodijeljen drugoj osobi.</p>
          <div style="background: white; border: 1px solid #FCA5A5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 18px; font-weight: bold; color: #DC2626; text-decoration: line-through;">${taskTitle}</p>
            <p style="margin: 0; color: #6B7280; font-size: 14px;">📅 ${dateTime}</p>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #7: Dnevni digest za admina ───────────────────────────────────────
export async function sendDailyAdminDigestEmail({
  to,
  adminName,
  todayStr,
  checkouts,
  checkins,
  tasks,
}: {
  to: string;
  adminName: string;
  todayStr: string;
  checkouts: Array<{ guestName: string; apartmentName: string }>;
  checkins:  Array<{ guestName: string; apartmentName: string }>;
  tasks:     Array<{ title: string; apartmentName: string; dueTime?: string | null; assigneeName?: string | null }>;
}) {
  const resend = createResendClient();
  const [y, m, d] = todayStr.split('-');
  const dateFmt = `${d}.${m}.${y}.`;

  const listHtml = (items: string[]) =>
    items.length === 0
      ? '<p style="color:#9CA3AF;margin:0;font-size:14px;">Nema</p>'
      : `<ul style="margin:0;padding-left:20px;">${items.map((i) => `<li style="font-size:14px;color:#374151;margin-bottom:4px;">${i}</li>`).join('')}</ul>`;

  const checkoutRows = checkouts.map((c) => `<strong>${c.guestName}</strong> — ${c.apartmentName}`);
  const checkinRows  = checkins.map((c)  => `<strong>${c.guestName}</strong> — ${c.apartmentName}`);
  const taskRows     = tasks.map((t) => {
    const time = t.dueTime ? ` u ${t.dueTime}` : '';
    const who  = t.assigneeName ? ` (${t.assigneeName})` : ' (nedodjeljeno)';
    return `<strong>${t.title}</strong> — ${t.apartmentName}${time}${who}`;
  });

  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Moji Apartmani — Dnevni pregled ${dateFmt}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
          <p style="color: #93C5FD; margin: 4px 0 0; font-size: 13px;">Dnevni pregled — ${dateFmt}</p>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 15px; margin: 0 0 24px;">Dobro jutro, <strong>${adminName}</strong>!</p>
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280;">🔑 Check-out danas (${checkouts.length})</h3>
            ${listHtml(checkoutRows)}
          </div>
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280;">🏠 Check-in danas (${checkins.length})</h3>
            ${listHtml(checkinRows)}
          </div>
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280;">✅ Zadatci danas (${tasks.length})</h3>
            ${listHtml(taskRows)}
          </div>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #8: Dnevni digest zadataka za staff ────────────────────────────────
export async function sendDailyStaffDigestEmail({
  to,
  staffName,
  todayStr,
  tasks,
}: {
  to: string;
  staffName: string;
  todayStr: string;
  tasks: Array<{ title: string; apartmentName: string; dueTime?: string | null }>;
}) {
  const resend = createResendClient();
  const [y, m, d] = todayStr.split('-');
  const dateFmt = `${d}.${m}.${y}.`;

  const taskRows = tasks.map((t) => {
    const time = t.dueTime ? ` u ${t.dueTime}` : '';
    return `
      <div style="background: white; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 16px; margin-bottom: 8px;">
        <p style="margin: 0 0 4px; font-weight: bold; color: #0F2544;">${t.title}</p>
        <p style="margin: 0; font-size: 13px; color: #6B7280;">${t.apartmentName}${time}</p>
      </div>
    `;
  }).join('');

  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Tvoji zadatci danas — ${dateFmt}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
          <p style="color: #93C5FD; margin: 4px 0 0; font-size: 13px;">Tvoji zadatci — ${dateFmt}</p>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 15px; margin: 0 0 20px;">Hej <strong>${staffName}</strong>, ovo su tvoji zadatci za danas:</p>
          ${taskRows}
          <p style="font-size: 12px; color: #9CA3AF; margin: 16px 0 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #9: Zadatak završen — obavijest adminu ─────────────────────────────
export async function sendTaskCompletedEmail({
  to,
  adminName,
  completedByName,
  taskTitle,
  apartmentName,
}: {
  to: string;
  adminName: string;
  completedByName: string;
  taskTitle: string;
  apartmentName: string;
}) {
  const resend = createResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `${taskTitle} — ZAVRŠENO`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin: 0 0 8px;">Hej <strong>${adminName}</strong>,</p>
          <p style="font-size: 15px; color: #374151; margin: 0 0 24px;">
            <strong>${completedByName}</strong> je obavio/la zadatak za <strong>${apartmentName}</strong>.
          </p>
          <div style="background: white; border: 1px solid #6EE7B7; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">✅</span>
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #065F46;">${taskTitle}</p>
            </div>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}
