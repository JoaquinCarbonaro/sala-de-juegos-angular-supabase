import { CommonModule } from "@angular/common"
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from "@angular/core"
import type { Observable } from "rxjs"
import type { Usuario } from "../../classes/usuario"
import { Auth } from "../../services/auth"
import {
  ResultadosService,
  type ResultadoConPosicion,
} from "../../services/ranking"

@Component({
  selector: "app-resultados",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./resultados.html",
  styleUrls: ["./resultados.css"],
})
export class Resultados implements OnInit, OnDestroy {
  //observable del usuario logueado
  usuario$: Observable<Usuario | null>

  //servicio de autenticacion
  private readonly auth = inject(Auth)

  //servicio que trae y arma los rankings
  private readonly resultadosService = inject(ResultadosService)

  //change detector para forzar refresco en modo sin zone
  private readonly cdr = inject(ChangeDetectorRef)

  //listas ordenadas por juego
  resultadosAhorcado: ResultadoConPosicion[] = []    //ahorcado
  resultadosMayorMenor: ResultadoConPosicion[] = []  //mayor o menor
  resultadosPreguntados: ResultadoConPosicion[] = [] //preguntados
  resultadosConnect4: ResultadoConPosicion[] = []    //connect 4

  //ranking combinado de los cuatro juegos
  rankingGeneral: ResultadoConPosicion[] = []

  //estado de carga de la vista
  cargando = true

  //mensaje de error a mostrar en pantalla
  errorMensaje: string | null = null

  //bandera para no refrescar ui despues de destroy
  private destruido = false

  //====================================================================

  constructor() {
    //asigno observable del usuario desde auth
    this.usuario$ = this.auth.currentUser$
  }

  //====================================================================

  //se ejecuta al destruir el componente
  ngOnDestroy() {
    this.destruido = true
  }

  //====================================================================

  //se ejecuta al iniciar el componente
  ngOnInit() {
    //dispara la carga de todas las tablas
    void this.cargarResultados()
  }

  //====================================================================

  //obtiene datos de todas las tablas y llena los arrays
  private async cargarResultados() {
    //activo loader y limpio error
    this.cargando = true
    this.errorMensaje = null

    try {
      //pido al servicio las cuatro listas y el ranking general
      const datos = await this.resultadosService.traerResultados()

      //guardo listas por juego
      this.resultadosAhorcado = datos.ahorcado
      this.resultadosMayorMenor = datos.mayorMenor
      this.resultadosPreguntados = datos.preguntados
      this.resultadosConnect4 = datos.connect4

      //guardo ranking general
      this.rankingGeneral = datos.rankingGeneral

    } catch (error) {
      //si falla guardo mensaje para la ui
      console.log("error resultados", error)
      this.errorMensaje = "No se pudieron cargar los datos. Intenta nuevamente."
    } finally {
      //apago loader
      this.cargando = false
      //fuerzo change detection manual si el componente sigue vivo
      if (!this.destruido) {
        this.cdr.detectChanges()
      }
    }
  }
  
}
