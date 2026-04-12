import { createSupabaseAdminClient } from './supabase';

export type NotifType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_cancelled'
  | 'invite_accepted'
  | 'invite_declined'
  | 'cleaning_assigned'
  | 'cleaning_cancelled';

interface NotifParams {
  user_id: string;
  type: NotifType;
  title: string;
  body?: string;
  link?: string;
}

export async function createNotification(params: NotifParams): Promise<void> {
  try {
    const adminSupabase = createSupabaseAdminClient();
    await adminSupabase.from('notifications').insert(params);
  } catch { /* fire-and-forget */ }
}

export async function createNotificationsForMany(
  user_ids: string[],
  params: Omit<NotifParams, 'user_id'>
): Promise<void> {
  if (user_ids.length === 0) return;
  try {
    const adminSupabase = createSupabaseAdminClient();
    await adminSupabase
      .from('notifications')
      .insert(user_ids.map((user_id) => ({ user_id, ...params })));
  } catch { /* fire-and-forget */ }
}
