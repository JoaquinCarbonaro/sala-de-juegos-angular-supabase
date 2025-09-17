import type { Routes } from "@angular/router";
import { estaLogueadoGuard } from "./guards/esta-logueado-guard";
import { estaLogueadoChildGuard } from "./guards/esta-logueado-child-guard";
import { noEstaLogueadoGuard } from "./guards/no-esta-logueado-guard";

export const routes: Routes = [

  //ruta por defecto
  { path: "", redirectTo: "/bienvenida", pathMatch: "full" },

  //publicas
  {
    path: "bienvenida",
    loadComponent: () => import("./pages/bienvenida/bienvenida").then((m) => m.Bienvenida),
  },
  {
    path: "sobre-mi",
    loadComponent: () => import("./pages/sobre-mi/sobre-mi").then((m) => m.SobreMi),
  },

  //protegidas (requieren NO sesion)
  {
    path: "login",
    loadComponent: () => import("./pages/login/login").then((m) => m.Login),
    canActivate: [noEstaLogueadoGuard], //solo NO logueados
  },
  {
    path: "registro",
    loadComponent: () => import("./pages/registro/registro").then((m) => m.Registro),
    canActivate: [noEstaLogueadoGuard], //solo NO logueados
  },

  //protegidas (requieren sesion)
  {
    path: "chat",
    loadComponent: () => import("./pages/chat/chat").then((m) => m.Chat),
    canActivate: [estaLogueadoGuard], //solo logueados
  },
  {
    path: "resultados",
    loadComponent: () => import("./pages/resultados/resultados").then((m) => m.Resultados),
    canActivate: [estaLogueadoGuard], //solo logueados
  },
  {
    path: "juegos",
    loadComponent: () => import("./pages/juegos/juegos").then((m) => m.Juegos),
    canActivate: [estaLogueadoGuard],           //solo logueados
    canActivateChild: [estaLogueadoChildGuard], //protege TODAS las hijas -> solo logueados
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
];
