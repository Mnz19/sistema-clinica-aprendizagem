/** Página de gestão de usuários (equipe da clínica). */
import { useCallback, useEffect, useState } from "react"
import {
  PencilIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UserRoundXIcon,
  UserRoundCheckIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { mensagemDeErro } from "@/utils/apiError"
import { formatarData } from "@/utils/format"
import { useAuthStore } from "@/store/authStore"
import {
  desativarUsuario,
  listarUsuarios,
  reativarUsuario,
} from "@/services/usuarios"
import { PAPEIS, PAPEL_LABELS } from "@/types/auth"
import type { Papel, Usuario } from "@/types/auth"
import { PAPEIS_GESTORES } from "@/types/usuario"
import { UsuarioFormSheet } from "@/features/usuarios/components/UsuarioFormSheet"

function papelVariant(role: Papel) {
  return PAPEIS_GESTORES.includes(role) ? "default" : "secondary"
}

export default function UsuariosListPage() {
  const usuarioLogado = useAuthStore((s) => s.user)
  const [busca, setBusca] = useState("")
  const [papel, setPapel] = useState<string>("")
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [sheetAberto, setSheetAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Usuario | null>(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)
    listarUsuarios({ search: busca, papel })
      .then(setUsuarios)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false))
  }, [busca, papel])

  useEffect(() => {
    const timer = setTimeout(carregar, 300)
    return () => clearTimeout(timer)
  }, [carregar])

  function abrirNovo() {
    setEmEdicao(null)
    setSheetAberto(true)
  }

  function abrirEdicao(u: Usuario) {
    setEmEdicao(u)
    setSheetAberto(true)
  }

  async function alternarAtivo(u: Usuario) {
    try {
      if (u.is_active) await desativarUsuario(u.id)
      else await reativarUsuario(u.id)
      carregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
            <ShieldCheckIcon className="size-5" /> Usuários e permissões
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a equipe e o papel de acesso de cada usuário.
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <UserPlusIcon className="size-4" /> Novo usuário
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="pl-8"
          />
        </div>
        <div className="w-44">
          <Select value={papel} onChange={(e) => setPapel(e.target.value)}>
            <option value="">Todos os papéis</option>
            {Object.values(PAPEIS).map((p) => (
              <option key={p} value={p}>
                {PAPEL_LABELS[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">E-mail</th>
              <th className="px-4 py-2.5 font-medium">Papel</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                Último acesso
              </th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </p>
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar nome={u.nome} foto={u.foto} className="size-7" />
                      <span className="font-medium text-foreground">{u.nome}</span>
                      {usuarioLogado?.id === u.id && (
                        <span className="text-xs text-muted-foreground">(você)</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.papeis?.length ? u.papeis : [u.role]).map((p) => (
                        <Badge key={p} variant={papelVariant(p)}>
                          {PAPEL_LABELS[p]}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {u.last_login ? formatarData(u.last_login) : "Nunca"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => abrirEdicao(u)}
                        title="Editar"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      {usuarioLogado?.id !== u.id && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title={u.is_active ? "Desativar" : "Reativar"}
                          >
                            {u.is_active ? (
                              <UserRoundXIcon className="size-4" />
                            ) : (
                              <UserRoundCheckIcon className="size-4" />
                            )}
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {u.is_active ? "Desativar usuário?" : "Reativar usuário?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.is_active
                                  ? `${u.nome} perderá o acesso ao sistema, mas o histórico é preservado.`
                                  : `${u.nome} voltará a ter acesso ao sistema.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => alternarAtivo(u)}>
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <UsuarioFormSheet
        key={`${emEdicao?.id ?? "novo"}-${sheetAberto}`}
        aberto={sheetAberto}
        usuario={emEdicao}
        onFechar={() => setSheetAberto(false)}
        onSalvo={() => {
          setSheetAberto(false)
          carregar()
        }}
      />
    </div>
  )
}
