/**
 * Store de agendamentos (Zustand): sincronizada com `/api/agendamentos/`.
 */
import { create } from "zustand"

import * as agendamentoApi from "@/services/agendamento"
import { AgendamentoValidacaoError } from "@/services/agendamento"
import { mensagemDeErro } from "@/utils/apiError"
import type {
  Agendamento,
  AgendamentoPayload,
  ErroValidacaoAgendamento,
  TransferenciaResultado,
} from "@/types/agendamento"
import type { ListarAgendamentosParams } from "@/services/agendamento"

interface AgendamentoState {
  agendamentos: Agendamento[]
  isLoading: boolean
  erro: string | null
  erroValidacao: ErroValidacaoAgendamento | null

  buscarAgendamentos: (params?: ListarAgendamentosParams) => Promise<void>
  criarAgendamento: (dados: AgendamentoPayload) => Promise<Agendamento>
  atualizarAgendamento: (id: number, dados: AgendamentoPayload) => Promise<Agendamento>
  salvarAgendamento: (dados: AgendamentoPayload, id?: number) => Promise<Agendamento>
  removerAgendamento: (id: number) => Promise<void>
  transferirAgendamento: (
    id: number,
    profissional: number,
    confirmar?: boolean
  ) => Promise<TransferenciaResultado>
  limparErroValidacao: () => void
}

function tratarErroSalvar(erro: unknown): never {
  if (erro instanceof AgendamentoValidacaoError) {
    throw erro
  }
  throw erro
}

export const useAgendamentoStore = create<AgendamentoState>()((set, get) => ({
  agendamentos: [],
  isLoading: false,
  erro: null,
  erroValidacao: null,

  limparErroValidacao: () => set({ erroValidacao: null, erro: null }),

  buscarAgendamentos: async (params) => {
    set({ isLoading: true, erro: null })
    try {
      const agendamentos = await agendamentoApi.listarAgendamentos(params)
      set({ agendamentos })
    } catch (erro) {
      console.error("[agendamentoStore] buscarAgendamentos:", erro)
      set({ erro: mensagemDeErro(erro) })
    } finally {
      set({ isLoading: false })
    }
  },

  criarAgendamento: async (dados) => {
    set({ erro: null, erroValidacao: null })
    try {
      const novo = await agendamentoApi.criarAgendamento(dados)
      set((state) => ({
        agendamentos: [...state.agendamentos, novo].sort(ordenarAgendamentos),
      }))
      return novo
    } catch (erro) {
      console.error("[agendamentoStore] criarAgendamento:", erro)
      if (erro instanceof AgendamentoValidacaoError) {
        set({ erro: erro.validacao.mensagem, erroValidacao: erro.validacao })
        tratarErroSalvar(erro)
      }
      const msg = mensagemDeErro(erro)
      set({ erro: msg })
      throw erro
    }
  },

  atualizarAgendamento: async (id, dados) => {
    set({ erro: null, erroValidacao: null })
    try {
      const atualizado = await agendamentoApi.atualizarAgendamento(id, dados)
      set((state) => ({
        agendamentos: state.agendamentos
          .map((a) => (a.id === id ? atualizado : a))
          .sort(ordenarAgendamentos),
      }))
      return atualizado
    } catch (erro) {
      console.error("[agendamentoStore] atualizarAgendamento:", erro)
      if (erro instanceof AgendamentoValidacaoError) {
        set({ erro: erro.validacao.mensagem, erroValidacao: erro.validacao })
        tratarErroSalvar(erro)
      }
      const msg = mensagemDeErro(erro)
      set({ erro: msg })
      throw erro
    }
  },

  salvarAgendamento: async (dados, id) => {
    set({ erro: null, erroValidacao: null })
    try {
      if (id != null) {
        return await get().atualizarAgendamento(id, dados)
      }
      return await get().criarAgendamento(dados)
    } catch (erro) {
      if (erro instanceof AgendamentoValidacaoError) {
        set({ erro: erro.validacao.mensagem, erroValidacao: erro.validacao })
      }
      throw erro
    }
  },

  removerAgendamento: async (id) => {
    set({ erro: null, erroValidacao: null })
    try {
      await agendamentoApi.removerAgendamento(id)
      set((state) => ({
        agendamentos: state.agendamentos.filter((a) => a.id !== id),
      }))
    } catch (erro) {
      console.error("[agendamentoStore] removerAgendamento:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  transferirAgendamento: async (id, profissional, confirmar = false) => {
    set({ erro: null, erroValidacao: null })
    try {
      const resultado = await agendamentoApi.transferirAgendamento(id, profissional, confirmar)
      // Só atualiza a lista quando a transferência foi de fato efetivada;
      // enquanto `requer_confirmacao` for true, nada mudou no backend.
      if (!resultado.requer_confirmacao) {
        set((state) => ({
          agendamentos: state.agendamentos
            .map((a) => (a.id === id ? resultado.agendamento : a))
            .sort(ordenarAgendamentos),
        }))
      }
      return resultado
    } catch (erro) {
      // O modal de transferência exibe os erros localmente; não poluímos o
      // banner global de erro da página (diferente de criar/atualizar).
      console.error("[agendamentoStore] transferirAgendamento:", erro)
      throw erro
    }
  },
}))

function ordenarAgendamentos(a: Agendamento, b: Agendamento): number {
  const cmpData = a.data.localeCompare(b.data)
  if (cmpData !== 0) return cmpData
  return a.horario_inicio.localeCompare(b.horario_inicio)
}
