/**
 * Tipos do domínio de prontuário eletrônico **modular**.
 *
 * Espelham `apps.prontuario`: itens configuráveis por profissional (fixos,
 * texto livre ou formulário), entradas preenchidas, textos padrão, grupos de
 * exames, atestados (modelo + gerado) e protocolos prontos.
 */
import type { Papel } from "@/types/auth"

/** Papéis com acesso ao prontuário clínico (recepção/financeiro ficam de fora). */
export const PAPEIS_PRONTUARIO: Papel[] = ["DIRECAO", "SUPERVISAO", "PROFISSIONAL"]

/** Papéis que podem configurar o prontuário (somente Direção). */
export const PAPEIS_CONFIG_PRONTUARIO: Papel[] = ["DIRECAO"]

/** Tipos de item (enum `TipoItem` do backend). */
export const TIPOS_ITEM = {
  FIXO: "Item fixo",
  TEXTO_LIVRE: "Texto livre",
  FORMULARIO: "Formulário personalizado",
} as const

export type TipoItem = keyof typeof TIPOS_ITEM

/** Tipos de campo do construtor de formulários (enum `TipoCampo` do backend). */
export const TIPOS_CAMPO = {
  TEXTO_CURTO: "Texto curto",
  TEXTO_LONGO: "Texto longo",
  DATA: "Data",
  NUMERO: "Número",
  SELECAO_UNICA: "Seleção única",
  MULTIPLA_ESCOLHA: "Múltipla escolha",
  SECAO: "Título / seção",
} as const

export type TipoCampo = keyof typeof TIPOS_CAMPO

/** Tipos de campo que exigem lista de opções. */
export const TIPOS_CAMPO_COM_OPCOES: TipoCampo[] = ["SELECAO_UNICA", "MULTIPLA_ESCOLHA"]

/** Macros disponíveis no editor de atestados (rótulo + token). */
export const MACROS_ATESTADO: { token: string; rotulo: string }[] = [
  { token: "[NOME_PACIENTE]", rotulo: "Nome do paciente" },
  { token: "[RG_PACIENTE]", rotulo: "RG do paciente" },
  { token: "[CPF_PACIENTE]", rotulo: "CPF do paciente" },
  { token: "[NOME_UNIDADE]", rotulo: "Nome da unidade" },
  { token: "[NOME_SERVICO]", rotulo: "Nome do serviço" },
  { token: "[NOME_PAI]", rotulo: "Nome do pai" },
  { token: "[NOME_MAE]", rotulo: "Nome da mãe" },
  { token: "[IDADE_PAC]", rotulo: "Idade do paciente" },
  { token: "[DATA_ATUAL]", rotulo: "Data do atendimento" },
  { token: "[HORA_ATUAL]", rotulo: "Hora do atendimento" },
  { token: "[LISTA_CID]", rotulo: "Lista de CID (código + descrição)" },
  { token: "[LISTA_CODIGO_CID]", rotulo: "Lista de códigos de CID" },
]

/** Campo de um formulário personalizado. */
export interface CampoFormulario {
  id: string
  tipo: TipoCampo
  rotulo: string
  ordem: number
  obrigatorio?: boolean
  opcoes?: string[]
}

/** Categoria (agrupador) de itens. */
export interface CategoriaItem {
  id: number
  profissional: number
  nome: string
  ordem: number
  ativo: boolean
  criado_em: string
}

/** Item configurável do prontuário. */
export interface ItemProntuario {
  id: number
  profissional: number
  categoria: number | null
  categoria_nome: string | null
  nome: string
  tipo_item: TipoItem
  tipo_item_display: string
  chave_fixa: string
  visivel: boolean
  ordem: number
  ativo: boolean
  formulario_schema: CampoFormulario[]
  criado_em: string
  atualizado_em: string
}

/** Payload de criação/edição de item. */
export interface ItemProntuarioPayload {
  profissional: number
  categoria?: number | null
  nome: string
  tipo_item: TipoItem
  visivel?: boolean
  ordem?: number
  ativo?: boolean
  formulario_schema?: CampoFormulario[]
}

