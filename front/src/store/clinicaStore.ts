/**
 * Store da clínica (Zustand): Salas, Serviços, Disponibilidades, Ausências e Profissionais.
 *
 * Fonte única da verdade das "Fundações Operacionais" no front-end, sincronizada
 * com a API Django DRF (`apps.clinica` + usuários com papel PROFISSIONAL).
 */
import { create } from "zustand"

import * as clinicaApi from "@/services/clinica"
import { mensagemDeErro } from "@/utils/apiError"
import type { Usuario } from "@/types/auth"
import type {
  Ausencia,
  AusenciaPayload,
  Disponibilidade,
  GradeSemanalSlot,
  Sala,
  SalaPayload,
  Servico,
  ServicoPayload,
} from "@/types/clinica"

interface ClinicaState {
  salas: Sala[]
  servicos: Servico[]
  disponibilidades: Disponibilidade[]
  ausencias: Ausencia[]
  profissionais: Usuario[]
  isLoading: boolean
  erro: string | null

  buscarSalas: () => Promise<void>
  buscarServicos: () => Promise<void>
  buscarDisponibilidades: () => Promise<void>
  buscarAusencias: () => Promise<void>
  buscarProfissionais: () => Promise<void>

  criarSala: (dados: SalaPayload) => Promise<Sala>
  atualizarSala: (id: number, dados: SalaPayload) => Promise<Sala>
  removerSala: (id: number) => Promise<void>
  reativarSala: (id: number) => Promise<Sala>

  criarServico: (dados: ServicoPayload) => Promise<Servico>
  atualizarServico: (id: number, dados: ServicoPayload) => Promise<Servico>
  removerServico: (id: number) => Promise<void>
  reativarServico: (id: number) => Promise<Servico>

  removerDisponibilidade: (id: number) => Promise<void>
  reativarDisponibilidade: (id: number) => Promise<void>
  salvarGradeSemanal: (profissional_id: number, slots: GradeSemanalSlot[]) => Promise<Disponibilidade[]>

  criarAusencia: (dados: AusenciaPayload) => Promise<Ausencia>
  atualizarAusencia: (id: number, dados: AusenciaPayload) => Promise<Ausencia>
  removerAusencia: (id: number) => Promise<void>
  reativarAusencia: (id: number) => Promise<void>
}

