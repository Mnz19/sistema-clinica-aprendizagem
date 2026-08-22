/** Página pública de aceitação de convite: o convidado define a própria senha. */
import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2Icon, Loader2Icon, MailCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { mensagemDeErro } from "@/utils/apiError"
import { confirmarConvite } from "@/services/auth"

export default function ConvitePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const uid = params.get("uid") ?? ""
  const token = params.get("token") ?? ""

  const [novaSenha, setNovaSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const linkInvalido = !uid || !token

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (novaSenha !== confirmacao) {
      setErro("A confirmação não confere com a senha.")
      return
    }
    setSalvando(true)
    try {
      await confirmarConvite({ uid, token, nova_senha: novaSenha })
      setSucesso(true)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="items-center space-y-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-white">
            {sucesso ? (
              <CheckCircle2Icon className="size-6" />
            ) : (
              <MailCheckIcon className="size-6" />
            )}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">
              {sucesso ? "Tudo pronto!" : "Bem-vindo(a) à Clínica da Aprendizagem"}
            </CardTitle>
            <CardDescription>
              {sucesso
                ? "Sua senha foi definida. Você já pode entrar no sistema."
                : "Defina sua senha para ativar o acesso."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {sucesso ? (
            <Button className="w-full" onClick={() => navigate("/login")}>
              Ir para o login
            </Button>
          ) : linkInvalido ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Link de convite inválido. Solicite um novo convite à administração.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {erro && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {erro}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input
                  type="password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={salvando}>
                {salvando && <Loader2Icon className="size-4 animate-spin" />}
                Definir senha
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
