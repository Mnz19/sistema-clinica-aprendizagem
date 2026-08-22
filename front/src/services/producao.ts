/**
 * Serviço de produção: consulta do ledger financeiro (`/api/producoes/`).
 *
 * Endpoint somente leitura — os lançamentos são criados via signal no backend.
 */
import { api } from "@/services/api"
import type { Producao, ProducaoFiltros } from "@/types/producao"

interface ProducaoApi {
  id: number
  agendamento: number
  paciente: number
  paciente_nome: string
  profissional: number
  profissional_nome: string
  data: string
  servico_nome: string
  valor: string | number
  motivo: string
  criado_em: string
  atualizado_em: string
}

function mapProducao(item: ProducaoApi): Producao {
  return {
    id: item.id,
    agendamento: item.agendamento,
    paciente: item.paciente,
    paciente_nome: item.paciente_nome,
    profissional: item.profissional,
    profissional_nome: item.profissional_nome,
    data: item.data,
    servico_nome: item.servico_nome,
    valor: typeof item.valor === "string" ? Number(item.valor) : item.valor,
    motivo: item.motivo,
    criado_em: item.criado_em,
    atualizado_em: item.atualizado_em,
  }
}

/** Lista produções com filtros de período e profissional. */
export async function getProducoes(filtros: ProducaoFiltros = {}): Promise<Producao[]> {
  const { data } = await api.get<ProducaoApi[]>("/producoes/", {
    params: {
      data__gte: filtros.data__gte,
      data__lte: filtros.data__lte,
      profissional: filtros.profissional,
      paciente: filtros.paciente,
    },
  })
  return data.map(mapProducao)
}
