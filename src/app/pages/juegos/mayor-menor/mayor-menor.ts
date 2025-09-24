import { CommonModule } from '@angular/common'
import { Component, OnDestroy, computed, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MatchPanel } from '../../../components/match-panel/match-panel'
import { Cards, CardData } from '../../../services/cards'
import { Auth } from '../../../services/auth'
import { Supabase } from '../../../services/supabase'
import { Translation } from '../../../services/translation'

@Component({
  selector: 'app-mayor-menor',
  imports: [CommonModule, RouterLink, MatchPanel],
  templateUrl: './mayor-menor.html',
  styleUrl: './mayor-menor.css'
})
export class MayorMenor implements OnDestroy {

  constructor(
    private readonly cardsApi: Cards,
    private readonly auth: Auth,
    private readonly supabase: Supabase,
    private readonly translation: Translation,
  ) {}

  //====================================================================

  //estado principal del juego
  readonly status = signal<'idle' | 'playing' | 'finishedLives' | 'finishedTime'>('idle')
  //idle = antes de empezar
  //playing = partida en curso
  //finishedLives = se terminaron las vidas
  //finishedTime = se termino el tiempo
  
  readonly currentCard = signal<CardData | null>(null) //carta visible para el jugador
  readonly nextCard = signal<CardData | null>(null) //carta que se usara en la siguiente ronda
  readonly loading = signal(false) //bandera de carga para bloquear botones
  readonly hits = signal(0) //contador de aciertos
  readonly fails = signal(0) //contador de errores
  readonly elapsedSeconds = signal(0) //segundos transcurridos en la sesion
  readonly remainingCards = signal(0) //cartas restantes segun la api
  readonly currentCardLabel = signal('') //nombre traducido de la carta actual
  readonly maxLives = 6 //vidas maximas de la partida
  readonly maxTimeSeconds = 180 //tiempo maximo de la partida en segundos

  //mensaje de retroalimentacion
  readonly feedback = signal('') //mensaje principal
  readonly feedbackDetail = signal('') //mensaje de detalle debajo del principal

  //calcula vidas restantes segun errores
  readonly remainingLives = computed(() => {
    const rest = this.maxLives - this.fails()
    return rest > 0 ? rest : 0
  })

  //calcula tiempo restante segun segundos transcurridos
  readonly remainingTime = computed(() => {
    const rest = this.maxTimeSeconds - this.elapsedSeconds()
    return rest > 0 ? rest : 0
  })

  //calcula rondas totales jugadas
  readonly totalRounds = computed(() => this.hits() + this.fails())

  //referencia del timer y marcas de control
  private timerRef: any = null //referencia del intervalo
  private sessionStart: number | null = null //marca de tiempo inicial
  private resultSaved = false //evita guardar dos veces

  //mapa de figuras a valores numericos
  private readonly figureValues: Record<string, number> = { ACE: 1, JACK: 11, QUEEN: 12, KING: 13 } //valores especiales

  //cache para evitar pedir traducciones repetidas
  private readonly cardNameCache = new Map<string, string>() //cache simple de traducciones

  //====================================================================

  //al destruir componente apago el timer
  ngOnDestroy() {
    this.stopTimer()
  }

  //====================================================================

  //inicia una nueva partida
  async startGame() {

    if (this.loading()) {
      return
    }

    //bloqueo ui y reseteo estado
    this.loading.set(true)
    this.status.set('idle')
    this.stopTimer()
    this.resultSaved = false
    this.feedback.set('')
    this.feedbackDetail.set('')
    this.hits.set(0)
    this.fails.set(0)
    this.elapsedSeconds.set(0)
    this.currentCardLabel.set('')

    try {
      //reseteo mazo y saco dos cartas para arrancar
      await this.cardsApi.resetDeck()
      const first = await this.cardsApi.drawCard()
      const second = await this.cardsApi.drawCard()
      if (!first || !second) {
        this.feedback.set('No se pudieron cargar las cartas. Intenta mas tarde.')
        this.status.set('idle')
        return
      }

      //seteo carta actual y siguiente
      this.currentCard.set(first)
      this.nextCard.set(second)

      //actualizo etiqueta traducida de la carta actual
      await this.updateCurrentCardLabel(first)

      //muestro cantidad restante
      this.remainingCards.set(this.cardsApi.getRemainingCards())

      //paso a jugando y arranco timer
      this.status.set('playing')
      this.startTimer()

    } finally {
      //desbloqueo ui
      this.loading.set(false)
    }
  }

  //====================================================================

