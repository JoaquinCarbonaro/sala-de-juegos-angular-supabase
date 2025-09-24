
//tipos principales para preguntas de trivia -> categorias principales (4 fijas)
export type TriviaGroupId = 'entertainment' | 'sports' | 'science' | 'history';

//====================================================================

//interface que agrupa ids de la api segun las cuatro categorias -> mapea IDs reales de la API a esas categorias
export interface TriviaCategoryGroup {
  id: TriviaGroupId; //identificador de categoria general
  label: string; //texto para mostrar en ui
  categoryIds: number[]; //ids de categorias reales de la api
}

//====================================================================

//modelo de pregunta devuelta por la api -> estructura de cada pregunta devuelta
export interface TriviaQuestion {
  category: string; //categoria segun api
  type: string; //tipo de pregunta (multiple choice, boolean, etc)
  difficulty: string; //nivel de dificultad
  question: string; //texto de la pregunta
  correct_answer: string; //respuesta correcta
  incorrect_answers: string[]; //lista de respuestas incorrectas
}

//====================================================================

//modelo de opcion lista para mostrar en botones -> opcion procesada para botones.
export interface TriviaOption {
  original: string; //texto original recibido
  display: string; //texto adaptado para mostrar
}

//====================================================================
//interfaces de respuesta de la API:
//====================================================================

//respuesta de la api para listado de categorias disponibles
export interface TriviaCategoryListResponse {
  trivia_categories: { id: number; name: string }[]
}

//====================================================================

//respuesta de la api al solicitar preguntas filtradas
export interface TriviaQuestionListResponse {
  response_code: number
  results: TriviaQuestion[]
  token?: string
}

//====================================================================

//respuesta de la api al solicitar o resetear token de sesion
export interface TriviaSessionTokenResponse {
  response_code: number
  token?: string
}
