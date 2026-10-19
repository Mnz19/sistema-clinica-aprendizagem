/** Página pública de redefinição de senha (link recebido por e-mail com uid/token). */
import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { CheckCircle2Icon, KeyRoundIcon, Loader2Icon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { mensagemDeErro } from "@/utils/apiError"
import { redefinirSenha } from "@/services/auth"

export default function RedefinirSenhaPage() {
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
      await redefinirSenha({ uid, token, nova_senha: novaSenha })
      setSucesso(true)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-none shadow-2xl">
      <CardHeader className="items-center space-y-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-inner">
          {sucesso ? <CheckCircle2Icon className="size-6" /> : <KeyRoundIcon className="size-6" />}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
            {sucesso ? "Senha redefinida!" : "Crie uma nova senha"}
          </CardTitle>
          <CardDescription className="font-medium text-zinc-500">
            {sucesso
              ? "Por segurança, encerramos as sessões abertas. Entre com a nova senha."
              : "Escolha uma senha forte, que você ainda não tenha usado aqui."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {sucesso ? (
          <Button
            className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
            onClick={() => navigate("/login", { replace: true })}
          >
            Ir para o login
          </Button>
        ) : linkInvalido ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Link de redefinição inválido ou incompleto.
            </div>
            <Link
              to="/esqueci-senha"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Solicitar um novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {erro && (
              <div
                role="alert"
                className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <p>{erro}</p>
                <Link to="/esqueci-senha" className="font-medium underline">
                  Solicitar um novo link
                </Link>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="nova-senha" className="text-zinc-700">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                className="bg-zinc-50"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                disabled={salvando}
                autoComplete="new-password"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmacao" className="text-zinc-700">Confirmar nova senha</Label>
              <Input
                id="confirmacao"
                type="password"
                className="bg-zinc-50"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                disabled={salvando}
                autoComplete="new-password"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={salvando}
              className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {salvando && <Loader2Icon className="size-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
