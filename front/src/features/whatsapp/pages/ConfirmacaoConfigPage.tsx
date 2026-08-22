/** Configuração das confirmações de consulta por WhatsApp. */
import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
  InfoIcon,
  Loader2Icon,
  MessageCircleIcon,
  SaveIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { mensagemDeErro } from "@/utils/apiError"
import { obterConfiguracao, salvarConfiguracao } from "@/services/whatsapp"
import type { ConfiguracaoConfirmacao } from "@/types/whatsapp"

/** Prévia da mensagem com dados de exemplo. */
function preview(mensagem: string): string {
  return mensagem
    .replace(/\{paciente\}/g, "João")
    .replace(/\{data\}/g, "20/07/2026")
    .replace(/\{hora\}/g, "15:00")
    .replace(/\{profissional\}/g, "Gabrielle")
}

export default function ConfirmacaoConfigPage() {
  const [config, setConfig] = useState<ConfiguracaoConfirmacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Campos editáveis
  const [ativo, setAtivo] = useState(true)
  const [antecedencia, setAntecedencia] = useState(1)
  const [horario, setHorario] = useState("09:00")
  const [mensagem, setMensagem] = useState("")
  const [templateNome, setTemplateNome] = useState("")
  const [templateIdioma, setTemplateIdioma] = useState("pt_BR")

  useEffect(() => {
    let ativoEfeito = true
    async function carregar() {
      setCarregando(true)
      try {
        const c = await obterConfiguracao()
        if (!ativoEfeito) return
        setConfig(c)
        setAtivo(c.ativo)
        setAntecedencia(c.antecedencia_dias)
        setHorario(c.horario_disparo.slice(0, 5))
        setMensagem(c.mensagem)
        setTemplateNome(c.template_meta_nome)
        setTemplateIdioma(c.template_meta_idioma)
      } catch (e) {
        if (ativoEfeito) setErro(mensagemDeErro(e))
      } finally {
        if (ativoEfeito) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativoEfeito = false
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setMsg(null)
    setSalvando(true)
    try {
      const atualizado = await salvarConfiguracao({
        ativo,
        antecedencia_dias: antecedencia,
        horario_disparo: horario,
        mensagem,
        template_meta_nome: templateNome,
        template_meta_idioma: templateIdioma,
      })
      setConfig(atualizado)
      setMsg("Configuração salva.")
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Carregando…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <MessageCircleIcon className="size-5" /> Confirmação por WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground">
          Envio automático da confirmação de consulta antes do atendimento.
        </p>
      </div>

      {config?.simulado && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Modo <strong>simulado</strong>: sem credenciais da Meta, as mensagens são
            apenas registradas (não enviadas). Configure as credenciais no servidor
            para envio real.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {erro && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </div>
        )}
        {msg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {msg}
          </div>
        )}

        {/* Quando enviar */}
        <Card>
          <CardHeader>
            <CardTitle>Quando enviar</CardTitle>
            <CardDescription>
              Defina a antecedência e o horário do disparo automático.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Envio automático</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAtivo(true)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    ativo
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Ativado
                </button>
                <button
                  type="button"
                  onClick={() => setAtivo(false)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    !ativo
                      ? "border-destructive bg-destructive/5 text-destructive"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Desativado
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Antecedência (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={antecedencia}
                  onChange={(e) => setAntecedencia(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  1 = enviar na véspera da consulta.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Horário do disparo</Label>
                <Input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                />
              </div>
            </div>

            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Resumo: enviar {antecedencia === 0 ? "no mesmo dia" : `${antecedencia} dia(s) antes`}
              , às {horario}.
            </p>
          </CardContent>
        </Card>

        {/* Mensagem */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagem</CardTitle>
            <CardDescription>
              Marcadores disponíveis: {"{paciente}"}, {"{data}"}, {"{hora}"}, {"{profissional}"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={4}
            />
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prévia
              </p>
              <p className="mt-1 text-sm text-foreground">{preview(mensagem)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Integração Meta */}
        <Card>
          <CardHeader>
            <CardTitle>Template (Meta)</CardTitle>
            <CardDescription>
              O envio oficial usa um template aprovado no WhatsApp Cloud API.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome do template</Label>
              <Input
                value={templateNome}
                onChange={(e) => setTemplateNome(e.target.value)}
                placeholder="confirmacao_consulta"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Input
                value={templateIdioma}
                onChange={(e) => setTemplateIdioma(e.target.value)}
                placeholder="pt_BR"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          {config && (
            <Badge variant="secondary">
              {config.simulado ? "Simulado" : "Meta conectada"}
            </Badge>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            Salvar
          </Button>
        </div>
      </form>
    </div>
  )
}
