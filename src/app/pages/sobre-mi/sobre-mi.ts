import { CommonModule } from '@angular/common'
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'
import { Subscription } from 'rxjs'
//importo el servicio de github y el environment
import { Github, GithubUser } from '../../services/github'

@Component({
  selector: 'app-sobre-mi',
  imports: [CommonModule],
  templateUrl: './sobre-mi.html',
  styleUrl: './sobre-mi.css',
})
export class SobreMi implements OnInit, OnDestroy {
  //suscripciones para cortar en destroy
  private subs = new Subscription()

  //estado para la vista
  loading = false
  error: string | null = null
  githubData: GithubUser | null = null

  //inyecto servicio
  constructor(private gh: Github, private cdr: ChangeDetectorRef) {}

  //cuando se inicia el componente pido el perfil
  ngOnInit(): void {

    //activo loading
    this.loading = true

    const s = this.gh.fetchUser().subscribe({
      //cuando llega respuesta guardo datos
      next: (user) => {
        this.githubData = user
        this.loading = false
        this.cdr.detectChanges() // fuerza refresco
      },
      //si hay error guardo mensaje
      error: () => {
        this.error = 'no se pudo cargar el perfil'
        this.loading = false
        this.cdr.detectChanges() // fuerza refresco
      },
      //cuando termina registro en consola
      complete: () => {
        console.log('peticion completada')
      },
    })
    //agrego la subs para cortar despues
    this.subs.add(s)
  }

  //cuando el componente se destruye corto las subs
  ngOnDestroy(): void {
    this.subs.unsubscribe()
  }

}