export const useClinicaStore = create<ClinicaState>()((set, get) => ({
  salas: [],
  servicos: [],
  disponibilidades: [],
  ausencias: [],
  profissionais: [],
  isLoading: false,
  erro: null,

  buscarSalas: async () => {
    set({ isLoading: true, erro: null })
    try {
      const salas = await clinicaApi.listarSalas()
      set({ salas })
    } catch (erro) {
      console.error("[clinicaStore] buscarSalas:", erro)
      set({ erro: mensagemDeErro(erro) })
    } finally {
      set({ isLoading: false })
    }
  },

  buscarServicos: async () => {
    set({ isLoading: true, erro: null })
    try {
      const servicos = await clinicaApi.listarServicos()
      set({ servicos })
    } catch (erro) {
      console.error("[clinicaStore] buscarServicos:", erro)
      set({ erro: mensagemDeErro(erro) })
    } finally {
      set({ isLoading: false })
    }
  },

  buscarDisponibilidades: async () => {
    set({ isLoading: true, erro: null })
    try {
      const disponibilidades = await clinicaApi.listarDisponibilidades({ ativo: true })
      set({ disponibilidades })
    } catch (erro) {
      console.error("[clinicaStore] buscarDisponibilidades:", erro)
      set({ erro: mensagemDeErro(erro) })
    } finally {
      set({ isLoading: false })
    }
  },

  buscarAusencias: async () => {
    set({ isLoading: true, erro: null })
    try {
      const ausencias = await clinicaApi.listarAusencias({ ativo: true })
      set({ ausencias })
    } catch (erro) {
      console.error("[clinicaStore] buscarAusencias:", erro)
      set({ erro: mensagemDeErro(erro) })
    } finally {
      set({ isLoading: false })
    }
  },

  buscarProfissionais: async () => {
    if (get().profissionais.length > 0) return

    set({ isLoading: true, erro: null })
    try {
      const profissionais = await clinicaApi.listarProfissionaisClinica()
      set({ profissionais })
    } catch (erro) {
      console.error("[clinicaStore] buscarProfissionais:", erro)
      set({ erro: mensagemDeErro(erro) })
    } finally {
      set({ isLoading: false })
    }
  },

  criarSala: async (dados) => {
    set({ erro: null })
    try {
      const nova = await clinicaApi.criarSala(dados)
      set((state) => ({ salas: [...state.salas, nova] }))
      return nova
    } catch (erro) {
      console.error("[clinicaStore] criarSala:", erro)
      const msg = mensagemDeErro(erro)
      set({ erro: msg })
      throw erro
    }
  },

  atualizarSala: async (id, dados) => {
    set({ erro: null })
    try {
      const atualizada = await clinicaApi.atualizarSala(id, dados)
      set((state) => ({
        salas: state.salas.map((s) => (s.id === id ? atualizada : s)),
      }))
      return atualizada
    } catch (erro) {
      console.error("[clinicaStore] atualizarSala:", erro)
      const msg = mensagemDeErro(erro)
      set({ erro: msg })
      throw erro
    }
  },

  removerSala: async (id) => {
    set({ erro: null })
    try {
      await clinicaApi.desativarSala(id)
      set((state) => ({
        salas: state.salas.map((s) => (s.id === id ? { ...s, ativa: false } : s)),
      }))
    } catch (erro) {
      console.error("[clinicaStore] removerSala:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  reativarSala: async (id) => {
    set({ erro: null })
    try {
      const reativada = await clinicaApi.reativarSalaApi(id)
      set((state) => ({
        salas: state.salas.map((s) => (s.id === id ? reativada : s)),
      }))
      return reativada
    } catch (erro) {
      console.error("[clinicaStore] reativarSala:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  criarServico: async (dados) => {
    set({ erro: null })
    try {
      const novo = await clinicaApi.criarServico(dados)
      set((state) => ({ servicos: [...state.servicos, novo] }))
      return novo
    } catch (erro) {
      console.error("[clinicaStore] criarServico:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  atualizarServico: async (id, dados) => {
    set({ erro: null })
    try {
      const atualizado = await clinicaApi.atualizarServico(id, dados)
      set((state) => ({
        servicos: state.servicos.map((s) => (s.id === id ? atualizado : s)),
      }))
      return atualizado
    } catch (erro) {
      console.error("[clinicaStore] atualizarServico:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  removerServico: async (id) => {
    set({ erro: null })
    try {
      await clinicaApi.desativarServico(id)
      set((state) => ({
        servicos: state.servicos.map((s) => (s.id === id ? { ...s, ativo: false } : s)),
      }))
    } catch (erro) {
      console.error("[clinicaStore] removerServico:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  reativarServico: async (id) => {
    set({ erro: null })
    try {
      const reativado = await clinicaApi.reativarServicoApi(id)
      set((state) => ({
        servicos: state.servicos.map((s) => (s.id === id ? reativado : s)),
      }))
      return reativado
    } catch (erro) {
      console.error("[clinicaStore] reativarServico:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  removerDisponibilidade: async (id) => {
    set({ erro: null })
    try {
      await clinicaApi.desativarDisponibilidade(id)
      set((state) => ({
        disponibilidades: state.disponibilidades.filter((d) => d.id !== id),
      }))
    } catch (erro) {
      console.error("[clinicaStore] removerDisponibilidade:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  reativarDisponibilidade: async (id) => {
    set({ erro: null })
    try {
      const reativada = await clinicaApi.reativarDisponibilidadeApi(id)
      set((state) => ({
        disponibilidades: [...state.disponibilidades, reativada],
      }))
    } catch (erro) {
      console.error("[clinicaStore] reativarDisponibilidade:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  salvarGradeSemanal: async (profissional_id, slots) => {
    set({ isLoading: true, erro: null })
    try {
      const antigas = await clinicaApi.listarDisponibilidades({
        profissional: profissional_id,
        ativo: true,
      })

      await Promise.all(antigas.map((d) => clinicaApi.desativarDisponibilidade(d.id)))

      await Promise.all(slots.map((slot) => clinicaApi.criarDisponibilidade(profissional_id, slot)))

      await get().buscarDisponibilidades()

      return get().disponibilidades.filter(
        (d) => d.profissional_id === profissional_id && d.ativo
      )
    } catch (erro) {
      console.error("[clinicaStore] salvarGradeSemanal:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    } finally {
      set({ isLoading: false })
    }
  },

  criarAusencia: async (dados) => {
    set({ erro: null })
    try {
      const nova = await clinicaApi.criarAusencia(dados)
      set((state) => ({ ausencias: [nova, ...state.ausencias] }))
      return nova
    } catch (erro) {
      console.error("[clinicaStore] criarAusencia:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  atualizarAusencia: async (id, dados) => {
    set({ erro: null })
    try {
      const atualizada = await clinicaApi.atualizarAusencia(id, dados)
      set((state) => ({
        ausencias: state.ausencias.map((a) => (a.id === id ? atualizada : a)),
      }))
      return atualizada
    } catch (erro) {
      console.error("[clinicaStore] atualizarAusencia:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  removerAusencia: async (id) => {
    set({ erro: null })
    try {
      await clinicaApi.desativarAusencia(id)
      set((state) => ({
        ausencias: state.ausencias.filter((a) => a.id !== id),
      }))
    } catch (erro) {
      console.error("[clinicaStore] removerAusencia:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },

  reativarAusencia: async (id) => {
    set({ erro: null })
    try {
      const reativada = await clinicaApi.reativarAusenciaApi(id)
      set((state) => ({
        ausencias: [reativada, ...state.ausencias],
      }))
    } catch (erro) {
      console.error("[clinicaStore] reativarAusencia:", erro)
      set({ erro: mensagemDeErro(erro) })
      throw erro
    }
  },
}))
