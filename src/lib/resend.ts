import { Resend } from 'resend';

function getRuntimeEnv() {
  return (globalThis as any).__cloudflareEnv;
}

export function createResendClient() {
  const key = getRuntimeEnv()?.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY;
  return new Resend(key);
}

function getFromEmail(): string {
  return getRuntimeEnv()?.FROM_EMAIL ?? import.meta.env.FROM_EMAIL ?? 'noreply@mojiapartmani.com';
}

async function sendEmail(params: Parameters<Resend['emails']['send']>[0]) {
  const resend = createResendClient();
  const { data, error } = await resend.emails.send(params);
  if (error) {
    console.error('[Resend error]', JSON.stringify(error));
    throw new Error(`Resend: ${(error as any).message ?? JSON.stringify(error)}`);
  }
  return data;
}

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
  return sendEmail({
    from: getFromEmail(),
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
  return sendEmail({
    from: getFromEmail(),
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
  return sendEmail({
    from: getFromEmail(),
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
  return sendEmail({
    from: getFromEmail(),
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
    from: getFromEmail(),
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
    from: getFromEmail(),
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
    from: getFromEmail(),
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
    from: getFromEmail(),
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

// ─── Email #9: Novi korisnik registriran — obavijest adminu ──────────────────
export async function sendNewUserRegisteredEmail({
  newUserEmail,
  newUserName,
}: {
  newUserEmail: string;
  newUserName: string;
}) {
  const adminEmail = getRuntimeEnv()?.ADMIN_EMAIL ?? import.meta.env.ADMIN_EMAIL ?? 'ena.habensus@tesko.me';
  if (!adminEmail) return;
  return sendEmail({
    from: getFromEmail(),
    to: adminEmail,
    subject: `Novi korisnik: ${newUserName} (${newUserEmail})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin: 0 0 16px;">Novi korisnik se registrirao na Moji Apartmani:</p>
          <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 16px; font-weight: bold; color: #0F2544;">${newUserName}</p>
            <p style="margin: 0; color: #6B7280; font-size: 14px;">${newUserEmail}</p>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #10: Zadatak završen — obavijest adminu ────────────────────────────
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
  return sendEmail({
    from: getFromEmail(),
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getAppUrl(): string {
  return getRuntimeEnv()?.APP_URL ?? import.meta.env.APP_URL ?? 'https://mojiapartmani.com';
}

// ─── Email #11: Odgovor na pozivnicu — obavijest adminu ───────────────────────
export async function sendInviteResponseEmail({
  to,
  adminName,
  staffName,
  apartmentName,
  action,
}: {
  to: string;
  adminName: string;
  staffName: string;
  apartmentName: string;
  action: 'accept' | 'decline';
}) {
  const accepted = action === 'accept';
  return sendEmail({
    from: getFromEmail(),
    to,
    subject: `${staffName} ${accepted ? 'prihvatio/la' : 'odbio/la'} pozivnicu — ${apartmentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin: 0 0 16px;">Hej <strong>${adminName}</strong>,</p>
          <p style="font-size: 15px; color: #374151; margin: 0 0 24px;">
            <strong>${staffName}</strong> je <strong style="color: ${accepted ? '#065F46' : '#DC2626'}">${accepted ? 'prihvatio/la' : 'odbio/la'}</strong> pozivnicu za apartman <strong>${apartmentName}</strong>.
          </p>
          <div style="background: white; border: 1px solid ${accepted ? '#6EE7B7' : '#FCA5A5'}; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 15px; color: ${accepted ? '#065F46' : '#DC2626'}; font-weight: bold;">
              ${accepted ? '✅ Pozivnica prihvaćena' : '❌ Pozivnica odbijena'}
            </p>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #12: Dobrodošlica za pomoćno osoblje ───────────────────────────────
export async function sendExternalWelcomeEmail({
  to,
  name,
  apartmentNames,
}: {
  to: string;
  name: string;
  apartmentNames: string[];
}) {
  const apts = apartmentNames.join(', ');
  return sendEmail({
    from: getFromEmail(),
    to,
    subject: `Dodani ste u sustav apartmana ${apartmentNames[0] ?? ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin: 0 0 8px;">Hej <strong>${name}</strong>,</p>
          <p style="font-size: 15px; color: #374151; margin: 0 0 20px;">
            Dodani ste kao pomoćno osoblje za apartman <strong>${apts}</strong>.
          </p>
          <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-weight: bold; color: #0F2544;">Kako to funkcionira?</p>
            <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">
              📧 Kada vam bude dodijeljen zadatak, primit ćete email s detaljima.
            </p>
            <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">
              ✅ U svakom emailu bit će gumb <strong>Označi kao završeno</strong> — kliknite ga kada obavite posao.
            </p>
            <p style="margin: 0; font-size: 14px; color: #374151;">
              🔔 Na dan zadatka u 8:00 primit ćete podsjetnik.
            </p>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #13: Zadatak dodijeljen — pomoćno osoblje (s linkom za završetak) ──
export async function sendTaskAssignedExternalEmail({
  to,
  name,
  apartmentName,
  taskTitle,
  dueDate,
  dueTime,
  completionUrl,
}: {
  to: string;
  name: string;
  apartmentName: string;
  taskTitle: string;
  dueDate: string;
  dueTime?: string | null;
  completionUrl: string;
}) {
  const dateTime = dueTime ? `${dueDate} u ${dueTime}` : dueDate;
  return sendEmail({
    from: getFromEmail(),
    to,
    subject: `${apartmentName} — ${taskTitle} ${dateTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin: 0 0 8px;">Hej <strong>${name}</strong>,</p>
          <p style="font-size: 15px; color: #374151; margin: 0 0 24px;">novi zadatak ti je dodijeljen za <strong>${apartmentName}</strong>.</p>
          <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px; font-size: 18px; font-weight: bold; color: #0F2544;">${taskTitle}</p>
            <p style="margin: 0; color: #6B7280; font-size: 14px;">📅 ${dateTime}</p>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${completionUrl}"
               style="background: #16A34A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
              ✅ Označi kao završeno
            </a>
          </div>
          <p style="font-size: 13px; color: #6B7280; text-align: center; margin: 0 0 16px;">
            Kliknite gumb kad završite zadatak — nije potrebna prijava.
          </p>
          <p style="font-size: 12px; color: #9CA3AF; margin: 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}

// ─── Email #14: Podsjetnik u 8h — pomoćno osoblje ────────────────────────────
export async function sendTaskReminderExternalEmail({
  to,
  name,
  todayStr,
  tasks,
}: {
  to: string;
  name: string;
  todayStr: string;
  tasks: Array<{ title: string; apartmentName: string; dueTime?: string | null; completionUrl: string }>;
}) {
  const [y, m, d] = todayStr.split('-');
  const dateFmt = `${d}.${m}.${y}.`;

  const taskCards = tasks.map((t) => {
    const time = t.dueTime ? ` u ${t.dueTime}` : '';
    return `
      <div style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px 20px; margin-bottom: 12px;">
        <p style="margin: 0 0 4px; font-size: 16px; font-weight: bold; color: #0F2544;">${t.title}</p>
        <p style="margin: 0 0 14px; font-size: 13px; color: #6B7280;">${t.apartmentName}${time}</p>
        <a href="${t.completionUrl}"
           style="background: #16A34A; color: white; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">
          ✅ Označi kao završeno
        </a>
      </div>
    `;
  }).join('');

  return sendEmail({
    from: getFromEmail(),
    to,
    subject: `Podsjetnik — tvoji zadatci danas ${dateFmt}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background: #0F2544; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Moji Apartmani</h1>
          <p style="color: #93C5FD; margin: 4px 0 0; font-size: 13px;">Podsjetnik — ${dateFmt}</p>
        </div>
        <div style="background: #F9FAFB; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 15px; margin: 0 0 20px;">Hej <strong>${name}</strong>, ovo su tvoji zadatci za danas:</p>
          ${taskCards}
          <p style="font-size: 13px; color: #6B7280; margin: 16px 0 0;">
            Kliknite gumb pored svakog zadatka kada ga završite.
          </p>
          <p style="font-size: 12px; color: #9CA3AF; margin: 8px 0 0;">Moji Apartmani — upravljanje apartmanima</p>
        </div>
      </div>
    `,
  });
}
