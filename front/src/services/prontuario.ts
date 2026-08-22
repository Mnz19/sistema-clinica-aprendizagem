/**
 * Serviço do prontuário eletrônico modular (`apps.prontuario`).
 *
 * Configuração (DIREÇÃO): categorias, itens, textos padrão, grupos de exames,
 * modelos de atestado, replicar, protocolos.
 * Preenchimento: entradas, anexos, atestados.
 */
import { api } from "@/services/api"
import type {
  Atestado,
  AnexoEntrada,
  CategoriaItem,
  CID,
  ComentarioEntrada,
  ComentarioEntradaPayload,
  EntradaPayload,
  EntradaProntuario,
  GrupoExames,
  GrupoExamesPayload,
  ItemProntuario,
  ItemProntuarioPayload,
  ModeloAtestado,
  ModeloAtestadoPayload,
  Protocolo,
  TextoPadrao,
  TextoPadraoPayload,
} from "@/types/prontuario"

// --- Categorias --------------------------------------------------------------

export async function listarCategorias(profissionalId: number): Promise<CategoriaItem[]> {
  const { data } = await api.get<CategoriaItem[]>("/prontuario/categorias/", {
    params: { profissional: profissionalId },
  })
  return data
}

export async function criarCategoria(payload: {
  profissional: number
  nome: string
  ordem?: number
}): Promise<CategoriaItem> {
  const { data } = await api.post<CategoriaItem>("/prontuario/categorias/", payload)
  return data
}

export async function removerCategoria(id: number): Promise<void> {
  await api.delete(`/prontuario/categorias/${id}/`)
}

// --- Itens -------------------------------------------------------------------

export async function listarItens(profissionalId: number): Promise<ItemProntuario[]> {
  const { data } = await api.get<ItemProntuario[]>("/prontuario/itens/", {
    params: { profissional: profissionalId },
  })
  return data
}

export async function criarItem(payload: ItemProntuarioPayload): Promise<ItemProntuario> {
  const { data } = await api.post<ItemProntuario>("/prontuario/itens/", payload)
  return data
}

export async function atualizarItem(
  id: number,
  payload: Partial<ItemProntuarioPayload>
): Promise<ItemProntuario> {
  const { data } = await api.patch<ItemProntuario>(`/prontuario/itens/${id}/`, payload)
  return data
}

export async function removerItem(id: number): Promise<void> {
  await api.delete(`/prontuario/itens/${id}/`)
}

export async function reordenarItens(
  itens: { id: number; ordem: number }[]
): Promise<void> {
  await api.post("/prontuario/itens/reordenar/", itens)
}

/** Garante que os itens fixos do sistema existam para o profissional. */
export async function provisionarFixos(profissionalId: number): Promise<void> {
  await api.post("/prontuario/itens/provisionar_fixos/", { profissional: profissionalId })
}

// --- Textos padrão -----------------------------------------------------------

export async function listarTextosPadrao(params: {
  profissional?: number
  item?: number
}): Promise<TextoPadrao[]> {
  const { data } = await api.get<TextoPadrao[]>("/prontuario/textos-padrao/", {
    params: { profissional: params.profissional, item: params.item },
  })
  return data
}

export async function criarTextoPadrao(payload: TextoPadraoPayload): Promise<TextoPadrao> {
  const { data } = await api.post<TextoPadrao>("/prontuario/textos-padrao/", payload)
  return data
}

export async function atualizarTextoPadrao(
  id: number,
  payload: Partial<TextoPadraoPayload>
): Promise<TextoPadrao> {
  const { data } = await api.patch<TextoPadrao>(`/prontuario/textos-padrao/${id}/`, payload)
  return data
}

export async function removerTextoPadrao(id: number): Promise<void> {
  await api.delete(`/prontuario/textos-padrao/${id}/`)
}

// --- Grupos de exames --------------------------------------------------------

export async function listarGruposExames(profissionalId: number): Promise<GrupoExames[]> {
  const { data } = await api.get<GrupoExames[]>("/prontuario/grupos-exames/", {
    params: { profissional: profissionalId },
  })
  return data
}

export async function criarGrupoExames(payload: GrupoExamesPayload): Promise<GrupoExames> {
  const { data } = await api.post<GrupoExames>("/prontuario/grupos-exames/", payload)
  return data
}

export async function atualizarGrupoExames(
  id: number,
  payload: Partial<GrupoExamesPayload>
): Promise<GrupoExames> {
  const { data } = await api.patch<GrupoExames>(`/prontuario/grupos-exames/${id}/`, payload)
  return data
}

export async function removerGrupoExames(id: number): Promise<void> {
  await api.delete(`/prontuario/grupos-exames/${id}/`)
}

// --- Modelos de atestado -----------------------------------------------------

export async function listarModelosAtestado(profissionalId: number): Promise<ModeloAtestado[]> {
  const { data } = await api.get<ModeloAtestado[]>("/prontuario/modelos-atestado/", {
    params: { profissional: profissionalId },
  })
  return data
}