  //elige si la siguiente carta es mayor o menor
  async guess(option: 'higher' | 'lower') {

    if (this.loading() || this.status() !== 'playing') {
      return
    }

    const current = this.currentCard()
    const next = this.nextCard()

    if (!current || !next) {
      return
    }

    //bloqueo mientras proceso la jugada
    this.loading.set(true)

    try {
      //convierto valores de cartas a numero
      const currentValue = this.parseCardValue(current.value)
      const nextValue = this.parseCardValue(next.value)

      //si empatan muevo la ventana y robo otra
      if (currentValue === nextValue) {
        const prevLabel = await this.getCardDisplayName(current) //traigo nombre completo traducido

        this.feedback.set('Salió una carta del mismo valor.')
        this.feedbackDetail.set(
          `La carta anterior era: ${prevLabel} → no suma acierto ni baja vida.`
        )

        this.currentCard.set(next)
        await this.updateCurrentCardLabel(next)
        const replacement = await this.cardsApi.drawCard()
        this.nextCard.set(replacement)
        this.remainingCards.set(this.cardsApi.getRemainingCards())
        return
      }

      //calculo si la prediccion es correcta
      const isHigher = nextValue > currentValue
      const isCorrect = option === 'higher' ? isHigher : !isHigher

      //traigo valor de la carta anterior
      const prevLabel = await this.getCardDisplayName(current)

      if (isCorrect) {
        this.hits.set(this.hits() + 1)
        this.feedback.set('Acertaste.')
        this.feedbackDetail.set(`La carta anterior era: ${prevLabel}`)
      } else {
        this.fails.set(this.fails() + 1)
        this.feedback.set('Fallaste.')
        this.feedbackDetail.set(`La carta anterior era: ${prevLabel}`)
      }


      //avanzo ventana de cartas
      this.currentCard.set(next)
      await this.updateCurrentCardLabel(next)

      //si el juego cambio de estado salgo
      if (this.status() !== 'playing') {
        return
      }

      //si no quedan vidas termino
      if (this.remainingLives() <= 0) {
        await this.finishGame('lives')
        return
      }

      //robo siguiente carta
      const upcoming = await this.cardsApi.drawCard()
      this.nextCard.set(upcoming)
      this.remainingCards.set(this.cardsApi.getRemainingCards())

      //si no hay mas cartas aviso que se baraja
      if (!upcoming) {
        this.feedback.set('No hay mas cartas disponibles. Se baraja de nuevo.')
      }

    } finally {
      //desbloqueo ui
      this.loading.set(false)
    }
  }

  //====================================================================

  //detiene la partida y guarda datos
  private async finishGame(reason: 'lives' | 'time') {

    if (this.resultSaved) {
      return
    }

    //freno timer y cambio estado final
    this.stopTimer()
    this.status.set(reason === 'lives' ? 'finishedLives' : 'finishedTime')

    //persisto resultados una sola vez
    await this.saveSession()
    this.resultSaved = true
  }

  //====================================================================

  //convierte valores de cartas a numeros
  private parseCardValue(value: string) {
    if (this.figureValues[value]) {
      return this.figureValues[value]
    }
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  //====================================================================

  //obtiene el nombre traducido de la carta
  private async getCardDisplayName(card: CardData) {

    //uso cache si existe
    const cached = this.cardNameCache.get(card.code)
    if (cached) {
      return cached
    }

    //armo nombre base en ingles
    const baseName = `${card.value} of ${card.suit}`
    //pido traduccion
    const translated = await this.translation.translateToSpanish(baseName)
    //fallback si no llega traduccion
    const safeLabel = translated ? translated : baseName
    //normalizo mayusculas
    const label = safeLabel.toUpperCase()
    //corrijo palos segun reglas pedidas
    const fixedLabel = this.fixSuitTranslation(label)

    //si es figura agrego valor numerico
    const figureValue = this.figureValues[card.value]
    if (figureValue) {
      const labelWithValue = `${fixedLabel} (${figureValue})`
      this.cardNameCache.set(card.code, labelWithValue)
      return labelWithValue
    }

    //guardo en cache y devuelvo
    this.cardNameCache.set(card.code, fixedLabel)
    return fixedLabel
  }

  //====================================================================

  //ajusta palos traducidos
  private fixSuitTranslation(label: string) {
    const replacements: Record<string, string> = { ESPADAS: 'PICAS', CLUBES: 'TRÉBOL' }
    var result = label
    for (const key of Object.keys(replacements)) {
      const value = replacements[key]
      result = result.replaceAll(key, value)
    }
    return result
  }

  //====================================================================

  //actualiza el texto visible de la carta
  private async updateCurrentCardLabel(card: CardData | null) {
    if (!card) {
      this.currentCardLabel.set('')
      return
    }
    //obtengo traduccion y seteo solo si la carta sigue siendo la actual
    const translated = await this.getCardDisplayName(card)
    if (this.currentCard()?.code === card.code) {
      this.currentCardLabel.set(translated)
    }
  }

  //====================================================================

  //inicia el temporizador
  private startTimer() {
    if (this.timerRef) {
      return
    }

    //guardo inicio de sesion y arranco intervalo
    this.sessionStart = Date.now()
    this.timerRef = setInterval(() => {
      if (!this.sessionStart) {
        return
      }

      //calculo segundos transcurridos y los limito al maximo
      const seconds = Math.floor((Date.now() - this.sessionStart) / 1000)
      const safeSeconds = Math.min(seconds, this.maxTimeSeconds)
      this.elapsedSeconds.set(safeSeconds)

      //si llego al limite termino por tiempo
      if (safeSeconds >= this.maxTimeSeconds) {
        void this.finishGame('time')
      }
    }, 1000)
  }

  //====================================================================

  //detiene el temporizador
  private stopTimer() {
    if (this.timerRef) {
      clearInterval(this.timerRef)
      this.timerRef = null
    }
    this.sessionStart = null
  }

  //====================================================================

  //guarda la sesion en supabase
  private async saveSession() {
    const user = this.auth.getCurrentUser()
    if (!user?.id) {
      console.log('no hay usuario logueado para guardar la partida')
      return
    }
    try {
      //inserto registro de la partida en tabla mayor_menor_partidas
      await this.supabase.client.from('mayor_menor_partidas').insert({
        user_id: user.id,
        usuario: user.nombre ?? user.email ?? 'Sin nombre',
        tiempo_total: this.elapsedSeconds(),
        vidas_restantes: this.remainingLives(),
        aciertos_totales: this.hits(),
      })
    } catch (error) {
      console.log('no se pudo guardar la partida', error)
    }
  }
  
}
