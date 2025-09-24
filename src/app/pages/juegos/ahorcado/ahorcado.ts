import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { Hangman } from '../../../services/hangman'
import { Translation } from '../../../services/translation'
import { Auth } from '../../../services/auth'
import { Supabase } from '../../../services/supabase'
import { MatchPanel } from '../../../components/match-panel/match-panel'

@Component({
  selector: 'app-ahorcado',
  imports: [CommonModule, MatchPanel, RouterLink],
  templateUrl: './ahorcado.html',
  styleUrl: './ahorcado.css'
})
export class Ahorcado implements OnInit, OnDestroy {

  //servicios del juego
  constructor(
    private readonly hangmanApi: Hangman,
    private readonly translation: Translation,
    private readonly auth: Auth,
    private readonly supabase: Supabase,
  ) {}

  //====================================================================

  //teclado en filas para la ui
  readonly keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ]

  //====================================================================

  //mapa de categorias traducidas
  readonly categoryLabels: Record<string, string> = {
    animal: 'Animales',
    country: 'Países',
    food: 'Comidas',
    plant: 'Plantas',
    sport: 'Deportes',
  }

  //====================================================================

  //estado principal de carga y datos
  loading = signal(false) //estado de carga
  categories = signal<string[]>([]) //lista de categorias disponibles
  selectedCategory = signal('') //categoria elegida por el jugador
  loadError = signal<string | null>(null) //mensaje de error si falla la carga
  englishWord = signal('') //palabra original en ingles
  spanishWord = signal('') //palabra en espanol en mayuscula
  normalizedLetters = signal<string[]>([]) //palabra normalizada letra por letra
  targetLetters = signal<string[]>([]) //letras objetivo sin repetir para ganar
  category = signal('') //categoria de la palabra actual
  hint = signal('') //pista opcional traducida
  usedLetters = signal<string[]>([]) //historial de letras seleccionadas
  wrongAttempts = signal(0) //cantidad de errores de la ronda
  completedWords = signal(0) //contador de palabras resueltas en la sesion
  elapsedSeconds = signal(0) //tiempo transcurrido en segundos
  lastSolvedWord = signal('') //ultima palabra resuelta para mostrar como feedback
  finalWord = signal('') //palabra de la ronda al finalizar (vidas o tiempo)



  //estado global del juego
  gameStatus = signal<'idle' | 'playing' | 'sessionOutOfLives' | 'sessionTimeUp'>('idle')
  //idle = sesion iniciada pero esperando que llegue una nueva palabra
  //playing = partida en curso el jugador esta jugando
  //sessionOutOfLives = sesion terminada porque no quedan vidas
  //sessionTimeUp = sesion terminada porque se acabo el tiempo

  hasSessionStarted = signal(false) //indica si el jugador ya inicio la sesion

  //refs internas para timer y control de sesion
  private timerRef: any = null //referencia del timer
  private sessionStartTimestamp: number | null = null //inicio de sesion en ms
  private sessionRunning = false //bandera de sesion activa
  private usedWordsSet = new Set<string>() //set de palabras ya usadas en la sesion

  //limites del juego
  readonly maxFails = 6 //maximo de errores
  readonly maxTimeSeconds = 180 //tiempo limite en seg

  //====================================================================

  //intentos restantes calculados
  remainingAttempts = computed(() => {
    //calculo resto sin negativos
    const rest = this.maxFails - this.wrongAttempts()
    return rest > 0 ? rest : 0
  })

  //====================================================================

  //tiempo restante calculado
  remainingTime = computed(() => {
    //calculo resto sin negativos
    const rest = this.maxTimeSeconds - this.elapsedSeconds()
    return rest > 0 ? rest : 0
  })

  //====================================================================

  //imagen segun cantidad de errores
  hangmanImage = computed(() => {
    //limito rango de errores
    const fails = this.wrongAttempts()
    const safeFails = Math.max(0, Math.min(this.maxFails, fails))
    //ruta a imagen segun estado
    return `assets/images/ahorcado/${safeFails}-pos.jpg`
  })

  //====================================================================

  //palabra enmascarada separada por palabras
  maskedWords = computed(() => {
    const s = this.spanishWord()
    const n = this.normalizedLetters()
    const used = this.usedLetters().map(l => this.normalizeLetter(l))
    //si el caracter no es letra objetivo lo muestro tal cual
    //si es letra objetivo lo muestro solo si ya fue usada
    const chars = s.split('').map((ch, i) => {
      const t = this.targetLetters().includes(n[i] ?? '')
      if (!t) return ch
      return used.includes(n[i] ?? '') ? ch : '_'
    })
    //devuelvo array de palabras para pintar con espacios entre spans
    return chars.join('').split(' ')
  })

  //====================================================================

  //ciclo de vida inicio
  ngOnInit() {
    //cargo categorias al entrar
    void this.loadCategories()
  }

  //====================================================================

  //ciclo de vida destruccion
  ngOnDestroy() {
    //apago timer y marco sesion inactiva
    this.stopTimer()
    this.sessionRunning = false
  }

  //====================================================================

  //carga categorias desde api
  private async loadCategories() {
    try {
      const categorias = await this.hangmanApi.fetchCategories()
      this.categories.set(categorias)
      if (categorias.length > 0) {
        this.selectedCategory.set(categorias[0]) //selecciono primera por defecto
      }
    } catch (error) {
      console.log('no pude cargar categorias', error)
      this.loadError.set('No se pudieron cargar las categorias. Intenta mas tarde.')
    }
  }

  //====================================================================

  //evento de cambio de categoria
  onCategoryChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement
    const value = selectElement.value
    this.selectedCategory.set(value)
    //si ya habia sesion activo nueva palabra
    if (this.hasSessionStarted()) {
      void this.startNewGame()
    }
  }

  //====================================================================

  //reintenta cargar categorias o nueva palabra
  retryLoad() {
    if (this.categories().length === 0) {
      void this.loadCategories()
      return
    }
    if (this.hasSessionStarted()) {
      void this.startNewGame()
    }
  }

  //====================================================================

  //marca inicio de sesion y arranca primer juego
  startSession() {
    this.hasSessionStarted.set(true)
    void this.startNewGame()
  }

  //====================================================================

  //inicia una nueva ronda con palabra nueva
  async startNewGame() {
    if (!this.selectedCategory()) {
      this.loadError.set('Elige una categoria para empezar la partida.')
      return
    }
    this.hasSessionStarted.set(true)

    //defino si arranca sesion desde cero
    const startingNewSession =
      !this.sessionRunning ||
      this.gameStatus() === 'sessionOutOfLives' ||
      this.gameStatus() === 'sessionTimeUp'

    //preparo estado base
    this.loading.set(true)
    this.loadError.set(null)
    this.gameStatus.set('idle')

    //si empieza sesion reseteo todo
    if (startingNewSession) {
      this.resetSessionState()
    }

    try {
      const category = this.selectedCategory()

      //busco palabra no repetida hasta 5 intentos
      let word: any = null
      for (let i = 0; i < 5; i++) {
        const candidate = await this.hangmanApi.fetchRandomWordByCategory(category)
        const key = (candidate.word ?? '').toUpperCase()
        if (!this.usedWordsSet.has(key)) {
          this.usedWordsSet.add(key)
          word = candidate
          break
        }
      }
      //si no encontre uso fallback y la marco como usada
      if (!word) {
        const fallback = await this.hangmanApi.fetchRandomWordByCategory(category)
        const key = (fallback.word ?? '').toUpperCase()
        this.usedWordsSet.add(key)
        word = fallback
      }

      //seteo palabra e info base
      this.englishWord.set(word.word.toUpperCase())
      this.category.set(word.category ?? category)

      //preparo pista en limpio
      const englishHint = (word.hint ?? '').trim()
      this.hint.set('')

      //traduzco palabra con fallback
      let translated = ''
      try {
        translated = await this.translation.translateToSpanish(word.word)
      } catch (error) {
        console.log('fallo la traduccion uso palabra original', error)
        translated = word.word
      }
      if (!translated || translated.trim().length === 0) {
        translated = word.word
      }

      //armo palabra en espanol y estructuras auxiliares
      this.prepareSpanishWord(translated)
      this.usedLetters.set([])

      //si hay pista traduzco con fallback
      if (englishHint.length > 0) {
        let translatedHint = englishHint
        try {
          translatedHint = await this.translation.translateToSpanish(englishHint)
        } catch (error) {
          console.log('fallo la traduccion de la pista uso original', error)
        }
        this.hint.set(translatedHint)
      }

      console.log('palabra:', this.spanishWord())

      //si no hay letras objetivo aviso error
      if (this.targetLetters().length === 0) {
        this.loadError.set('La palabra recibida no es valida. Intenta de nuevo.')
        this.gameStatus.set('idle')
        return
      }

      //inicio juego y timer
      this.gameStatus.set('playing')
      this.sessionRunning = true
      this.startTimer()
    } catch (error) {
      //error de carga de palabra
      this.loadError.set('No se pudo cargar una palabra. Prueba de nuevo mas tarde.')
      if (startingNewSession) {
        this.sessionRunning = false
      }
    } finally {
      //fin de carga
      this.loading.set(false)
    }
  }

  //====================================================================

  //click de letra del teclado
  onLetterSelected(letter: string) {
    if (this.gameStatus() !== 'playing') return
    if (this.usedLetters().includes(letter)) return

    //agrego letra a usadas
    const nextLetters = [...this.usedLetters(), letter]
    this.usedLetters.set(nextLetters)

    //normalizo letra y usadas
    const normalizedLetter = this.normalizeLetter(letter)
    const normalizedUsed = nextLetters.map(item => this.normalizeLetter(item))

    //si la letra esta en objetivo verifico si ya se completo todo
    if (this.targetLetters().includes(normalizedLetter)) {
      const allTargets = this.targetLetters()
      const allGuessed = allTargets.every(target => normalizedUsed.includes(target))
      if (allGuessed) {
        this.completeRound()
      }
    } else {
      //sino sumo error y valido fin por vidas
      this.wrongAttempts.update(value => value + 1)
      if (this.wrongAttempts() >= this.maxFails) {
        void this.finishSession('lives')
      }
    }
  }

  //====================================================================

  //resetea toda la sesion a estado inicial
  private resetSessionState() {
    this.stopTimer()
    this.wrongAttempts.set(0)
    this.completedWords.set(0)
    this.elapsedSeconds.set(0)
    this.usedLetters.set([])
    this.normalizedLetters.set([])
    this.targetLetters.set([])
    this.englishWord.set('')
    this.spanishWord.set('')
    this.hint.set('')
    this.lastSolvedWord.set('')
    this.sessionRunning = false
    this.gameStatus.set('idle')
    this.usedWordsSet.clear()
    this.finalWord.set('')
  }

  //====================================================================

  //marca ronda completa y prepara nueva palabra
  private completeRound() {
    if (this.gameStatus() !== 'playing') return
    //guardo ultima palabra resuelta para mostrar debajo de categoria y pista
    this.lastSolvedWord.set(this.spanishWord())
    this.completedWords.update(value => value + 1)
    void this.startNewGame()
  }

  //====================================================================

  //finaliza la sesion por vidas o por tiempo y guarda en base
  private async finishSession(reason: 'lives' | 'time') {
    if (this.gameStatus() === 'sessionOutOfLives' || this.gameStatus() === 'sessionTimeUp') return

    //guardo siempre la palabra que estaba en juego
    this.finalWord.set(this.spanishWord())

    this.gameStatus.set(reason === 'lives' ? 'sessionOutOfLives' : 'sessionTimeUp')
    this.stopTimer()
    this.sessionRunning = false
    await this.saveSession(reason)
  }

  //====================================================================

  //prepara estructuras de la palabra en espanol
  private prepareSpanishWord(word: string) {
    const upper = word.toUpperCase().trim()
    this.spanishWord.set(upper)

    //normalizo cada caracter
    const normalized = upper.split('').map(char => this.normalizeLetter(char))
    this.normalizedLetters.set(normalized)

    //filtra solo letras del alfabeto manteniendo posiciones
    const validLetters = normalized.filter((_, index) => {
      const isLetter = this.isAlphabetChar(upper[index] ?? '')
      return isLetter
    })
    //saco repetidas y vacios
    const unique = Array.from(new Set(validLetters)).filter(char => char !== '')
    this.targetLetters.set(unique)
  }

  //====================================================================

  //normaliza letra quitando acentos y simbolos excepto ñ
  private normalizeLetter(char: string) {
    if (char === 'Ñ') return 'Ñ'
    const base = char
      .normalize('NFD')
      .replace(/[^\w\s]|_/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
    return base.charAt(0)
  }

  //====================================================================

  //verifica si es una letra del alfabeto o ñ
  private isAlphabetChar(char: string) {
    const normalized = this.normalizeLetter(char)
    return /^[A-Z]$/.test(normalized) || normalized === 'Ñ'
  }

  //====================================================================

  //inicia timer acumulando tiempo previo si existia
  private startTimer() {
    if (this.timerRef) return
    if (!this.sessionStartTimestamp) {
      this.sessionStartTimestamp = Date.now() - this.elapsedSeconds() * 1000
    }
    this.timerRef = setInterval(() => {
      if (!this.sessionStartTimestamp) return
      const seconds = Math.floor((Date.now() - this.sessionStartTimestamp) / 1000)
      const safeSeconds = Math.min(seconds, this.maxTimeSeconds)
      this.elapsedSeconds.set(safeSeconds)
      if (safeSeconds >= this.maxTimeSeconds) {
        void this.finishSession('time')
      }
    }, 1000)
  }

  //====================================================================

  //detiene timer y limpia referencia
  private stopTimer() {
    if (this.timerRef) {
      clearInterval(this.timerRef)
      this.timerRef = null
    }
    this.sessionStartTimestamp = null
  }

  //====================================================================

  //guarda la sesion en supabase
  private async saveSession(_reason: 'lives' | 'time') {
    const user = this.auth.getCurrentUser()
    if (!user?.id) {
      console.log('no se guardo la partida porque no hay usuario logueado')
      return
    }
    try {
      await this.supabase.client.from('ahorcado_partidas').insert({
        user_id: user.id,
        usuario: user.nombre ?? user.email ?? 'Sin nombre',
        tiempo_total: this.elapsedSeconds(),
        vidas_restantes: this.remainingAttempts(),
        aciertos_totales: this.completedWords(),
      })
    } catch (error) {
      console.log('hubo un problema guardando la partida en supabase', error)
    }
  }
  
}
