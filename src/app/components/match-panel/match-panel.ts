import { CommonModule } from '@angular/common'
import { Component, Input } from '@angular/core'

@Component({
  selector: 'app-match-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-panel.html',
  styleUrl: './match-panel.css'
})
export class MatchPanel {

  @Input() time = 0 //tiempo restante en segundos
  @Input() totalTime = 0 //tiempo total configurado para la partida
  @Input() remainingLives = 0 //vidas restantes calculadas fuera del componente
  @Input() totalLives = 6 //vidas totales disponibles
  @Input() hits = 0 //aciertos logrados

  //====================================================================

  //tiempo formateado mm:ss
  get formattedTime() {
    //calculo minutos y segundos
    const minutes = Math.floor(this.time / 60)
    const seconds = this.time % 60
    //le agrego 0 adelante si hace falta
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')
    //devuelvo el string formateado
    return `${mm}:${ss}`
  }

  //====================================================================

  //porcentaje restante para barra de progreso
  get timeProgress() {
    //si no hay tiempo total devuelvo 0
    if (this.totalTime <= 0) {
      return 0
    }
    //calculo el porcentaje
    const progress = (this.time / this.totalTime) * 100
    //limito entre 0 y 100 y redondeo
    return Math.max(0, Math.min(100, Math.round(progress)))
  }

  //====================================================================

  //aviso cuando queda poco tiempo
  get isTimeLow() {
    //si no hay tiempo total no muestro alerta
    if (this.totalTime <= 0) {
      return false
    }
    //umbral minimo 10 segundos o 10% del total
    const warningThreshold = Math.max(10, Math.floor(this.totalTime * 0.1))
    //devuelvo true si el tiempo actual esta por debajo
    return this.time <= warningThreshold
  }

  //====================================================================

  //aviso cuando queda una vida o ninguna
  get isLivesLow() {
    return this.remainingLives <= 1
  }

  //====================================================================

  //ruta de la imagen de vidas
  get livesImage() {
    //limito el valor para no pasarme ni ir negativo
    const safe = Math.min(this.totalLives, Math.max(0, this.remainingLives))
    //armo la ruta a la imagen segun cantidad de vidas
    return `assets/images/vidas/${safe}-vidas.png`
  }
  
}
