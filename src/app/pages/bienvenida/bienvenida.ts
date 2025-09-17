import { AsyncPipe  } from '@angular/common'
import { Component, inject } from '@angular/core'
import { RouterModule } from '@angular/router'
import { Auth } from '../../services/auth'
import { Observable } from 'rxjs'
import { Usuario } from '../../classes/usuario'

@Component({
  selector: 'app-bienvenida',
  imports: [RouterModule, AsyncPipe], //AsyncPipe para no tener que suscribirme manualmente al observable
  templateUrl: './bienvenida.html',
  styleUrls: ['./bienvenida.css'],
})
export class Bienvenida {
  //lista de juegos con nombre descripcion icono, estado y sprint
  juegos = [
    {
      nombre: 'Ahorcado',
      descripcion: 'Adivina la palabra oculta antes de que se complete el dibujo',
      icono: 'bi-alphabet',
      disponible: true,
      sprint: 3,
    },
    {
      nombre: 'Mayor o Menor',
      descripcion: 'Juego de cartas donde debes adivinar si la siguiente carta es mayor o menor',
      icono: 'bi-suit-spade',
      disponible: true,
      sprint: 3,
    },
    {
      nombre: 'Preguntados',
      descripcion: 'Trivia con preguntas de diferentes categorias',
      icono: 'bi-question-circle',
      disponible: false,
      sprint: 4,
    },
    {
      nombre: 'Connect 4',
      descripcion: 'Conecta cuatro fichas en linea para ganar',
      icono: 'bi-grid-3x3',
      disponible: false,
      sprint: 4,
    },
  ]

  //observable que guarda el estado del usuario
  usuario$: Observable<Usuario | null>

  //inyecto servicio de auth
  private readonly auth = inject(Auth)

  constructor() {
    //asigno observable de usuario desde auth
    this.usuario$ = this.auth.currentUser$
  }
  
}
