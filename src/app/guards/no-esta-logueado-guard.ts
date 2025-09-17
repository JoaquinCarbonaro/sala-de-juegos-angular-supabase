import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Supabase } from '../services/supabase';

// protege /login y /registro -> SOLO NO LOGEADOS
export const noEstaLogueadoGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const sb = inject(Supabase);
  const router = inject(Router);

  // si ya esta logueado segun el estado actual -> redirigir
  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/bienvenida']);
  }

  // si el estado todavia no esta hidratado, confirmo con Supabase
  const { data } = await sb.client.auth.getSession();
  if (data?.session?.user) {
    return router.createUrlTree(['/bienvenida']);
  }

  // no hay sesion -> permitir entrar a login/registro
  return true;
};
