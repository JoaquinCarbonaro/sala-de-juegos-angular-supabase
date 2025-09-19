import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core'
import { HangmanApi } from '../../../services/hangman'
import { Translation } from '../../../services/translation'
import { Auth } from '../../../services/auth'
import { Supabase } from '../../../services/supabase'
import { MatchPanel } from '../../../components/match-panel/match-panel'

@Component({
  selector: 'app-ahorcado',
  imports: [CommonModule, MatchPanel],
  templateUrl: './ahorcado.html',
  styleUrl: './ahorcado.css'
})
export class Ahorcado implements OnInit, OnDestroy {

  //servicios del juego
  constructor(
    private readonly hangmanApi: HangmanApi,
    private readonly translation: Translation,
    private readonly auth: Auth,
    private readonly supabase: Supabase,
  ) {}

  //====================================================================

  //teclado qwerty esp
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

  loading = signal(false) //estado de carga
  categories = signal<string[]>([]) //lista de categorias
  selectedCategory = signal('') //categoria elegida
  loadError = signal<string | null>(null) //mensaje de error
  englishWord = signal('') //palabra original en ingles
  spanishWord = signal('') //palabra en español (en mayuscula)
  normalizedLetters = signal<string[]>([]) //lista normalizada para comparar
  targetLetters = signal<string[]>([]) //letras objetivo sin repetir
  category = signal('') //categoria de la palabra
  hint = signal('') //pista opcional
  usedLetters = signal<string[]>([]) //historial de letras usadas
  wrongAttempts = signal(0) //cantidad de errores
  completedWords = signal(0) //palabras completas en la sesion
  elapsedSeconds = signal(0) //tiempo transcurrido en seg

  //estado global del juego
  gameStatus = signal<'idle' | 'playing' | 'roundWon' | 'sessionOutOfLives' | 'sessionTimeUp'>('idle') 
  //idle = juego esperando o recien cargado sin partida (se muestra pantalla en espera)
  //playing = partida en curso, el jugador esta jugando
  //roundWon = ronda completada, palabra adivinada (se muestra modal de victoria)
  //sessionOutOfLives = partida terminada porque no quedan vidas (termina la sesion)
  //sessionTimeUp = partida terminada porque se acabo el tiempo (termina la sesion)

  private timerRef: any = null //referencia del timer
  private sessionStartTimestamp: number | null = null //inicio de sesion en ms
  private sessionRunning = false //bandera de sesion activa

  readonly maxFails = 6 //maximo de errores
  readonly maxTimeSeconds = 180 //tiempo limite en seg

  //palabras usadas en la sesion
  private usedWordsSet = new Set<string>()

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

  //imagen segun errores
  hangmanImage = computed(() => {
    //limito rango de errores
    const fails = this.wrongAttempts()
    const safeFails = Math.max(0, Math.min(this.maxFails, fails))
    //devuelvo ruta de imagen
    return `assets/images/ahorcado/${safeFails}-pos.jpg`
  })

  //====================================================================

  //palabra enmascarada por palabras
  maskedWords = computed(() => {
    const s = this.spanishWord() //tomo palabra traducida en esp
    const n = this.normalizedLetters() //lista de letras normalizadas
    const used = this.usedLetters().map(l => this.normalizeLetter(l)) //letras ya usadas normalizadas

    //recorro cada caracter de la palabra
    const chars = s.split('').map((ch,i)=>{

      //veo si el caracter es letra objetivo
      const t = this.targetLetters().includes(n[i] ?? '')

      if(!t) return ch //si no es letra objetivo lo dejo igual

      //si la letra ya fue usada la muestro, si no pongo guion bajo
      return used.includes(n[i] ?? '') ? ch : '_'
    })
    
    //junto todo y divido por espacio para armar array de palabras
    return chars.join('').split(' ') //array de palabras ya enmascaradas
  })

  //====================================================================

  //ciclo de vida init
  ngOnInit() {
    //cargo categorias al iniciar
    void this.loadCategories()
  }

  //====================================================================

  //ciclo de vida destroy
  ngOnDestroy() {
    //detengo timer y marco fin de sesion
    this.stopTimer()
    this.sessionRunning = false
  }

  //====================================================================

  //carga inicial de categorias
  private async loadCategories() {
    //pido categorias y seteo estado
    try {
      const categorias = await this.hangmanApi.fetchCategories()
      this.categories.set(categorias)
      //si hay categorias elijo la primera y comienzo
      if (categorias.length > 0) {
        this.selectedCategory.set(categorias[0])
        await this.startNewGame()
      }
    } catch (error) {
      //guardo mensaje simple de error
      console.log('no pude cargar categorias', error)
      this.loadError.set('No se pudieron cargar las categorias. Intenta mas tarde.')
    }
  }

