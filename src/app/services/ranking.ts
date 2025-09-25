import { inject, Injectable } from "@angular/core"
import { Supabase } from "./supabase"

//tipos crudos que vienen de supabase
export type ResultadoSupabase = {
  id: string | null
  user_id: string | null
  usuario: string | null
  aciertos_totales: number | null
  vidas_restantes: number | null
  tiempo_total: number | null
  created_at: string | null
}

//modelo base interno normalizado
export type ResultadoBase = {
  id: string
  userId: string
  usuario: string
  aciertosTotales: number
  vidasRestantes: number
  tiempoTotal: number
  createdAt: string
}

//modelo con posicion para ranking
export type ResultadoConPosicion = ResultadoBase & { posicion: number }

@Injectable({ providedIn: "root" })
export class ResultadosService {

  //inyecto supabase para consultas
  private readonly supabase = inject(Supabase)

  //====================================================================

  //trae resultados de todos los juegos y arma ranking general
  async traerResultados() {
    //pido en paralelo las cuatro tablas
    const respuestas = await Promise.all([
      this.obtenerResultadosJuego("ahorcado_partidas"),
      this.obtenerResultadosJuego("mayor_menor_partidas"),
      this.obtenerResultadosJuego("preguntados_partidas"),
      this.obtenerResultadosJuego("connect4_partidas"),
    ])

    //desestructuro por juego
    const [ahorcado, mayorMenor, preguntados, connect4] = respuestas

    //combino para armar ranking general
    const rankingGeneral = this.crearRankingGeneral([
      ahorcado,
      mayorMenor,
      preguntados,
      connect4,
    ])

    //devuelvo cada lista y el ranking general
    return { ahorcado, mayorMenor, preguntados, connect4, rankingGeneral }
  }

  //====================================================================

  //lee una tabla de supabase y devuelve top 10 ordenado con posicion
  private async obtenerResultadosJuego(nombreTabla: string): Promise<ResultadoConPosicion[]> {
    //select de columnas con orden por criterios
    const respuesta = await this.supabase.client
      .from(nombreTabla)
      .select(
        "id, user_id, usuario, aciertos_totales, vidas_restantes, tiempo_total, created_at"
      )
      .order("aciertos_totales", { ascending: false }) //mas aciertos primero
      .order("tiempo_total", { ascending: true })      //menos tiempo primero
      .order("vidas_restantes", { ascending: false })  //mas vidas primero
      .limit(10)                                       //solo top 10

    //si hay error corto aca
    if (respuesta.error) {
      throw respuesta.error
    }

    //normalizo filas nulas a valores por defecto
    const filas = (respuesta.data ?? []) as ResultadoSupabase[]

    const resultados = filas.map((fila) => {
      //priorizo user_id, si no hay uso id, si no genero uno combinando
      const userId = fila.user_id ?? fila.id ?? ""
      const id = fila.id ?? `${userId || "sin-id"}-${fila.created_at ?? "sin-fecha"}`
      const usuario = fila.usuario ?? "Sin nombre"
      const aciertos = fila.aciertos_totales ?? 0
      const vidas = fila.vidas_restantes ?? 0
      const tiempo = fila.tiempo_total ?? 0
      const fecha = fila.created_at ?? ""

      //retorno en forma interna consistente
      return {
        id,
        userId,
        usuario,
        aciertosTotales: aciertos,
        vidasRestantes: vidas,
        tiempoTotal: tiempo,
        createdAt: fecha,
      }
    })

    //devuelvo ya ordenado y con posicion asignada
    return this.ordenarYAsignar(resultados)
  }

  //====================================================================

  //ordena por aciertos desc luego tiempo asc luego vidas desc y asigna posicion
  private ordenarYAsignar(resultados: ResultadoBase[]): ResultadoConPosicion[] {
    //copio para no mutar el array original
    const ordenados = [...resultados].sort((a, b) => {
      //1 criterio aciertos
      if (b.aciertosTotales !== a.aciertosTotales) {
        return b.aciertosTotales - a.aciertosTotales
      }
      //2 criterio tiempo
      if (a.tiempoTotal !== b.tiempoTotal) {
        return a.tiempoTotal - b.tiempoTotal
      }
      //3 criterio vidas
      if (b.vidasRestantes !== a.vidasRestantes) {
        return b.vidasRestantes - a.vidasRestantes
      }
      //empate total
      return 0
    })

    //asigno posicion 1..n segun orden
    return ordenados.map((item, indice) => ({
      ...item,
      posicion: indice + 1,
    }))
  }

  //====================================================================

  //combina listas por juego y calcula ranking general solo de quienes jugaron todos
  private crearRankingGeneral(listas: ResultadoConPosicion[][]): ResultadoConPosicion[] {
    //quito posicion y me quedo con datos base por juego
    const bases = listas.map((lista) =>
      lista.map((item) => ({
        id: item.id,
        userId: item.userId,
        usuario: item.usuario,
        aciertosTotales: item.aciertosTotales,
        vidasRestantes: item.vidasRestantes,
        tiempoTotal: item.tiempoTotal,
        createdAt: item.createdAt,
      }))
    )

    //obtengo ids que aparecen en todos los juegos
    const ids = this.obtenerJugadoresComunes(bases)

    //acumulo metricas por usuario comun a todos
    const acumulados = ids.map((id) => {
      //junto un registro por juego si existe
      const registros = bases
        .map((lista) => lista.find((item) => item.userId === id) ?? null)
        .filter((registro): registro is ResultadoBase => registro !== null)

      //tomo nombre del primero y acumulo aciertos tiempo y vidas
      const usuario = registros[0]?.usuario ?? "Sin nombre"
      const aciertos = registros.reduce((total, registro) => total + registro.aciertosTotales, 0)
      const tiempo = registros.reduce((total, registro) => total + registro.tiempoTotal, 0)
      const vidas = registros.reduce((total, registro) => total + registro.vidasRestantes, 0)

      //fecha mas reciente entre las partidas
      const fecha = registros.reduce((ultima, registro) =>
        registro.createdAt > ultima ? registro.createdAt : ultima,
        registros[0]?.createdAt ?? ""
      )

      //devuelvo un item base acumulado
      return {
        id,
        userId: id,
        usuario,
        aciertosTotales: aciertos,
        vidasRestantes: vidas,
        tiempoTotal: tiempo,
        createdAt: fecha,
      }
    })

    //ordeno acumulados y asigno posicion
    return this.ordenarYAsignar(acumulados)
  }

  //====================================================================

  //devuelve ids de usuarios presentes en todas las listas
  private obtenerJugadoresComunes(listas: ResultadoBase[][]): string[] {
    //si no hay listas devuelvo vacio
    if (listas.length === 0) {
      return []
    }

    //conjunto de ids por lista
    const conjuntos = listas.map((lista) => new Set(lista.map((item) => item.userId)))
    //tomo la primera lista como referencia
    const referencia = Array.from(conjuntos[0])

    //filtro ids que esten en todos y que no esten vacios
    return referencia.filter((id) => id !== "" && conjuntos.every((conjunto) => conjunto.has(id)))
  }
  
}
