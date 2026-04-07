import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient } from './lib/supabase';

// Rute koje ne zahtijevaju autentikaciju
const PUBLIC_ROUTES = ['/login', '/register', '/invite'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, redirect, url } = context;
  const pathname = url.pathname;

  // API rute za auth nisu zaštićene
  if (pathname.startsWith('/api/auth/') || pathname.startsWith('/api/invite/')) {
    return next();
  }

  // Provjeri je li javna ruta
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

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

    context.locals.user = profile;

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
