import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { WordGameWord } from '../interface/word-game-word'

@Injectable({ providedIn: 'root' })
export class Hangman {

  private readonly baseUrl = 'https://www.wordgamedb.com/api/v1' //url base de la api wordgamedb
  private readonly categoriesUrl = `${this.baseUrl}/categories` //endpoint de categorias
  private readonly randomWordUrl = `${this.baseUrl}/words/random` //endpoint para pedir palabra random
  private readonly wordsUrl = `${this.baseUrl}/words` //endpoint generico de palabras

  //====================================================================

  //inyecto httpclient para peticiones
  constructor(private readonly http: HttpClient) {}

  //====================================================================

  //trae todas las categorias
  async fetchCategories() {
    //pido categorias a la api
    const respuesta = await firstValueFrom(this.http.get<Record<string, string>>(this.categoriesUrl))
    
    //convierto objeto en array
    const valores = Object.values(respuesta)

    //devuelvo array
    return valores
  }

  //====================================================================

  //trae una palabra random sin filtro
  async fetchRandomWord() {

    //hago peticion a endpoint random
    const respuesta = await firstValueFrom(this.http.get<WordGameWord>(this.randomWordUrl))

    //devuelvo palabra
    return respuesta
  }

  //====================================================================

  //trae una palabra random segun categoria
  async fetchRandomWordByCategory(category: string) {

    //armo url con query de categoria
    const url = `${this.wordsUrl}/?category=${encodeURIComponent(category)}`

    //pido listado de palabras de esa categoria
    const palabras = await firstValueFrom(this.http.get<WordGameWord[]>(url))

    //si no hay palabras lanzo error
    if (!palabras || palabras.length === 0) {
      throw new Error('Sin palabras disponibles para la categoria elegida')
    }

    //elijo indice random
    const indice = Math.floor(Math.random() * palabras.length)

    //devuelvo palabra en ese indice
    return palabras[indice]
  }
  
}

