/**
 * Seção "Google Agenda" do perfil: conectar/desconectar a conta Google e
 * ligar/desligar a sincronização dos próprios agendamentos.
 *
 * A conexão usa OAuth: o botão leva o usuário ao consentimento do Google e o
 * backend redireciona de volta para `/perfil?google=conectado|erro`.
 */
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  CalendarCheck2Icon,
  Link2OffIcon,
  Loader2Icon,
  PauseIcon,
  PlayIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { mensagemDeErro } from "@/utils/apiError"
import {
  alternarSincronizacaoGoogle,
  desconectarGoogle,
  obterStatusGoogle,
  obterUrlAutorizacaoGoogle,
  type StatusGoogleAgenda,
} from "@/services/googleAgenda"

export default function GoogleAgendaCard() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<StatusGoogleAgenda | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregarStatus() {
    try {
      setStatus(await obterStatusGoogle())
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarStatus()
  }, [])

  // Mensagem ao voltar do consentimento do Google (?google=conectado|erro).
  useEffect(() => {
    const retorno = params.get("google")
    if (!retorno) return
    if (retorno === "conectado") setMsg("Google Agenda conectado com sucesso.")
    else if (retorno === "erro")
      setErro("Não foi possível conectar o Google Agenda. Tente novamente.")
    // Remove o parâmetro da URL para não repetir a mensagem ao recarregar.
    params.delete("google")
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function conectar() {
    setErro(null)
    setProcessando(true)
    try {
      const url = await obterUrlAutorizacaoGoogle()
      // Redireciona a página inteira para o consentimento do Google.
      window.location.href = url
    } catch (err) {
      setErro(mensagemDeErro(err))
      setProcessando(false)
    }
  }

  async function desconectar() {
    setErro(null)
    setMsg(null)
    setProcessando(true)
    try {
      await desconectarGoogle()
      setMsg("Google Agenda desconectado.")
      await carregarStatus()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setProcessando(false)
    }
  }

  async function alternar(ativa: boolean) {
    setErro(null)
    setMsg(null)
    setProcessando(true)
    try {
      setStatus(await alternarSincronizacaoGoogle(ativa))
      setMsg(ativa ? "Sincronização retomada." : "Sincronização pausada.")
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setProcessando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck2Icon className="size-5 text-muted-foreground" />
          Google Agenda
        </CardTitle>
        <CardDescription>
          Sincronize seus agendamentos com o seu Google Agenda. Os eventos são
          criados como <strong>privados</strong> e incluem os dados da consulta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Carregando…
          </div>
        ) : !status?.configurado ? (
          <p className="text-sm text-muted-foreground">
            A integração com o Google Agenda ainda não foi configurada pela
            clínica.
          </p>
        ) : !status.conectado ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Você ainda não conectou sua conta Google.
            </p>
            <Button onClick={conectar} disabled={processando}>
              {processando ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <CalendarCheck2Icon className="size-4" />
              )}
              Conectar Google Agenda
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-sm">
                <p className="font-medium text-foreground">
                  {status.email_google || "Conta Google conectada"}
                </p>
                <p className="text-muted-foreground">
                  {status.ativa
                    ? "Sincronização ativa"
                    : "Sincronização pausada"}
                </p>
              </div>
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                  (status.ativa
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700")
                }
              >
                {status.ativa ? "Ativa" : "Pausada"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => alternar(!status.ativa)}
                disabled={processando}
              >
                {status.ativa ? (
                  <PauseIcon className="size-4" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
                {status.ativa ? "Pausar sincronização" : "Retomar sincronização"}
              </Button>
              <Button
                variant="outline"
                onClick={desconectar}
                disabled={processando}
                className="text-destructive hover:text-destructive"
              >
                <Link2OffIcon className="size-4" />
                Desconectar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
