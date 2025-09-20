import { Component, OnDestroy, OnInit, inject, signal, ElementRef, ViewChild, AfterViewInit,} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import Swal from 'sweetalert2';
import { RealtimeService } from '../../services/realtime';
import { Auth } from '../../services/auth';
import { Mensaje } from '../../interface/mensaje';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit, OnDestroy, AfterViewInit {
  //servicios
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(Auth);

  //refs de vista
  @ViewChild('messagesScroll') private messagesRef?: ElementRef<HTMLDivElement>; //ref del contenedor de mensajes

  //estado
  mensajes = signal<Mensaje[]>([]); //lista de mensajes
  mensaje = signal(''); //texto del input

  //usuario actual como signal reactiva
  usuarioActual = toSignal(this.auth.currentUser$, { initialValue: null });

  //====================================================================

  ngOnInit(): void {
    //carga inicial de mensajes
    void this.cargarMensajesIniciales();

    //suscripcion realtime
    this.realtime.suscribirse((nuevo) => {
      this.integrarMensajes(nuevo); //agrego nuevo evitando duplicados
    });
  }

  //====================================================================

  ngAfterViewInit(): void {
    //aseguro bajar al final al renderizar la vista
    this.scrollToBottom();
  }

  //====================================================================

  ngOnDestroy(): void {
    //limpio suscripcion
    void this.realtime.desuscribirse();
  }

  //====================================================================

  async enviar() {
    //valido texto
    const texto = this.mensaje().trim();
    if (!texto) return;

    //valido usuario logueado
    const user = this.usuarioActual();

    if (!user) {
      await Swal.fire({
        icon: 'warning',
        title: 'Necesitás iniciar sesión',
        text: 'Ingresá con tu cuenta para participar del chat.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    if (!user.id) {
      await Swal.fire({
        icon: 'warning',
        title: 'Sesión no disponible',
        text: 'No pudimos validar tu usuario. Volvé a iniciar sesión e intentá nuevamente.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    //uso nombre si existe, caso contrario email
    const alias = user.nombre || user.email || 'Usuario';

    try {
      await this.realtime.enviarMensaje(texto, alias, user.id);
    } catch {
      return; //el servicio ya informó el error
    }

    //reseteo input y bajo al final
    this.mensaje.set('');
    this.scrollToBottom();
  }

  //=========================================

  //verifica si el mensaje pertenece al usuario actual
  esPropio(msj: { usuario: string }) {
    //traigo usuario actual de la sesion
    const u = this.usuarioActual?.()
    //defino mi identificador como nombre o email
    const yo = u?.nombre || u?.email || ''
    //comparo si el usuario del mensaje es igual al mio
    return msj.usuario === yo
  }

  //=========================================

  private scrollToBottom() {
    //bajo al final del scroll con raf para esperar el render
    const el = this.messagesRef?.nativeElement;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  //=========================================

  private async cargarMensajesIniciales() {
    //traigo lista de mensajes ya guardados
    const data = await this.realtime.obtenerMensajes();
    this.integrarMensajes(data);
  }

  //=========================================

  private integrarMensajes(entrantes: Mensaje | Mensaje[]) {
    //normalizo a array
    const lista = Array.isArray(entrantes) ? entrantes : [entrantes]
    if (!lista.length) return

    let seActualizo = false

    //actualizo lista de mensajes
    this.mensajes.update((actuales) => {
      const mapa = new Map(actuales.map((msj) => [msj.id, msj]))

      for (const msj of lista) {
        const previo = mapa.get(msj.id)

        //si el mensaje no existe o cambio algun campo lo actualizo
        if (
          !previo ||
          previo.mensaje !== msj.mensaje ||
          previo.usuario !== msj.usuario ||
          previo.created_at !== msj.created_at ||
          previo.user_id !== msj.user_id
        ) {
          mapa.set(msj.id, msj)
          seActualizo = true
        }
      }

      if (!seActualizo) {
        return actuales
      }

      //ordeno por fecha ascendente
      return Array.from(mapa.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })

    //si se actualizo bajo scroll
    if (seActualizo) {
      this.scrollToBottom()
    }
  }
  
}