export async function criarModeloAtestado(
  payload: ModeloAtestadoPayload
): Promise<ModeloAtestado> {
  const { data } = await api.post<ModeloAtestado>("/prontuario/modelos-atestado/", payload)
  return data
}

export async function atualizarModeloAtestado(
  id: number,
  payload: Partial<ModeloAtestadoPayload>
): Promise<ModeloAtestado> {
  const { data } = await api.patch<ModeloAtestado>(
    `/prontuario/modelos-atestado/${id}/`,
    payload
  )
  return data
}

export async function removerModeloAtestado(id: number): Promise<void> {
  await api.delete(`/prontuario/modelos-atestado/${id}/`)
}

// --- Replicar / protocolos ---------------------------------------------------

export async function replicarConfig(payload: {
  origem: number
  destino: number
  incluir: string[]
}): Promise<Record<string, number>> {
  const { data } = await api.post<Record<string, number>>(
    "/prontuario/config/replicar/",
    payload
  )
  return data
}

export async function listarProtocolos(params: {
  especialidade?: number
} = {}): Promise<Protocolo[]> {
  const { data } = await api.get<Protocolo[]>("/prontuario/protocolos/", {
    params: { especialidade: params.especialidade },
  })
  return data
}

export async function importarProtocolo(
  id: number,
  payload: { profissional: number; categoria?: number | null }
): Promise<ItemProntuario> {
  const { data } = await api.post<ItemProntuario>(
    `/prontuario/protocolos/${id}/importar/`,
    payload
  )
  return data
}

// --- Preenchimento (entradas) ------------------------------------------------

/** Itens visíveis do próprio usuário (cada profissional preenche o seu prontuário). */
export async function listarItensDoPaciente(pacienteId: number): Promise<ItemProntuario[]> {
  const { data } = await api.get<ItemProntuario[]>(
    "/prontuario/entradas/itens-do-paciente/",
    { params: { paciente: pacienteId } }
  )
  return data
}

export async function listarEntradas(params: {
  paciente: number
  item?: number
}): Promise<EntradaProntuario[]> {
  const { data } = await api.get<EntradaProntuario[]>("/prontuario/entradas/", {
    params: { paciente: params.paciente, item: params.item },
  })
  return data
}

export async function criarEntrada(payload: EntradaPayload): Promise<EntradaProntuario> {
  const { data } = await api.post<EntradaProntuario>("/prontuario/entradas/", payload)
  return data
}

export async function atualizarEntrada(
  id: number,
  payload: Partial<EntradaPayload>
): Promise<EntradaProntuario> {
  const { data } = await api.patch<EntradaProntuario>(`/prontuario/entradas/${id}/`, payload)
  return data
}

export async function removerEntrada(id: number): Promise<void> {
  await api.delete(`/prontuario/entradas/${id}/`)
}

export async function enviarAnexo(input: {
  entrada: number
  arquivo: File
  descricao?: string
}): Promise<AnexoEntrada> {
  const form = new FormData()
  form.append("entrada", String(input.entrada))
  form.append("arquivo", input.arquivo)
  if (input.descricao) form.append("descricao", input.descricao)
  const { data } = await api.post<AnexoEntrada>("/prontuario/anexos/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}

export async function removerAnexo(id: number): Promise<void> {
  await api.delete(`/prontuario/anexos/${id}/`)
}

// --- Anotações (observações / comentários) -----------------------------------

export async function listarComentarios(params: {
  entrada?: number
  paciente?: number
  tipo?: string
}): Promise<ComentarioEntrada[]> {
  const { data } = await api.get<ComentarioEntrada[]>("/prontuario/comentarios/", {
    params: {
      entrada: params.entrada,
      entrada__paciente: params.paciente,
      tipo: params.tipo,
    },
  })
  return data
}

export async function criarComentario(
  payload: ComentarioEntradaPayload
): Promise<ComentarioEntrada> {
  const { data } = await api.post<ComentarioEntrada>("/prontuario/comentarios/", payload)
  return data
}

export async function atualizarComentario(
  id: number,
  payload: Partial<Pick<ComentarioEntradaPayload, "texto">>
): Promise<ComentarioEntrada> {
  const { data } = await api.patch<ComentarioEntrada>(`/prontuario/comentarios/${id}/`, payload)
  return data
}

export async function removerComentario(id: number): Promise<void> {
  await api.delete(`/prontuario/comentarios/${id}/`)
}

// --- Atestados ---------------------------------------------------------------

export async function listarAtestados(pacienteId: number): Promise<Atestado[]> {
  const { data } = await api.get<Atestado[]>("/prontuario/atestados/", {
    params: { paciente: pacienteId },
  })
  return data
}

export async function obterAtestado(id: number): Promise<Atestado> {
  const { data } = await api.get<Atestado>(`/prontuario/atestados/${id}/`)
  return data
}

export async function gerarAtestado(payload: {
  paciente: number
  modelo: number
  agendamento?: number | null
  cids?: CID[]
}): Promise<Atestado> {
  const { data } = await api.post<Atestado>("/prontuario/atestados/gerar/", payload)
  return data
}
