/**
 * Renderiza um formulário personalizado.
 *
 * - Modo edição: controles por tipo de campo, coletando `respostas`.
 * - Modo leitura (`readOnly`): lista rótulo → valor (para exibição/impressão).
 */
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import type { CampoFormulario } from "@/types/prontuario"

interface Props {
  schema: CampoFormulario[]
  valores: Record<string, unknown>
  onChange?: (valores: Record<string, unknown>) => void
  readOnly?: boolean
}

function valorTexto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.join(", ")
  if (valor == null) return ""
  return String(valor)
}

export function FormRenderer({ schema, valores, onChange, readOnly }: Props) {
  const ordenado = [...schema].sort((a, b) => a.ordem - b.ordem)

  function set(id: string, valor: unknown) {
    onChange?.({ ...valores, [id]: valor })
  }

  if (readOnly) {
    return (
      <dl className="space-y-2">
        {ordenado.map((campo) =>
          campo.tipo === "SECAO" ? (
            <h4 key={campo.id} className="pt-2 text-sm font-semibold text-foreground">
              {campo.rotulo}
            </h4>
          ) : (
            <div key={campo.id}>
              <dt className="text-xs font-medium uppercase text-muted-foreground">
                {campo.rotulo}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                {valorTexto(valores[campo.id]) || "—"}
              </dd>
            </div>
          )
        )}
      </dl>
    )
  }

  return (
    <div className="space-y-4">
      {ordenado.map((campo) => {
        if (campo.tipo === "SECAO") {
          return (
            <h4 key={campo.id} className="border-b border-border pb-1 pt-2 text-sm font-semibold">
              {campo.rotulo}
            </h4>
          )
        }
        const valor = valores[campo.id]
        const rotulo = (
          <Label>
            {campo.rotulo}
            {campo.obrigatorio && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
        )
        return (
          <div key={campo.id} className="space-y-1.5">
            {rotulo}
            {campo.tipo === "TEXTO_LONGO" ? (
              <textarea
                value={valorTexto(valor)}
                onChange={(e) => set(campo.id, e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
              />
            ) : campo.tipo === "DATA" ? (
              <Input type="date" value={valorTexto(valor)} onChange={(e) => set(campo.id, e.target.value)} />
            ) : campo.tipo === "NUMERO" ? (
              <Input type="number" value={valorTexto(valor)} onChange={(e) => set(campo.id, e.target.value)} />
            ) : campo.tipo === "SELECAO_UNICA" ? (
              <Select value={valorTexto(valor)} onChange={(e) => set(campo.id, e.target.value)}>
                <option value="">Selecione…</option>
                {(campo.opcoes ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : campo.tipo === "MULTIPLA_ESCOLHA" ? (
              <div className="space-y-1">
                {(campo.opcoes ?? []).map((o) => {
                  const marcadas = Array.isArray(valor) ? (valor as string[]) : []
                  const marcado = marcadas.includes(o)
                  return (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={(e) =>
                          set(
                            campo.id,
                            e.target.checked
                              ? [...marcadas, o]
                              : marcadas.filter((x) => x !== o)
                          )
                        }
                        className="size-4 rounded border-input"
                      />
                      {o}
                    </label>
                  )
                })}
              </div>
            ) : (
              <Input value={valorTexto(valor)} onChange={(e) => set(campo.id, e.target.value)} />
            )}
          </div>
        )
      })}
    </div>
  )
}
