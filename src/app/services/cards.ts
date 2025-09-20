import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'

//====================================================================
//tipo de dato para cada carta
export type CardData = {
  code: string
  image: string
  value: string
  suit: string
}
//====================================================================

@Injectable({ providedIn: 'root' })
export class CardsApi {

  private deckId: string | null = null //almacena el id del mazo activo
  private remaining = 0 //cartas restantes en el mazo

  constructor(private readonly http: HttpClient) {}

  //====================================================================

  //crea y baraja un mazo nuevo
  private async createDeck(): Promise<string | null> {
    try {
      //pido mazo nuevo a la api
      const response = await firstValueFrom(
        this.http.get<{ deck_id: string; remaining: number; success: boolean }>(
          'https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1'
        )
      )

      //si falla devuelvo null
      if (!response.success) {
        return null
      }

      //guardo id del mazo y cantidad de cartas
      this.deckId = response.deck_id
      this.remaining = response.remaining
      //devuelvo id del mazo
      return this.deckId

    } catch (error) {
      console.log('no se pudo crear el mazo', error)
      return null
    }
  }

  //====================================================================

  //mezcla el mazo actual si existe
  private async shuffleDeck(): Promise<string | null> {
    //si no hay mazo lo creo
    if (!this.deckId) {
      return this.createDeck()
    }

    try {
      //url para mezclar el mazo existente
      const url = `https://deckofcardsapi.com/api/deck/${this.deckId}/shuffle/?remaining=true`
      const response = await firstValueFrom(
        this.http.get<{ remaining: number; success: boolean }>(url)
      )

      //si falla creo un mazo nuevo
      if (!response.success) {
        return this.createDeck()
      }

      //actualizo cartas restantes
      this.remaining = response.remaining
      return this.deckId

    } catch (error) {
      console.log('no se pudo barajar el mazo', error)
      return this.createDeck()
    }
  }

  //====================================================================

  //garantiza que haya un mazo listo
  private async ensureDeckReady(): Promise<string | null> {

    //si no hay mazo lo creo
    if (!this.deckId) {
      return this.createDeck()
    }

    //si no quedan cartas mezclo el mazo
    if (this.remaining <= 0) {
      return this.shuffleDeck()
    }
    return this.deckId
  }

  //====================================================================

  //obtiene una carta del mazo
  async drawCard(): Promise<CardData | null> {

    //me aseguro que el mazo este listo
    await this.ensureDeckReady()
    if (!this.deckId) {
      return null
    }

    try {
      //url para sacar una carta
      const url = `https://deckofcardsapi.com/api/deck/${this.deckId}/draw/?count=1`
      const response = await firstValueFrom(
        this.http.get<{ cards: CardData[]; remaining: number; success: boolean }>(url)
      )

      //si falla devuelvo null
      if (!response.success) {
        return null
      }

      //actualizo cartas restantes
      this.remaining = response.remaining

      //tomo la primera carta del array
      const card = response.cards && response.cards.length > 0 ? response.cards[0] : null

      //si existe la devuelvo
      if (card) {
        return card
      }

      //si no quedan cartas mezclo y vuelvo a sacar
      if (response.remaining === 0) {
        await this.shuffleDeck()
        return this.drawCard()
      }

      return null

    } catch (error) {
      console.log('no se pudo sacar la carta', error)
      return null
    }
  }

  //====================================================================

  //reinicia el mazo para una nueva partida
  async resetDeck(): Promise<string | null> {
    //reseteo id y cantidad de cartas
    this.deckId = null
    this.remaining = 0

    //creo un mazo nuevo
    return this.createDeck()
  }

  //====================================================================

  //devuelve cartas restantes
  getRemainingCards() {
    return this.remaining
  }

}
