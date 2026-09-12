/**
 * Tipos da aba de Relatórios.
 *
 * Espelham `apps/relatorios` no backend: quatro relatórios, cada um com o seu
 * conjunto de papéis e os seus filtros. A resposta é um envelope genérico
 * (colunas + linhas + totais), então a tabela de prévia é montada a partir das
 * colunas que a API descreve — não há tipagem por relatório.
 *
 * ⚠️ `papeis` de cada relatório espelha `PAPEIS_RELATORIO_*` em
 * `apps/relatorios/permissions.py`. Ao mudar um lado, mude o outro: aqui a
 * regra só decide o que aparece na interface; o backend é quem barra o acesso.
 */
import {
  FORMA_PAGAMENTO_LABELS,
  STATUS_AGENDAMENTO,
  type FormaPagamento,
  type StatusAgendamento,
} from "@/types/agendamento"
import type { Papel } from "@/types/auth"
import { MOTIVOS_PRODUCAO } from "@/types/producao"

/** Papéis que veem os relatórios operacionais (pacientes e agendamentos). */
export const PAPEIS_RELATORIO_OPERACIONAL: Papel[] = [
  "DIRECAO",
  "SUPERVISAO",
  "RECEPCAO",
]

/** Papéis que veem os relatórios financeiros (produção e repasse). */
export const PAPEIS_RELATORIO_FINANCEIRO: Papel[] = ["DIRECAO", "FINANCEIRO"]

/**
 * Papéis que enxergam a aba de Relatórios — a união dos dois conjuntos.
 *
 * Usada pelo guard da rota e pelo menu lateral: basta alcançar **um** relatório
 * para a aba fazer sentido. Quais abas aparecem dentro dela é decidido por
 * `DEFINICOES_RELATORIO`.
 */
export const PAPEIS_RELATORIOS: Papel[] = [
  ...new Set([
    ...PAPEIS_RELATORIO_OPERACIONAL,
    ...PAPEIS_RELATORIO_FINANCEIRO,
  ]),
]

/** Identificador de cada relatório (= segmento da rota da API). */
export const RELATORIOS = {
  PACIENTES: "pacientes",
  AGENDAMENTOS: "agendamentos",
  PRODUCAO: "producao",
  REPASSE: "repasse",
} as const

export type RelatorioId = (typeof RELATORIOS)[keyof typeof RELATORIOS]

/** Filtros que um relatório oferece — governa quais campos a tela renderiza. */
export type CampoFiltro =
  | "periodo"
  | "profissional"
  | "paciente"
  | "sala"
  | "servico"
  | "status"
  | "motivo"
  | "forma_pagamento"
  | "ativo"
  | "cadastro_incompleto"
  | "estado"
  | "cidade"
  | "busca"
  | "agrupar"

/** Metadados de um relatório: rótulo, acesso e filtros disponíveis. */
export interface RelatorioDefinicao {
  id: RelatorioId
  titulo: string
  descricao: string
  papeis: Papel[]
  filtros: CampoFiltro[]
}

/**
 * Catálogo dos relatórios — fonte única para as abas, os filtros e o acesso.
 *
 * A ordem define a ordem das abas: primeiro o operacional (que a recepção vê),
 * depois o financeiro.
 */
export const DEFINICOES_RELATORIO: RelatorioDefinicao[] = [
  {
    id: RELATORIOS.PACIENTES,
    titulo: "Pacientes",
    descricao:
      "Dados cadastrais completos: contato, endereço, escola, filiação, responsável e vínculos.",
    papeis: PAPEIS_RELATORIO_OPERACIONAL,
    filtros: [
      "periodo",
      "busca",
      "profissional",
      "ativo",
      "cadastro_incompleto",
      "estado",
      "cidade",
    ],
  },
  {
    id: RELATORIOS.AGENDAMENTOS,
    titulo: "Agendamentos",
    descricao:
      "Agenda consolidada com o desfecho de cada consulta, incluindo faltas e desmarcações com parecer.",
    papeis: PAPEIS_RELATORIO_OPERACIONAL,
    filtros: [
      "periodo",
      "status",
      "profissional",
      "paciente",
      "sala",
      "servico",
    ],
  },
  {
    id: RELATORIOS.PRODUCAO,
    titulo: "Produção",
    descricao:
      "Faturamento por atendimento (valor da clínica) cruzado com a baixa de pagamento.",
    papeis: PAPEIS_RELATORIO_FINANCEIRO,
    filtros: ["periodo", "motivo", "profissional", "paciente"],
  },
  {
    id: RELATORIOS.REPASSE,
    titulo: "Repasse",
    descricao:
      "Repasse devido a cada profissional, apurado sobre os atendimentos com pagamento registrado.",
    papeis: PAPEIS_RELATORIO_FINANCEIRO,
    filtros: ["periodo", "profissional", "forma_pagamento", "agrupar"],
  },
]

/** Coluna descrita pela API — usada para montar o cabeçalho da prévia. */
export interface ColunaRelatorio {
  chave: string
  titulo: string
  /** Formato numérico do Excel; serve de dica de alinhamento/formatação na tela. */
  formato: string | null
  /** Coluna somada no rodapé de totais. */
  somar: boolean
}

/** Uma linha do relatório: valores indexados pela `chave` das colunas. */
export type LinhaRelatorio = Record<string, string | number | null>

/** Envelope de resposta de `GET /api/relatorios/<id>/`. */
export interface RespostaRelatorio {
  titulo: string
  colunas: ColunaRelatorio[]
  linhas: LinhaRelatorio[]
  totais: Record<string, string | number | null>
  total_registros: number
  filtros_descricao: string
}

/** Valores dos filtros mantidos pela tela (todos opcionais). */
export interface FiltrosRelatorio {
  data_inicio?: string
  data_fim?: string
  profissional?: string
  paciente?: string
  sala?: string
  servico?: string
  status?: string[]
  motivo?: string[]
  forma_pagamento?: string[]
  ativo?: string
  cadastro_incompleto?: string
  estado?: string
  cidade?: string
  busca?: string
  agrupar?: string
}

/**
 * Opções dos filtros de múltipla escolha, derivadas dos enums já existentes.
 *
 * Reaproveitar `STATUS_AGENDAMENTO`, `MOTIVOS_PRODUCAO` e
 * `FORMA_PAGAMENTO_LABELS` evita uma terceira cópia dos mesmos valores — se o
 * backend ganhar um status novo, ele aparece aqui automaticamente.
 */
export interface OpcaoFiltro {
  valor: string
  rotulo: string
}

export const OPCOES_STATUS: OpcaoFiltro[] = (
  Object.keys(STATUS_AGENDAMENTO) as StatusAgendamento[]
).map((valor) => ({ valor, rotulo: STATUS_AGENDAMENTO[valor] }))

export const OPCOES_MOTIVO: OpcaoFiltro[] = Object.values(MOTIVOS_PRODUCAO).map(
  (motivo) => ({ valor: motivo, rotulo: motivo }),
)

export const OPCOES_FORMA_PAGAMENTO: OpcaoFiltro[] = (
  Object.keys(FORMA_PAGAMENTO_LABELS) as FormaPagamento[]
).map((valor) => ({ valor, rotulo: FORMA_PAGAMENTO_LABELS[valor] }))
