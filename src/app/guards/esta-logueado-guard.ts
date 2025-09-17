import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Supabase } from '../services/supabase';

// protege /chat, /resultados, /juegos -> SOLO LOGEADOS
export const estaLogueadoGuard: CanActivateFn = async (_route, _state) => {
  const auth = inject(Auth);
  const sb = inject(Supabase);
  const router = inject(Router);

  // chequeo rapido con el estado actual del servicio
  if (auth.isAuthenticated()) return true;

  // doble chequeo asincrono (evita el hueco antes de rehidratar)
  const { data } = await sb.client.auth.getSession();
  if (data?.session?.user) {
    // hay sesion valida -> dejar pasar
    return true;
  }

  // no hay sesion -> mandar a login SIN cargar el componente protegido
  return router.createUrlTree(['/login']);
};