/** Anexo de uma entrada. */
export interface AnexoEntrada {
  id: number
  entrada: number
  arquivo_url: string | null
  nome_original: string
  descricao: string
  enviado_por: number | null
  enviado_por_nome: string | null
  criado_em: string
}

/** Entrada preenchida do prontuário. */
export interface EntradaProntuario {
  id: number
  paciente: number
  item: number
  item_nome: string
  item_tipo: TipoItem
  profissional: number | null
  autor: number | null
  autor_nome: string | null
  autor_conselho: string
  autor_papel: string | null
  autor_foto: string | null
  agendamento: number | null
  titulo: string
  conteudo: string
  respostas: Record<string, unknown>
  schema_snapshot: CampoFormulario[]
  data_evento: string
  referente_a: number | null
  anexos: AnexoEntrada[]
  pode_editar: boolean
  criado_em: string
  atualizado_em: string
}

/** Tipo de anotação colaborativa sobre uma entrada (enum `TipoComentario`). */
export const TIPOS_COMENTARIO = {
  OBSERVACAO: "Observação",
  COMENTARIO: "Comentário",
} as const

export type TipoComentario = keyof typeof TIPOS_COMENTARIO

/**
 * Anotação colaborativa sobre uma entrada da linha do tempo.
 *
 * Qualquer profissional com acesso ao prontuário pode criar; editar/excluir é
 * restrito ao autor. `OBSERVACAO` é exibida acima do registro; `COMENTARIO`
 * compõe a thread no rodapé.
 */
export interface ComentarioEntrada {
  id: number
  entrada: number
  tipo: TipoComentario
  texto: string
  autor: number | null
  autor_nome: string | null
  autor_papel: string | null
  autor_foto: string | null
  pode_editar: boolean
  criado_em: string
  atualizado_em: string
}

export interface ComentarioEntradaPayload {
  entrada: number
  tipo: TipoComentario
  texto: string
}

/** Payload de criação/edição de entrada. */
export interface EntradaPayload {
  paciente: number
  item: number
  titulo?: string
  conteudo?: string
  respostas?: Record<string, unknown>
  agendamento?: number | null
  data_evento?: string
}

/** Texto padrão reutilizável. */
export interface TextoPadrao {
  id: number
  profissional: number
  titulo: string
  conteudo: string
  item: number | null
  compartilhado: boolean
  ordem: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface TextoPadraoPayload {
  profissional: number
  titulo: string
  conteudo: string
  item?: number | null
  compartilhado?: boolean
}

/** Exame dentro de um grupo. */
export interface ExameGrupo {
  nome: string
  observacao?: string
}

/** Grupo de exames. */
export interface GrupoExames {
  id: number
  profissional: number
  nome: string
  exames: ExameGrupo[]
  ordem: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface GrupoExamesPayload {
  profissional: number
  nome: string
  exames: ExameGrupo[]
}

/** Modelo de atestado (com macros). */
export interface ModeloAtestado {
  id: number
  profissional: number
  nome: string
  titulo: string
  corpo: string
  ordem: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface ModeloAtestadoPayload {
  profissional: number
  nome: string
  titulo?: string
  corpo: string
}

/** CID de um atestado. */
export interface CID {
  codigo?: string
  descricao?: string
}

/** Atestado gerado (macros resolvidas). */
export interface Atestado {
  id: number
  paciente: number
  paciente_nome: string | null
  modelo: number | null
  profissional: number | null
  profissional_nome: string | null
  profissional_conselho: string
  autor: number | null
  agendamento: number | null
  titulo: string
  corpo_resolvido: string
  cids: CID[]
  emitido_em: string
  criado_em: string
}

/** Protocolo pronto (biblioteca). */
export interface Protocolo {
  id: number
  nome: string
  descricao: string
  especialidade: number | null
  especialidade_nome: string | null
  tipo_item: TipoItem
  tipo_item_display: string
  formulario_schema: CampoFormulario[]
  ativo: boolean
}
