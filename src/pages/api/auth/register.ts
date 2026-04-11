import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';
import { sendNewUserRegisteredEmail } from '../../../lib/resend';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const full_name = formData.get('full_name')?.toString()?.trim();
  const email = formData.get('email')?.toString()?.trim();
  const password = formData.get('password')?.toString();
  const password_confirm = formData.get('password_confirm')?.toString();

  if (!full_name || !email || !password || !password_confirm) {
    return redirect('/register?error=server_error');
  }

  if (password.length < 8) {
    return redirect('/register?error=weak_password');
  }

  if (password !== password_confirm) {
    return redirect('/register?error=password_mismatch');
  }

  const supabase = createSupabaseServerClient(request, cookies);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return redirect('/register?error=email_taken');
    }
    return redirect('/register?error=server_error');
  }

  sendNewUserRegisteredEmail({ newUserEmail: email, newUserName: full_name }).catch(() => {});

  return redirect('/');
};
