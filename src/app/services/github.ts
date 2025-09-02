import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface GithubUser {
  login: string;
  name: string;
  avatar_url: string;
  bio: string | null;
  html_url: string;
  location?: string | null;
  blog?: string | null;
  public_repos?: number;
  followers?: number;
  following?: number;
  created_at?: string; // <-- agregado para tu "Miembro desde ..."
}

@Injectable({ providedIn: 'root' })
export class Github {
  private http = inject(HttpClient);

  private readonly baseUrl = 'https://api.github.com/users';
  // Opcional: headers recomendados por GitHub REST v3
  private readonly headers = new HttpHeaders({
    'Accept': 'application/vnd.github+json',
    // 'Authorization': `Bearer <token_personal_opcional>`, // si alguna vez necesitas subir el rate limit
    'X-GitHub-Api-Version': '2022-11-28',
  });

  // Estado reactivo (Angular Signals)
  user = signal<GithubUser | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  /**
   * Carga el perfil público de un usuario por username.
   */
  fetchUser(username: string): void {
    if (!username) {
      this.error.set('El nombre de usuario es requerido.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.http.get<GithubUser>(`${this.baseUrl}/${encodeURIComponent(username)}`, { headers: this.headers })
      .subscribe({
        next: (u) => {
          this.user.set(u);
          this.loading.set(false);
        },
        error: (err) => {
          const msg = this.mapHttpError(err);
          this.error.set(msg);
          this.loading.set(false);
          this.user.set(null);
        }
      });
  }

  /** Mapea mensajes de error más claros para el usuario */
  private mapHttpError(err: any): string {
    if (err?.status === 404) return 'Usuario no encontrado en GitHub.';
    if (err?.status === 403) return 'Límite de consultas alcanzado. Intenta más tarde o agrega un token.';
    return 'No se pudo cargar el perfil. Verifica tu conexión.';
  }
}
