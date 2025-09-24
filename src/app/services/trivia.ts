import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import {
  TriviaCategoryGroup,
  TriviaCategoryListResponse,
  TriviaGroupId,
  TriviaQuestion,
  TriviaQuestionListResponse,
  TriviaSessionTokenResponse,
} from '../interface/open-trivia-database'

//====================================================================

@Injectable({ providedIn: 'root' })
export class Trivia {

  //urls base de la api de trivia
  private readonly baseUrl = 'https://opentdb.com/api.php'
  private readonly categoryUrl = 'https://opentdb.com/api_category.php'
  private readonly tokenUrl = 'https://opentdb.com/api_token.php'

  //cache de grupos de categorias permitidas
  private groupsCache: TriviaCategoryGroup[] | null = null

  //token de sesion para evitar preguntas repetidas
  private sessionToken: string | null = null

  //mapeo de nombres reales a grupos permitidos
  private readonly allowedNames: Record<TriviaGroupId, string[]> = {
    entertainment: [
      'Entertainment: Books',
      'Entertainment: Film',
      'Entertainment: Music',
      'Entertainment: Television',
      'Entertainment: Video Games',
      'Entertainment: Board Games',
    ],
    sports: ['Sports'],
    science: ['Science & Nature', 'Science: Computers', 'Science: Mathematics'],
    history: ['History'],
  }

  //fallback por si la api de categorias falla
  private readonly fallbackGroups: TriviaCategoryGroup[] = [
    { id: 'entertainment', label: 'Entretenimiento', categoryIds: [10, 11, 12, 14, 15, 16] },
    { id: 'sports', label: 'Deportes', categoryIds: [21] },
    { id: 'science', label: 'Ciencia', categoryIds: [17, 18, 19] },
    { id: 'history', label: 'Historia', categoryIds: [23] },
  ]

  constructor(private readonly http: HttpClient) {}

  //====================================================================

  //obtiene grupos permitidos, usando cache cuando existe
  async getAllowedGroups() {
    //si ya tengo cache devuelvo directo
    if (this.groupsCache) {
      return this.groupsCache
    }
    try {
      //pido categorias a la api
      const response = await firstValueFrom(
        this.http.get<TriviaCategoryListResponse>(this.categoryUrl)
      )
      const categories = response?.trivia_categories ?? []

      //mapeo nombres reales a ids segun allowedNames
      const mapped: TriviaCategoryGroup[] = []
      for (const key of Object.keys(this.allowedNames) as TriviaGroupId[]) {
        const names = this.allowedNames[key]
        const ids = categories
          .filter(cat => names.includes(cat.name))
          .map(cat => cat.id)
        if (ids.length > 0) {
          mapped.push({
            id: key,
            label: this.getGroupLabel(key),
            categoryIds: ids,
          })
        }
      }

      //si no encontre nada uso fallback
      if (mapped.length === 0) {
        this.groupsCache = this.fallbackGroups
      } else {
        this.groupsCache = mapped
      }
    } catch (error) {
      //si falla la api de categorias uso fallback
      console.log('no pude cargar categorias de trivia', error)
      this.groupsCache = this.fallbackGroups
    }
    return this.groupsCache
  }

  //====================================================================

  //busca preguntas filtradas por grupo y dificultad
  async fetchQuestions(groupId: TriviaGroupId, difficulty: 'easy' | 'medium' | 'hard', amount: number): Promise<TriviaQuestion[]>{ //retorna preguntas ya tipadas con triviaquestion
    //traigo grupos y valido que exista el elegido
    const groups = await this.getAllowedGroups()
    const group = groups.find(item => item.id === groupId)
    if (!group || group.categoryIds.length === 0) {
      return []
    }

    //dos intentos por si hay que regenerar token
    const attempts = [0, 1]
    for (const _ of attempts) {
      //elijo una categoria dentro del grupo
      const categoryId = this.pickCategoryId(group)

      //aseguro token pero sin forzarlo
      const token = await this.ensureToken(false)

      //armo url con encode url3986 para luego decodificar
      var url = `${this.baseUrl}?amount=${amount}&category=${categoryId}&difficulty=${difficulty}&type=multiple&encode=url3986`
      if (token) {
        url = `${url}&token=${token}`
      }

      try {
        //pido preguntas
        const response = await firstValueFrom(
          this.http.get<TriviaQuestionListResponse>(url)
        )
        const code = response?.response_code ?? 0

        //codigo 0: exito
        if (code === 0 && Array.isArray(response?.results)) {
          return response.results
        }

        //codigo 4 o 3: token agotado o invalido -> regenero y reintento
        if (code === 4 || code === 3) {
          await this.ensureToken(true)
          continue
        }

        //codigo 1: no hay preguntas disponibles para ese filtro
        if (code === 1) {
          return []
        }
      } catch (error) {
        //error de red o formato
        console.log('no pude traer preguntas de trivia', error)
        return []
      }
    }
    //si todos los intentos fallan retorno vacio
    return []
  }

  //====================================================================

  //elige un id de categoria dentro del grupo
  private pickCategoryId(group: TriviaCategoryGroup) {
    const total = group.categoryIds.length
    const index = Math.floor(Math.random() * total)
    return group.categoryIds[index] ?? group.categoryIds[0]
  }

  //====================================================================

  //devuelve etiqueta legible para el grupo
  private getGroupLabel(group: TriviaGroupId) {
    if (group === 'entertainment') {
      return 'Entretenimiento'
    }
    if (group === 'sports') {
      return 'Deportes'
    }
    if (group === 'science') {
      return 'Ciencia'
    }
    return 'Historia'
  }

  //====================================================================
  
  //asegura token de sesion para evitar preguntas repetidas
  private async ensureToken(forceNew: boolean) {
    //si piden forzar token nuevo lo borro
    if (forceNew) {
      this.sessionToken = null
    }
    //si ya tengo token lo devuelvo
    if (this.sessionToken) {
      return this.sessionToken
    }
    try {
      //solicito un token de sesion
      const response = await firstValueFrom(
        this.http.get<TriviaSessionTokenResponse>(`${this.tokenUrl}?command=request`)
      )
      if (response?.token) {
        this.sessionToken = response.token
        return this.sessionToken
      }
    } catch (error) {
      //si no hay token sigo sin el
      console.log('no pude obtener token de trivia', error)
    }
    return null
  }

}
