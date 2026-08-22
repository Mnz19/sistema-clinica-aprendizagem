/** Configuração de prontuário por profissional (DIREÇÃO). */
import { useEffect, useState } from "react"
import {
  ClipboardListIcon,
  CopyIcon,
  FileStackIcon,
  FlaskConicalIcon,
  Loader2Icon,
  ScrollTextIcon,
  SettingsIcon,
} from "lucide-react"

import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Tabs } from "@/components/ui/tabs"
import type { TabItem } from "@/components/ui/tabs"
import { mensagemDeErro } from "@/utils/apiError"
import { listarProfissionais } from "@/services/pacientes"
import type { ProfissionalResumo } from "@/types/paciente"
import { ItensTab } from "@/features/prontuario/components/config/ItensTab"
import { TextosPadraoTab } from "@/features/prontuario/components/config/TextosPadraoTab"
import { GruposExamesTab } from "@/features/prontuario/components/config/GruposExamesTab"
import { AtestadosTab } from "@/features/prontuario/components/config/AtestadosTab"
import { ReplicarTab } from "@/features/prontuario/components/config/ReplicarTab"
import { ProtocolosTab } from "@/features/prontuario/components/config/ProtocolosTab"

const ABAS: TabItem[] = [
  { id: "itens", label: "Itens de Prontuário", icon: ClipboardListIcon },
  { id: "textos", label: "Texto Padrão", icon: FileStackIcon },
  { id: "grupos", label: "Grupo de Exames", icon: FlaskConicalIcon },
  { id: "atestados", label: "Atestados", icon: ScrollTextIcon },
  { id: "protocolos", label: "Protocolos prontos", icon: SettingsIcon },
  { id: "replicar", label: "Replicar", icon: CopyIcon },
]

export default function ConfiguracaoProntuarioPage() {
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([])
  const [profissionalId, setProfissionalId] = useState<number | null>(null)
  const [aba, setAba] = useState("itens")
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // Chave para forçar recarga das abas após importar/replicar.
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let ativo = true
    listarProfissionais()
      .then((lista) => {
        if (!ativo) return
        setProfissionais(lista)
        if (lista.length > 0) setProfissionalId(lista[0].id)
      })
      .catch((e) => ativo && setErro(mensagemDeErro(e)))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [])

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Configuração de Prontuário</h1>
        <p className="text-sm text-muted-foreground">
          Monte o prontuário de cada profissional: itens, textos, exames e atestados.
        </p>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="max-w-md space-y-1.5">
        <Label>Profissional</Label>
        <Select
          value={profissionalId ?? ""}
          onChange={(e) => setProfissionalId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Selecione…</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </div>

      {profissionalId == null ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">Selecione um profissional para configurar.</p>
        </div>
      ) : (
        <>
          <Tabs itens={ABAS} ativo={aba} onChange={setAba} />

          <div key={`${profissionalId}-${recarga}`}>
            {aba === "itens" && <ItensTab profissionalId={profissionalId} />}
            {aba === "textos" && <TextosPadraoTab profissionalId={profissionalId} />}
            {aba === "grupos" && <GruposExamesTab profissionalId={profissionalId} />}
            {aba === "atestados" && <AtestadosTab profissionalId={profissionalId} />}
            {aba === "protocolos" && (
              <ProtocolosTab
                profissionalId={profissionalId}
                onImportado={() => setRecarga((r) => r + 1)}
              />
            )}
            {aba === "replicar" && (
              <ReplicarTab profissionais={profissionais} destinoId={profissionalId} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
