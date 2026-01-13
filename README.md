# TP #1 — Sala de Juegos (Programación IV)

Aplicación web tipo **“Sala de Juegos”** desarrollada como trabajo práctico de **Programación IV**.  
El objetivo es que los usuarios puedan **registrarse / iniciar sesión**, jugar distintos minijuegos y ver **estadísticas y rankings** para medir desempeño (tiempo, aciertos, puntaje, etc.). :contentReference[oaicite:0]{index=0}

## 🚀 Demo (Deploy)
- Vercel: https://joaquin-carbonaro-tp-1-prog-4-2025.vercel.app :contentReference[oaicite:1]{index=1}

---

## 🎮 Funcionalidades principales

### 🔐 Autenticación (con persistencia de sesión)
- **Registro e inicio de sesión** con email y contraseña (Supabase Auth).
- En registro, además se guardan **datos extra** (nombre, apellido, edad) en tabla propia de usuarios.
- La sesión se conserva con **sessionStorage**: si recargás en la misma pestaña sigue logueado, pero si cerrás la pestaña/navegador se pierde la sesión (decisión intencional). 

### 🕹️ Juegos incluidos
- **Ahorcado**: ingreso por botones (sin teclado), guarda métricas como tiempo, letras seleccionadas, etc. :contentReference[oaicite:3]{index=3}  
- **Mayor o Menor**: adivinar si la próxima carta será mayor o menor, registra aciertos y desempeño. :contentReference[oaicite:4]{index=4}  
- **Preguntados**: preguntas consumidas desde una **API externa**, respuestas por botones y guardado de resultados. :contentReference[oaicite:5]{index=5}  
- **Juego propio: Connect 4** (Conecta 4)
  - Implementado como módulo con separación clara de responsabilidades (UI, motor, bot, sesión y helpers).
  - Incluye reglas de sesión: **3 rondas**, **puntaje**, **vidas**, **bonos por “tres en línea”**, penalizaciones y **tiempo global** (3 minutos).   

### 💬 Chat global en tiempo real
- Una única sala para usuarios logueados.
- Mensajes guardados en base de datos y actualizados en todos los clientes **sin recargar** (suscripción realtime). :contentReference[oaicite:7]{index=7}

### 🏆 Resultados y rankings
- Página de **Resultados** con **4 tablas** (una por juego), ordenadas de mejor a peor desempeño. 

### 🙋‍♂️ Página “Quién soy”
- Presentación del alumno y explicación del juego propio.
- Consumo de la API de GitHub para mostrar datos del perfil. :contentReference[oaicite:9]{index=9}

---

## 🧰 Tecnologías usadas
- **Angular + TypeScript** (frontend)   
- **Supabase** (Auth + Base de datos + Realtime)   
- **Bootstrap / ng-bootstrap** para estilos y componentes visuales   
- **SweetAlert2** para modales (no se usa `alert()`)   
- Librería de Connect 4: `@devshareacademy/connect-four` (adaptada con un engine propio)   

---

## 🗃️ Persistencia (modelo de datos)
El proyecto guarda información en Supabase para:
- `usuarios` (perfil adicional al Auth)
- `chat` (mensajes con usuario y fecha)
- `ahorcado_partidas`, `mayor_menor_partidas`, `preguntados_partidas`, `connect4_partidas` (resultados por juego) :contentReference[oaicite:15]{index=15}  

---

## 🧩 Arquitectura destacada: Connect 4
El “juego propio” se implementó con una estructura modular para mantener el código claro:

- `connect4.ts / connect4.html`: UI y orquestación (turnos, animaciones, estados)
- `core/engine.ts`: adaptador de la librería externa a un tablero 2D
- `core/bot.ts`: IA simple (ganar/bloquear/centro/primera válida)
- `core/session.ts`: reglas del TP (vidas, puntaje, timer global) + guardado en DB
- `core/logic/connect4-helpers.ts`: funciones puras del tablero (validaciones, detección de líneas, previews)   

---

## ✅ Contexto del TP
El trabajo se organizó por sprints e incluye: autenticación, juegos con condiciones claras de victoria/derrota, chat en tiempo real, experiencia de usuario cuidada y listados de resultados. 

---

## 💡 Lo que demuestra este proyecto

- **Autenticación real con manejo de sesión**: registro/login, control de acceso a pantallas y persistencia de sesión con criterio (sessionStorage).  
- **Persistencia y modelado de datos**: guardado de usuarios, resultados por juego y chat en Supabase con tablas separadas por dominio.  
- **Tiempo real (Realtime)**: implementación de un **chat global** con actualización automática sin recargar.  
- **Consumo de APIs externas**: integración de una API para el juego de Preguntados y lectura de datos desde GitHub para la sección “Quién soy”.  
- **Arquitectura modular en frontend**: separación por responsabilidades (componentes + servicios + lógica aislada), especialmente visible en el juego propio (Connect 4).  
- **UI/UX cuidada**: uso de librerías de UI (Bootstrap/ng-bootstrap) y modales (SweetAlert2) para una experiencia más clara y consistente.

---

## 👤 Autor
- Joaquín Carbonaro
