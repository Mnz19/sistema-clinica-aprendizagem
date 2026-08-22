/**
 * Serviço de fila de espera (Gestão de Agenda › Fila de Espera).
 *
 * Endpoints (`/api/fila-espera/`, restrito a RECEPCAO e DIREÇÃO):
 *   GET/POST/PATCH/DELETE, além das actions:
 *   - `POST {id}/converter/` — cria o agendamento e marca a entrada como CONVERTIDO.
 *   - `POST {id}/recusar/`   — marca a entrada como RECUSADO.
 *   - `GET candidatos/`      — candidatos AGUARDANDO compatíveis com um horário vago.
 */
import { AxiosError } from "axios"

import { api } from "@/services/api"
import {
  AgendamentoValidacaoError,
  parseErroValidacaoAgendamento,
} from "@/services/agendamento"
import type { Agendamento, AgendamentoPayload } from "@/types/agendamento"
import type { FilaEsperaItem, FilaEsperaPayload, StatusFila } from "@/types/filaEspera"

interface ListarParams {
  status?: StatusFila
  profissional?: number
  especialidade?: number
}

export async function listarFila(params: ListarParams = {}): Promise<FilaEsperaItem[]> {
  const { data } = await api.get<FilaEsperaItem[]>("/fila-espera/", {
    params: {
      status: params.status,
      profissional: params.profissional,
      especialidade: params.especialidade,
    },
  })
  return data
}

/** Candidatos AGUARDANDO para preencher um horário vago (FIFO). */
export async function listarCandidatos(params: {
  profissional?: number
  especialidade?: number
}): Promise<FilaEsperaItem[]> {
  const { data } = await api.get<FilaEsperaItem[]>("/fila-espera/candidatos/", {
    params: { profissional: params.profissional, especialidade: params.especialidade },
  })
  return data
}

export async function criarFila(payload: FilaEsperaPayload): Promise<FilaEsperaItem> {
  const { data } = await api.post<FilaEsperaItem>("/fila-espera/", normalizar(payload))
  return data
}

export async function atualizarFila(
  id: number,
  payload: FilaEsperaPayload
): Promise<FilaEsperaItem> {
  const { data } = await api.patch<FilaEsperaItem>(`/fila-espera/${id}/`, normalizar(payload))
  return data
}

export async function removerFila(id: number): Promise<void> {
  await api.delete(`/fila-espera/${id}/`)
}

/** Marca a entrada como RECUSADO mantendo o histórico. */
export async function recusarFila(id: number): Promise<FilaEsperaItem> {
  const { data } = await api.post<FilaEsperaItem>(`/fila-espera/${id}/recusar/`)
  return data
}

/**
 * Converte a entrada em agendamento (atômico no backend). Reaproveita o parser de
 * validação de agendamento para conflitos de horário/regra caírem na mesma UI.
 */
export async function converterFila(
  id: number,
  payload: AgendamentoPayload
): Promise<Agendamento> {
  try {
    const { data } = await api.post<Agendamento>(`/fila-espera/${id}/converter/`, {
      paciente: payload.paciente,
      profissional: payload.profissional,
      sala: payload.sala,
      servico: payload.servico,
      data: payload.data,
      horario_inicio:
        payload.horario_inicio.length === 5
          ? `${payload.horario_inicio}:00`
          : payload.horario_inicio,
      observacoes: payload.observacoes ?? "",
    })
    return data
  } catch (erro) {
    if (erro instanceof AxiosError && erro.response?.status === 400) {
      throw new AgendamentoValidacaoError(parseErroValidacaoAgendamento(erro))
    }
    throw erro
  }
}

function normalizar(payload: FilaEsperaPayload) {
  return {
    paciente: payload.paciente,
    profissional: payload.profissional ?? null,
    especialidade: payload.especialidade ?? null,
    preferencia_horario: payload.preferencia_horario ?? "",
    observacoes: payload.observacoes ?? "",
  }
}
