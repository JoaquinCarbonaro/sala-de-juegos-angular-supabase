import { Component, OnDestroy, OnInit, inject, signal, ElementRef, ViewChild, AfterViewInit,} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import Swal from 'sweetalert2';
import { Realtime } from '../../services/realtime';
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
  private readonly realtime = inject(Realtime);
  private readonly auth = inject(Auth);

  //refs de vista
  @ViewChild('messagesScroll') private messagesRef?: ElementRef<HTMLDivElement>; //ref del contenedor de mensajes

  //estado
  mensajes = signal<Mensaje[]>([]); //lista de mensajes
  mensaje = signal(''); //texto del input
  canalListo = signal(false); //estado de la suscripcion realtime

  //usuario actual como signal reactiva
  usuarioActual = toSignal(this.auth.currentUser$, { initialValue: null });

  //====================================================================

  ngOnInit(): void {
    //inicio flujo de carga y suscripcion
    void this.inicializarChat();
  }

  //====================================================================

  ngAfterViewInit(): void {
    //aseguro bajar al final al renderizar la vista
    this.scrollToBottom();
  }

  //====================================================================

  ngOnDestroy(): void {
    //limpio suscripcion
    this.canalListo.set(false);
    void this.realtime.desuscribirse();
  }

  //====================================================================

  async enviar() {
    //valido texto
    const texto = this.mensaje().trim();
    if (!texto) return;

    //verifico que el canal realtime este activo
    if (!this.canalListo()) {
      await Swal.fire({
        icon: 'info',
        title: 'Conectando con el chat',
        text: 'Esperá un instante y volvé a intentar enviar tu mensaje.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

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
      //envio mensaje al servicio realtime
      await this.realtime.enviarMensaje(texto, alias, user.id);
    } catch {
      return; //el servicio ya informo el error
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

  private async inicializarChat() {
    //reinicio estado de disponibilidad
    this.canalListo.set(false);

    try {
      //espero carga inicial y confirmacion de suscripcion simultaneamente
      await Promise.all([
        this.cargarMensajesIniciales(),
        this.realtime.suscribirse((nuevo) => {
          this.integrarMensajes(nuevo); //agrego nuevo evitando duplicados
        }),
      ]);

      this.canalListo.set(true);
    } catch {
      //error al suscribirse
      await Swal.fire({
        icon: 'error',
        title: 'Sin conexión en tiempo real',
        text: 'No pudimos conectar con el chat. Recargá la página o intentá en unos segundos.',
        confirmButtonText: 'Entendido',
      });
    }
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
