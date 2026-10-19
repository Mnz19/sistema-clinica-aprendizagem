/** Página pública "Esqueci minha senha": envia o link de redefinição por e-mail. */
import { useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftIcon, KeyRoundIcon, Loader2Icon, MailCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { mensagemDeErro } from "@/utils/apiError"
import { solicitarRedefinicaoSenha } from "@/services/auth"

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await solicitarRedefinicaoSenha(email.trim())
      setEnviado(true)
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-none shadow-2xl">
      <CardHeader className="items-center space-y-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-inner">
          {enviado ? <MailCheckIcon className="size-6" /> : <KeyRoundIcon className="size-6" />}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
            {enviado ? "Confira seu e-mail" : "Esqueceu a senha?"}
          </CardTitle>
          <CardDescription className="font-medium text-zinc-500">
            {enviado
              ? "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha."
              : "Informe seu e-mail e enviaremos um link para você criar uma nova senha."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {enviado ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              Enviamos para <strong className="text-zinc-900">{email.trim()}</strong>. O link
              vale por tempo limitado e pode ser usado uma única vez. Não chegou? Verifique a
              caixa de spam.
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEnviado(false)}
            >
              Usar outro e-mail
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {erro && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-700">E-mail corporativo</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@clinicadaaprendizagem.com.br"
                className="bg-zinc-50"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            <Button
              type="submit"
              disabled={enviando}
              className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {enviando && <Loader2Icon className="size-4 animate-spin" />}
              Enviar link de redefinição
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="mt-2 flex justify-center border-t border-zinc-100 pt-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeftIcon className="size-4" />
          Voltar para o login
        </Link>
      </CardFooter>
    </Card>
  )
}
