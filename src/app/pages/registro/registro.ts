
import { Component } from '@angular/core'
import { Router } from '@angular/router'
import Swal from 'sweetalert2'
import { Auth } from '../../services/auth'
import { FormsModule, NgForm } from '@angular/forms'
import { RouterModule } from '@angular/router'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { NgClass } from '@angular/common' 

//componente de registro de usuario
@Component({
  selector: 'app-registro',
  imports: [RouterModule, FormsModule, NgbModule, NgClass], //ngClass: maneja clases dinamicas (operacion ternaria para el tipo de clase a usar)
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  //objeto donde guardo los datos del form
  usuario = {
    nombre: "",
    apellido: "",
    edad: "",
    email: "",
    password: "",
    confirmPassword: "",
  }

  //====================================================================

  //muestra o esconde la contraseña
  showPassword = false
  //muestra o esconde la confirmacion de contraseña
  showConfirmPassword = false

  //cambia la visibilidad de los inputs de contraseña
  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    //si el campo es password cambia showPassword
    if (field === 'password') {
      this.showPassword = !this.showPassword
    } else {
      //si el campo es confirm cambia showConfirmPassword
      this.showConfirmPassword = !this.showConfirmPassword
    }
  }

  //====================================================================

  //se ejecuta cuando envio el form
  async onSubmit(form: NgForm) {
    //si el form esta incompleto no hago nada
    if (form.invalid) {
      return
    }

    //si las contraseñas no coinciden muestro modal y corto
    if (this.usuario.password !== this.usuario.confirmPassword) {
      Swal.fire({ title: 'algo salio mal', icon: 'error', text: 'las contraseñas no coinciden' })
      return
    }

    //intento registrar el usuario en supabase
    const res = await this.auth.register({
      email: this.usuario.email,
      password: this.usuario.password,
      nombre: this.usuario.nombre,
      apellido: this.usuario.apellido,
      edad: Number(this.usuario.edad),
    })

    //si no hubo error, registro ok
    if (!res.error) {
      //muestro un toast de exito
      Swal.fire({ icon: 'success', title: 'usuario creado', toast: true, timer: 2000, showConfirmButton: false })
      //redirijo a la pagina de bienvenida
      this.router.navigate(['/bienvenida'])
    }
  }

  //====================================================================

  //chequea si las dos contraseñas son iguales
  passwordsMatch(): boolean {
    //devuelve true, si coinciden
    return this.usuario.password === this.usuario.confirmPassword
  }

  //inyecto servicios de auth y router
  constructor(private readonly auth: Auth, private readonly router: Router) {}
}
