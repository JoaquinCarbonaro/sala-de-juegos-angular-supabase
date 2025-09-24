import { inject, Injectable } from '@angular/core' 
import type { RealtimeChannel } from '@supabase/supabase-js'
import Swal from 'sweetalert2'
import { Supabase } from './supabase'
import { Mensaje } from '../interface/mensaje'

@Injectable({ providedIn: 'root' })
export class Realtime {

  private readonly supabase = inject(Supabase).client
  private canal: RealtimeChannel | null = null //canal actual o null

  //====================================================================

  async obtenerMensajes(): Promise<Mensaje[]> {

    //traigo mensajes ordenados por fecha asc
    const { data, error } = await this.supabase
      .from('chat')
      .select('*')
      .order('created_at', { ascending: true })

    //control de error
    if (error || !data) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo cargar el chat',
        text: 'Intentá recargar la página en unos segundos.',
        confirmButtonText: 'Entendido',
      })
      return []
    }
    return data as Mensaje[]
  }

  //====================================================================

  //suscripcion a nuevos mensajes
  async suscribirse(onMensaje: (mensaje: Mensaje) => void): Promise<void> {

    //si habia un canal previo lo cierro y lo saco del cliente
    if (this.canal) {
      await this.supabase.removeChannel(this.canal) //cierra y limpia
      this.canal = null
    }

    //creo un nombre unico para evitar colisiones
    const channelName = `public:chat:${Date.now()}`

    //creo canal nuevo cada vez que entro al chat
    this.canal = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat' },
        payload => onMensaje(payload.new as Mensaje) //cada nuevo mensaje recibido
      )

    //activo la suscripcion y espero a que se confirme para asegurar eventos
    await new Promise<void>((resolve, reject) => {
      if (!this.canal) {
        reject(new Error('No se pudo crear el canal de realtime'))
        return
      }

      let settled = false

      this.canal.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          settled = true
          resolve()
          return
        }

        if (!settled && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          settled = true
          void this.supabase.removeChannel(this.canal as RealtimeChannel)
          this.canal = null
          reject(new Error(`No se pudo suscribir al chat: ${status}`))
        }
      })
    })
  }

  //====================================================================
  
  async desuscribirse() {
    //si no hay canal no hago nada
    if (!this.canal) return

    //elimino el canal del cliente para que no quede zombi
    await this.supabase.removeChannel(this.canal)
    this.canal = null
  }

  //====================================================================

  async enviarMensaje(texto: string, usuario: string, userId: string) {

    //inserto mensaje con uuid del usuario autenticado
    const { error } = await this.supabase.from('chat').insert({
      mensaje: texto,
      usuario,
      user_id: userId,
    })

    //control de error al enviar
    if (error) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo enviar el mensaje',
        text: 'Verificá tu conexión e intentá nuevamente.',
        confirmButtonText: 'Entendido',
      })
      throw error
    }
  }

}
