/**
 * Painel de filtros da aba de Relatórios.
 *
 * Renderiza apenas os campos que o relatório selecionado declara em
 * `RelatorioDefinicao.filtros` — assim um único componente atende os quatro
 * relatórios sem `if` espalhado pela página.
 */
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { UFS } from "@/types/paciente"
import {
  OPCOES_FORMA_PAGAMENTO,
  OPCOES_MOTIVO,
  OPCOES_STATUS,
  type CampoFiltro,
  type FiltrosRelatorio,
  type OpcaoFiltro,
} from "@/types/relatorio"
import type { PacienteListItem } from "@/types/paciente"
import type { Usuario } from "@/types/auth"
import type { Sala, Servico } from "@/types/clinica"

interface RelatorioFiltrosProps {
  campos: CampoFiltro[]
  filtros: FiltrosRelatorio
  onChange: (filtros: FiltrosRelatorio) => void
  onLimpar: () => void
  profissionais: Usuario[]
  pacientes: PacienteListItem[]
  salas: Sala[]
  servicos: Servico[]
}

/** Grupo de caixas de seleção para um filtro de múltipla escolha. */
function FiltroMultiplo({
  titulo,
  opcoes,
  selecionados,
  onToggle,
}: {
  titulo: string
  opcoes: readonly OpcaoFiltro[]
  selecionados: string[]
  onToggle: (valor: string) => void
}) {
  return (
    <fieldset className="min-w-[16rem] flex-1 space-y-1.5">
      <legend className="text-sm font-medium text-foreground">{titulo}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground"
          >
            <input
              type="checkbox"
              className="size-3.5 rounded border-border accent-zinc-900"
              checked={selecionados.includes(opcao.valor)}
              onChange={() => onToggle(opcao.valor)}
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function RelatorioFiltros({
  campos,
  filtros,
  onChange,
  onLimpar,
  profissionais,
  pacientes,
  salas,
  servicos,
}: RelatorioFiltrosProps) {
  // Atualização imutável: sempre um novo objeto de filtros.
  const definir = (chave: keyof FiltrosRelatorio, valor: string) =>
    onChange({ ...filtros, [chave]: valor })

  const alternarMultiplo = (chave: keyof FiltrosRelatorio, valor: string) => {
    const atuais = (filtros[chave] as string[] | undefined) ?? []
    const proximos = atuais.includes(valor)
      ? atuais.filter((item) => item !== valor)
      : [...atuais, valor]
    onChange({ ...filtros, [chave]: proximos })
  }

  const mostra = (campo: CampoFiltro) => campos.includes(campo)

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        {mostra("periodo") && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rel-data-inicio">Data inicial</Label>
              <Input
                id="rel-data-inicio"
                type="date"
                value={filtros.data_inicio ?? ""}
                onChange={(e) => definir("data_inicio", e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rel-data-fim">Data final</Label>
              <Input
                id="rel-data-fim"
                type="date"
                value={filtros.data_fim ?? ""}
                onChange={(e) => definir("data_fim", e.target.value)}
                className="w-40"
              />
            </div>
          </>
        )}

        {mostra("busca") && (
          <div className="min-w-[14rem] flex-1 space-y-1.5 sm:max-w-xs">
            <Label htmlFor="rel-busca">Nome do paciente</Label>
            <Input
              id="rel-busca"
              type="search"
              placeholder="Buscar por nome…"
              value={filtros.busca ?? ""}
              onChange={(e) => definir("busca", e.target.value)}
            />
          </div>
        )}

        {mostra("profissional") && (
          <div className="min-w-[13rem] flex-1 space-y-1.5 sm:max-w-xs">
            <Label htmlFor="rel-profissional">Profissional</Label>
            <Select
              id="rel-profissional"
              value={filtros.profissional ?? ""}
              onChange={(e) => definir("profissional", e.target.value)}
            >
              <option value="">Todos os profissionais</option>
              {profissionais.map((profissional) => (
                <option key={profissional.id} value={profissional.id}>
                  {profissional.nome}
                </option>
              ))}
            </Select>
          </div>
        )}

        {mostra("paciente") && (
          <div className="min-w-[13rem] flex-1 space-y-1.5 sm:max-w-xs">
            <Label htmlFor="rel-paciente">Paciente</Label>
            <Select
              id="rel-paciente"
              value={filtros.paciente ?? ""}
              onChange={(e) => definir("paciente", e.target.value)}
            >
              <option value="">Todos os pacientes</option>
              {pacientes.map((paciente) => (
                <option key={paciente.id} value={paciente.id}>
                  {paciente.nome_completo}
                </option>
              ))}
            </Select>
          </div>
        )}

        {mostra("sala") && (
          <div className="min-w-[11rem] space-y-1.5">
            <Label htmlFor="rel-sala">Sala</Label>
            <Select
              id="rel-sala"
              value={filtros.sala ?? ""}
              onChange={(e) => definir("sala", e.target.value)}
            >
              <option value="">Todas</option>
              {salas.map((sala) => (
                <option key={sala.id} value={sala.id}>
                  {sala.nome}
                </option>
              ))}
            </Select>
          </div>
        )}

        {mostra("servico") && (
          <div className="min-w-[13rem] space-y-1.5">
            <Label htmlFor="rel-servico">Serviço</Label>
            <Select
              id="rel-servico"
              value={filtros.servico ?? ""}
              onChange={(e) => definir("servico", e.target.value)}
            >
              <option value="">Todos</option>
              {servicos.map((servico) => (
                <option key={servico.id} value={servico.id}>
                  {servico.nome}
                </option>
              ))}
            </Select>
          </div>
        )}

        {mostra("ativo") && (
          <div className="min-w-[11rem] space-y-1.5">
            <Label htmlFor="rel-ativo">Situação</Label>
            <Select
              id="rel-ativo"
              value={filtros.ativo ?? ""}
              onChange={(e) => definir("ativo", e.target.value)}
            >
              <option value="">Todas</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </Select>
          </div>
        )}

        {mostra("cadastro_incompleto") && (
          <div className="min-w-[12rem] space-y-1.5">
            <Label htmlFor="rel-cadastro">Cadastro</Label>
            <Select
              id="rel-cadastro"
              value={filtros.cadastro_incompleto ?? ""}
              onChange={(e) => definir("cadastro_incompleto", e.target.value)}
            >
              <option value="">Todos</option>
              <option value="false">Completos</option>
              <option value="true">Incompletos</option>
            </Select>
          </div>
        )}

        {mostra("estado") && (
          <div className="min-w-[7rem] space-y-1.5">
            <Label htmlFor="rel-estado">UF</Label>
            <Select
              id="rel-estado"
              value={filtros.estado ?? ""}
              onChange={(e) => definir("estado", e.target.value)}
            >
              <option value="">Todas</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
        )}

        {mostra("cidade") && (
          <div className="min-w-[11rem] space-y-1.5">
            <Label htmlFor="rel-cidade">Cidade</Label>
            <Input
              id="rel-cidade"
              value={filtros.cidade ?? ""}
              onChange={(e) => definir("cidade", e.target.value)}
              placeholder="Ex.: Belém"
            />
          </div>
        )}

        {mostra("agrupar") && (
          <div className="min-w-[15rem] space-y-1.5">
            <Label htmlFor="rel-agrupar">Visão</Label>
            <Select
              id="rel-agrupar"
              value={filtros.agrupar ?? "false"}
              onChange={(e) => definir("agrupar", e.target.value)}
            >
              <option value="false">Detalhada (por atendimento)</option>
              <option value="true">Consolidada (por profissional)</option>
            </Select>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLimpar}
          className="ml-auto"
        >
          <XIcon className="size-4" />
          Limpar filtros
        </Button>
      </div>

      {(mostra("status") || mostra("motivo") || mostra("forma_pagamento")) && (
        <div className="flex flex-wrap gap-6 border-t border-border pt-4">
          {mostra("status") && (
            <FiltroMultiplo
              titulo="Status do agendamento"
              opcoes={OPCOES_STATUS}
              selecionados={filtros.status ?? []}
              onToggle={(valor) => alternarMultiplo("status", valor)}
            />
          )}
          {mostra("motivo") && (
            <FiltroMultiplo
              titulo="Motivo da cobrança"
              opcoes={OPCOES_MOTIVO}
              selecionados={filtros.motivo ?? []}
              onToggle={(valor) => alternarMultiplo("motivo", valor)}
            />
          )}
          {mostra("forma_pagamento") && (
            <FiltroMultiplo
              titulo="Forma de pagamento"
              opcoes={OPCOES_FORMA_PAGAMENTO}
              selecionados={filtros.forma_pagamento ?? []}
              onToggle={(valor) => alternarMultiplo("forma_pagamento", valor)}
            />
          )}
        </div>
      )}
    </div>
  )
}
