import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Auth } from '../../services/auth';
import type { Observable } from 'rxjs';
import type { Usuario } from '../../classes/usuario';

@Component({
  selector: 'app-juegos',
  imports: [RouterModule, AsyncPipe],
  templateUrl: './juegos.html',
  styleUrls: ['./juegos.css'],
})
export class Juegos {
  //lista de juegos que se muestran como cards
  juegos = [
    {
      nombre: 'Ahorcado',
      descripcion: 'Adivina la palabra oculta antes de que se complete el dibujo',
      imagen: 'assets/images/ahorcado/ahorcado.png',
      ruta: 'ahorcado',
    },
    {
      nombre: 'Mayor o Menor',
      descripcion: 'Juego de cartas donde debes adivinar si la siguiente carta es mayor o menor',
      imagen: 'assets/images/mayor-menor/mayor-menor.png',
      ruta: 'mayor-menor',
    },
    {
      nombre: 'Preguntados',
      descripcion: 'Trivia con preguntas de diferentes categorias',
      imagen: 'assets/images/preguntados/preguntados.png',
      ruta: 'preguntados',
    },
    {
      nombre: 'Connect 4',
      descripcion: 'Conecta cuatro fichas en linea para ganar',
      imagen: 'assets/images/connect4/connect4.png',
      ruta: 'connect4',
    },
  ]

  //usuario actual como observable
  usuario$: Observable<Usuario | null>
  //inyecto servicios
  private readonly auth = inject(Auth)
  private readonly router = inject(Router)

  constructor() {
    //obtengo usuario actual del servicio auth
    this.usuario$ = this.auth.currentUser$
  }

  //navega al juego segun la ruta
  jugarJuego(ruta: string) {
    this.router.navigate(['/juegos', ruta])
  }

  //fallback de imagen si falla la carga
  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement
    //si ya aplico fallback no lo repite
    if (img.dataset['fallbackApplied'] === '1') return

    img.dataset['fallbackApplied'] = '1'
    img.src = 'assets/images/sin_imagen.jpg' //imagen por defecto
  }
}