  //====================================================================

  //cambio de categoria desde el select
  onCategoryChange(event: Event) {
    //actualizo categoria y reinicio
    const selectElement = event.target as HTMLSelectElement
    const value = selectElement.value
    this.selectedCategory.set(value)
    void this.startNewGame()
  }

  //====================================================================

  //reintento de carga
  retryLoad() {
    //si no hay categorias las vuelvo a pedir
    if (this.categories().length === 0) {
      void this.loadCategories()
      return
    }
    //si hay categorias solo reinicio palabra
    void this.startNewGame()
  }

  //====================================================================

  //inicia una nueva ronda o sesion
  async startNewGame() {
    //si no hay categoria informo y salgo
    if (!this.selectedCategory()) {
      this.loadError.set('Elige una categoria para empezar la partida.')
      return
    }
    //verifico si arranca sesion nueva
    const startingNewSession =
      !this.sessionRunning ||
      this.gameStatus() === 'sessionOutOfLives' ||
      this.gameStatus() === 'sessionTimeUp'

    //marco loading y limpio estados de error
    this.loading.set(true)
    this.loadError.set(null)
    this.gameStatus.set('idle')

    //si es sesion nueva reinicio contadores
    if (startingNewSession) {
      this.resetSessionState()
    }

    try {
      //traigo palabra filtrada por categoria intentando no repetir
      const category = this.selectedCategory()

      //busco palabra que no se haya usado en esta sesion
      var word: any = null
      for (var i = 0; i < 5; i++) { //maximo 5 intentos
        const candidate = await this.hangmanApi.fetchRandomWordByCategory(category)
        const key = (candidate.word ?? '').toUpperCase()
        if (!this.usedWordsSet.has(key)) {
          //guardo como usada y la tomo
          this.usedWordsSet.add(key)
          word = candidate
          break
        }
      }
      //si no encontre nueva en 5 intentos tomo la ultima aunque sea repetida
      if (!word) {
        const fallback = await this.hangmanApi.fetchRandomWordByCategory(category)
        const key = (fallback.word ?? '').toUpperCase()
        this.usedWordsSet.add(key)
        word = fallback
      }

      //guardo palabra en ingles mayus
      this.englishWord.set(word.word.toUpperCase())
      //guardo categoria de respaldo
      this.category.set(word.category ?? category)
      //reseteo pista mientras traduzco
      const englishHint = (word.hint ?? '').trim()
      this.hint.set('')
      //traduzco palabra con fallback
      var translated = ''
      try {
        translated = await this.translation.translateToSpanish(word.word)
      } catch (error) {
        console.log('fallo la traduccion uso palabra original', error)
        translated = word.word
      }
      //si viene vacio uso original
      if (!translated || translated.trim().length === 0) {
        translated = word.word
      }
      //preparo palabra en esp para jugar
      this.prepareSpanishWord(translated)
      //limpio letras usadas
      this.usedLetters.set([])
      //traduzco pista si existe con fallback
      if (englishHint.length > 0) {
        var translatedHint = englishHint
        try {
          translatedHint = await this.translation.translateToSpanish(englishHint)
        } catch (error) {
          console.log('fallo la traduccion de la pista uso original', error)
        }
        this.hint.set(translatedHint)
      }
      //muestro por consola para pruebas
      console.log('palabra en esp para pruebas:', this.spanishWord())
      //verifico que haya letras validas
      if (this.targetLetters().length === 0) {
        this.loadError.set('La palabra recibida no es valida. Intenta de nuevo.')
        this.gameStatus.set('idle')
        return
      }
      //activo partida y timer
      this.gameStatus.set('playing')
      this.sessionRunning = true
      this.startTimer()
    } catch (error) {
      //error al cargar palabra
      this.loadError.set('No se pudo cargar una palabra. Prueba de nuevo mas tarde.')
      if (startingNewSession) {
        this.sessionRunning = false
      }
    } finally {
      //quito loading
      this.loading.set(false)
    }
  }

  //====================================================================

