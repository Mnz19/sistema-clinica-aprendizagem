import { useState } from "react"
import type { FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ActivityIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

export default function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const { entrar, carregando, erro } = useAuth()

    const [email, setEmail] = useState("")
    const [senha, setSenha] = useState("")

    // Rota de origem (definida pelo ProtectedRoute) ou home por padrão.
    const origem =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/"

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        const ok = await entrar({ email, password: senha })
        if (ok) {
            navigate(origem, { replace: true })
        }
    }

    return (
        <Card className="w-full max-w-md border-none shadow-2xl">
            <CardHeader className="items-center space-y-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-inner">
                    <ActivityIcon className="size-6" />
                </div>
                <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
                        Acesso Restrito
                    </CardTitle>
                    <CardDescription className="font-medium text-zinc-500">
                        Clínica da Aprendizagem
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent>
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
                            placeholder="recepcao@clinicadaaprendizagem.com"
                            className="bg-zinc-50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={carregando}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-zinc-700">Senha</Label>
                            <a href="#" className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
                                Esqueceu a senha?
                            </a>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="bg-zinc-50"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            disabled={carregando}
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={carregando}
                        className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
                    >
                        {carregando ? (
                            <>
                                <Loader2Icon className="size-4 animate-spin" />
                                Entrando...
                            </>
                        ) : (
                            "Entrar no sistema"
                        )}
                    </Button>
                </form>
            </CardContent>

            <CardFooter className="mt-2 flex justify-center border-t border-zinc-100 pt-4">
                <p className="text-center text-xs text-zinc-400">
                    Ambiente seguro e monitorado.<br/>
                    Acesso exclusivo para colaboradores da clínica.
                </p>
            </CardFooter>
        </Card>
    )
}
