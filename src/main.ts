/// <reference types="@angular/localize" />

import { bootstrapApplication } from "@angular/platform-browser"
import Swal from "sweetalert2"
import { appConfig } from "./app/app.config"
import { App } from "./app/app"

//inicio la aplicacion con la configuracion principal
bootstrapApplication(App, appConfig).catch(async () => {
  await Swal.fire({
    icon: "error",
    title: "No se pudo iniciar la app",
    text: "Actualizá la página o volvé a intentarlo en unos minutos.",
    confirmButtonText: "Entendido",
  })
})