  //manejo de letra elegida
  onLetterSelected(letter: string) {
    //si no esta jugando salgo
    if (this.gameStatus() !== 'playing') {
      return
    }
    //si la letra ya se uso salgo
    if (this.usedLetters().includes(letter)) {
      return
    }
    //agrego letra al historial
    const nextLetters = [...this.usedLetters(), letter]
    this.usedLetters.set(nextLetters)
    //normalizo letra para comparar
    const normalizedLetter = this.normalizeLetter(letter)
    //conjunto normalizado de usadas
    const normalizedUsed = nextLetters.map((item) => this.normalizeLetter(item))
    //si pertenece a la palabra verifico victoria
    if (this.targetLetters().includes(normalizedLetter)) {
      const allTargets = this.targetLetters()
      //todas las letras objetivo ya usadas
      const allGuessed = allTargets.every((target) => normalizedUsed.includes(target))
      if (allGuessed) {
        this.completeRound()
      }
    } else {
      //no pertenece sumo error
      this.wrongAttempts.update((value) => value + 1)
      //si llego al maximo termina por vidas
      if (this.wrongAttempts() >= this.maxFails) {
        void this.finishSession('lives')
      }
    }
  }

  //====================================================================

  //reinicio de estado de sesion
  private resetSessionState() {
    //limpio contadores y estados
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
    this.sessionRunning = false
    this.gameStatus.set('idle')
    this.usedWordsSet.clear()
  }

  //====================================================================

  //completa una ronda
  private completeRound() {
    //evito cambios si no esta jugando
    if (this.gameStatus() !== 'playing') {
      return
    }
    //sumo acierto
    this.completedWords.update((value) => value + 1)
    //muestro modal de ronda ganada
    this.gameStatus.set('roundWon')
  }

  //====================================================================

  //finaliza sesion por vidas o tiempo
  private async finishSession(reason: 'lives' | 'time') {
    //si ya termino no repito acciones
    if (this.gameStatus() === 'sessionOutOfLives' || this.gameStatus() === 'sessionTimeUp') {
      return
    }
    //actualizo estado segun motivo
    this.gameStatus.set(reason === 'lives' ? 'sessionOutOfLives' : 'sessionTimeUp')
    //detengo timer y cierro sesion
    this.stopTimer()
    this.sessionRunning = false
    //guardo resultados
    await this.saveSession(reason)
  }

  //====================================================================

  //prepara palabra traducida y normalizada
  private prepareSpanishWord(word: string) {
    //paso a mayus y recorto espacios
    const upper = word.toUpperCase().trim()
    //guardo palabra para mostrar
    this.spanishWord.set(upper)
    //lista normalizada por caracter
    const normalized = upper.split('').map((char) => this.normalizeLetter(char))
    this.normalizedLetters.set(normalized)
    //letras validas sin repetir
    const validLetters = normalized.filter((char, index) => {
      const isLetter = this.isAlphabetChar(upper[index] ?? '')
      return isLetter
    })
    const unique = Array.from(new Set(validLetters)).filter((char) => char !== '')
    this.targetLetters.set(unique)
  }

  //====================================================================

  //normaliza un caracter
  private normalizeLetter(char: string) {
    //caso especial para la letra n con tilde
    if (char === 'Ñ') {
      return 'Ñ'
    }
    //elimino tildes y simbolos y paso a mayus
    const base = char
      .normalize('NFD')
      .replace(/[^\w\s]|_/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
    //tomo primer caracter
    return base.charAt(0)
  }

  //====================================================================

  //verifica si es letra del alfabeto
  private isAlphabetChar(char: string) {
    //acepto a a z y la letra n con tilde
    const normalized = this.normalizeLetter(char)
    return /^[A-Z]$/.test(normalized) || normalized === 'Ñ'
  }

  //====================================================================

  //inicia timer del juego
  private startTimer() {
    //si ya corre no hago nada
    if (this.timerRef) {
      return
    }
    //configuro inicio con desfase si corresponde
    if (!this.sessionStartTimestamp) {
      this.sessionStartTimestamp = Date.now() - this.elapsedSeconds() * 1000
    }
    //tick cada segundo
    this.timerRef = setInterval(() => {
      if (!this.sessionStartTimestamp) {
        return
      }
      const seconds = Math.floor((Date.now() - this.sessionStartTimestamp) / 1000)
      const safeSeconds = Math.min(seconds, this.maxTimeSeconds)
      this.elapsedSeconds.set(safeSeconds)
      //si se agota el tiempo finalizo
      if (safeSeconds >= this.maxTimeSeconds) {
        void this.finishSession('time')
      }
    }, 1000)
  }

  //====================================================================

  //detiene el timer
  private stopTimer() {
    //limpio intervalo si existe
    if (this.timerRef) {
      clearInterval(this.timerRef)
      this.timerRef = null
    }
    this.sessionStartTimestamp = null
  }

  //====================================================================

  //guarda resultados de sesion en supabase
  private async saveSession(reason: 'lives' | 'time') {
    //busco usuario actual
    const user = this.auth.getCurrentUser()
    //si no hay usuario salgo
    if (!user?.id) {
      console.log('no se guardo la partida porque no hay usuario logueado')
      return
    }
    try {
      //inserto datos en tabla
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
