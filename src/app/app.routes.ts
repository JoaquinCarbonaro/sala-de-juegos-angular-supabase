import type { Routes } from "@angular/router"

export const routes: Routes = [

  //ruta por defecto
  { path: "", redirectTo: "/bienvenida", pathMatch: "full" },

  //ruta bienvenida
  {
    path: "bienvenida",
    loadComponent: () => import("./pages/bienvenida/bienvenida").then((m) => m.Bienvenida),
  },

  //ruta login
  {
    path: "login",
    loadComponent: () => import("./pages/login/login").then((m) => m.Login),
  },

  //ruta registro
  {
    path: "registro",
    loadComponent: () => import("./pages/registro/registro").then((m) => m.Registro),
  },

  //ruta sobre mi
  {
    path: "sobre-mi",
    loadComponent: () => import("./pages/sobre-mi/sobre-mi").then((m) => m.SobreMi),
  },

  //ruta chat
  {
    path: "chat",
    loadComponent: () => import("./pages/chat/chat").then((m) => m.Chat),
  },

  //ruta resultados
  {
    path: "resultados",
    loadComponent: () => import("./pages/resultados/resultados").then((m) => m.Resultados),
  },

  //ruta juegos con rutas hijas
  {
    path: "juegos",
    loadComponent: () => import("./pages/juegos/juegos").then((m) => m.Juegos),
    children: [
      {
        path: "ahorcado",
        loadComponent: () => import("./pages/juegos/ahorcado/ahorcado").then((m) => m.Ahorcado),
      },
      {
        path: "mayor-menor",
        loadComponent: () => import("./pages/juegos/mayor-menor/mayor-menor").then((m) => m.MayorMenor),
      },
      {
        path: "preguntados",
        loadComponent: () => import("./pages/juegos/preguntados/preguntados").then((m) => m.Preguntados),
      },
      {
        path: "connect4",
        loadComponent: () => import("./pages/juegos/connect4/connect4").then((m) => m.Connect4),
      },
    ],
  },

  //error de ruta
  {
    path: "**",
    loadComponent: () => import("./pages/error/error").then((m) => m.Error),
  },
]
