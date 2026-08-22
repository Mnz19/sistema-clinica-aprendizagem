/**
 * Serviço de pacientes: chamadas à API do backend (`apps.pacientes`).
 *
 * Endpoints:
 *   GET/POST/PATCH/DELETE `/pacientes/`      → cadastro
 *   GET/POST/DELETE       `/documentos/`     → anexos (upload multipart)
 *   GET                   `/profissionais/`  → profissionais disponíveis p/ vínculo
 */
import { api } from "@/services/api"
import type {
  DocumentoPaciente,
  Paciente,
  PacienteListItem,
  PacientePayload,
  ProfissionalResumo,
  TipoDocumento,
} from "@/types/paciente"

interface ListarParams {
  search?: string
  ativo?: boolean
  profissional?: number
}

/** Lista pacientes (representação enxuta). */
export async function listarPacientes(
  params: ListarParams = {}
): Promise<PacienteListItem[]> {
  const { data } = await api.get<PacienteListItem[]>("/pacientes/", {
    params: {
      search: params.search || undefined,
      ativo: params.ativo,
      profissionais: params.profissional,
    },
  })
  return data
}

/** Busca um paciente pelo id (cadastro completo). */
export async function obterPaciente(id: number): Promise<Paciente> {
  const { data } = await api.get<Paciente>(`/pacientes/${id}/`)
  return data
}

/** Cria um novo paciente. */
export async function criarPaciente(payload: PacientePayload): Promise<Paciente> {
  const { data } = await api.post<Paciente>("/pacientes/", payload)
  return data
}

/** Atualiza (parcialmente) um paciente. */
export async function atualizarPaciente(
  id: number,
  payload: Partial<PacientePayload>
): Promise<Paciente> {
  const { data } = await api.patch<Paciente>(`/pacientes/${id}/`, payload)
  return data
}

/** Envia/atualiza a foto do paciente (multipart, apenas o campo `foto`). */
export async function atualizarFotoPaciente(id: number, arquivo: File): Promise<Paciente> {
  const form = new FormData()
  form.append("foto", arquivo)
  const { data } = await api.patch<Paciente>(`/pacientes/${id}/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

/** Remove a foto do paciente. */
export async function removerFotoPaciente(id: number): Promise<Paciente> {
  const { data } = await api.patch<Paciente>(`/pacientes/${id}/`, { foto: null })
  return data
}

/** Desativa (exclusão lógica) um paciente. */
export async function desativarPaciente(id: number): Promise<void> {
  await api.delete(`/pacientes/${id}/`)
}

/** Reativa um paciente previamente desativado. */
export async function reativarPaciente(id: number): Promise<Paciente> {
  const { data } = await api.patch<Paciente>(`/pacientes/${id}/`, { ativo: true })
  return data
}

/** Lista os profissionais disponíveis para vínculo. */
export async function listarProfissionais(): Promise<ProfissionalResumo[]> {
  const { data } = await api.get<ProfissionalResumo[]>("/profissionais/")
  return data
}

/** Envia um anexo (multipart) para o paciente. */
export async function enviarDocumento(input: {
  paciente: number
  arquivo: File
  tipo: TipoDocumento
  descricao?: string
}): Promise<DocumentoPaciente> {
  const form = new FormData()
  form.append("paciente", String(input.paciente))
  form.append("arquivo", input.arquivo)
  form.append("tipo", input.tipo)
  if (input.descricao) form.append("descricao", input.descricao)

  const { data } = await api.post<DocumentoPaciente>("/documentos/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

/** Remove um anexo do paciente. */
export async function removerDocumento(id: number): Promise<void> {
  await api.delete(`/documentos/${id}/`)
}
