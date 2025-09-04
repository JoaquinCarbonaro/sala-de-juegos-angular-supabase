//importo lo necesario de angular
import { inject, Injectable } from '@angular/core'
//importo http client y headers
import { HttpClient, HttpHeaders } from '@angular/common/http'
//importo environment para no hardcodear urls ni username
import { environment } from '../../environments/environment'
import { Observable } from 'rxjs';

//interface con los datos que trae github
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
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class Github {
  //inyecto http client
  private http = inject(HttpClient);
  //url base desde environment
  private readonly api = environment.githubApiUrl
  //headers sugeridos por github
  private readonly headers = new HttpHeaders({
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  })

  //devuelve observable con el perfil del usuario
  fetchUser(username: string = environment.githubUsername): Observable<GithubUser> {

    //armo la url con username
    const url = `${this.api}/users/${encodeURIComponent(username)}`
    
    //devuelvo el observable
    return this.http.get<GithubUser>(url, { headers: this.headers })
  }
}
