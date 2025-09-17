import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Supabase } from '../services/supabase';

//protege todas las rutas hijas (/juegos/...) -> SOLO LOGEADOS
export const estaLogueadoChildGuard: CanActivateChildFn = async (_route, _state) => {
  const auth = inject(Auth);
  const sb = inject(Supabase);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  const { data } = await sb.client.auth.getSession();
  if (data?.session?.user) return true;

  return router.createUrlTree(['/login']);
};
