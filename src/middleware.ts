import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase';

// Rute koje ne zahtijevaju autentikaciju
const PUBLIC_ROUTES = ['/login', '/register', '/invite'];

export const onRequest = defineMiddleware(async (context, next) => {
  // Postavi Cloudflare runtime env globalno PRIJE svih early returna
  // kako bi library kod (supabase.ts, resend.ts) mogao čitati secretse
  const runtimeEnv = (context.locals as any).runtime?.env;
  if (runtimeEnv) {
    (globalThis as any).__cloudflareEnv = runtimeEnv;
  }

  const { request, cookies, redirect, url } = context;
  const pathname = url.pathname;

  // API rute za auth, token completion i cron nisu zaštićene
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/invite/') ||
    pathname.startsWith('/api/zadatci/complete-token') ||
    pathname.startsWith('/api/cron/')
  ) {
    return next();
  }

  // Provjeri je li javna ruta
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  ) || pathname === '/task-complete';

  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  context.locals.supabase = supabase;

  // Ako je prijavljen i pokušava pristupiti login/register → preusmjeri na dashboard
  if (user && (pathname === '/login' || pathname === '/register')) {
    return redirect('/');
  }

  // Ako nije prijavljen i ruta nije javna → preusmjeri na login
  if (!user && !isPublic) {
    return redirect('/login');
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Ako profil ne postoji (obrisan), odjavi korisnika i preusmjeri na login
    if (!profile) {
      await supabase.auth.signOut();
      return redirect('/login');
    }

    context.locals.user = profile;

    // Izračunaj isAdmin jednom za cijeli request
    const { data: auRows } = await supabase
      .from('apartment_users')
      .select('role')
      .eq('user_id', user.id);
    context.locals.isAdmin = (auRows ?? []).some((r: any) => r.role === 'admin');

    // Ažuriraj has_logged_in ako je prvi put
    if (profile && !profile.has_logged_in) {
      await supabase
        .from('profiles')
        .update({ has_logged_in: true })
        .eq('id', user.id);
    }
  }

  return next();
});
