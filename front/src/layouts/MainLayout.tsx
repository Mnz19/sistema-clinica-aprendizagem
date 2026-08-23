import type { ReactNode } from "react"
import { Fragment, useEffect, useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import {
  MenuIcon,
  Building2Icon,
  CalendarIcon,
  CalendarDaysIcon,
  CalendarCheckIcon,
  CalendarOffIcon,
  ClipboardListIcon,
  ListChecksIcon,
  ChevronDownIcon,
  ClockIcon,
  DollarSignIcon,
  ChartColumnIcon,
  UsersIcon,
  FileTextIcon,
  ActivityIcon,
  ShieldCheckIcon,
  ScrollTextIcon,
  MessageCircleIcon,
  LogOutIcon,
  DoorOpenIcon,
  LayoutGridIcon,
  StethoscopeIcon,
  GraduationCapIcon,
  SettingsIcon
} from "lucide-react"

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

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Avatar } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/useAuth"

import { PAPEIS_GESTORES } from "@/types/usuario"
import { PAPEIS_PRONTUARIO, PAPEIS_CONFIG_PRONTUARIO } from "@/types/prontuario"
import { PAPEIS_CONFIG_WHATSAPP } from "@/types/whatsapp"
import { podeVerLogs, temPapel } from "@/types/auth"
import type { Papel } from "@/types/auth"

interface NavItem {
  label: string
  icon: typeof Building2Icon
  href: string
  papeis?: Papel[] // se definido, o item só aparece para esses papéis
  somenteSuperadmin?: boolean // só DIREÇÃO ou superusuário (trilha de auditoria)
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: Building2Icon, href: "/" },
  { label: "Ocupação", icon: LayoutGridIcon, href: "/ocupacao" },
  { label: "Pacientes", icon: UsersIcon, href: "/pacientes" },
  { label: "Produção", icon: DollarSignIcon, href: "/producao" },
  { label: "Relatórios", icon: ChartColumnIcon, href: "/relatorios" },
  { label: "Prontuários", icon: FileTextIcon, href: "/prontuarios", papeis: PAPEIS_PRONTUARIO },
]

const agendaSubItems: NavItem[] = [
  { label: "Calendário", icon: CalendarDaysIcon, href: "/agenda/calendario" },
  { label: "Agendamentos", icon: CalendarCheckIcon, href: "/agenda/agendamentos" },
  { label: "Fila de Espera", icon: ListChecksIcon, href: "/agenda/fila-espera" },
  { label: "Disponibilidades", icon: ClockIcon, href: "/agenda/disponibilidades" },
  { label: "Ausências", icon: CalendarOffIcon, href: "/agenda/ausencias" },
]

// Agrupados sob "Configurações" (submenu colapsável), preservando as restrições
// de papel de cada item.
const configuracoesSubItems: NavItem[] = [
  { label: "Usuários", icon: ShieldCheckIcon, href: "/usuarios", papeis: PAPEIS_GESTORES },
  { label: "Prontuário", icon: ClipboardListIcon, href: "/prontuarios/configuracao", papeis: PAPEIS_CONFIG_PRONTUARIO },
  { label: "Serviços", icon: StethoscopeIcon, href: "/servicos" },
  { label: "Especialidades", icon: GraduationCapIcon, href: "/especialidades", papeis: PAPEIS_GESTORES },
  { label: "Salas", icon: DoorOpenIcon, href: "/salas" },
  { label: "Confirmações", icon: MessageCircleIcon, href: "/confirmacoes", papeis: PAPEIS_CONFIG_WHATSAPP },
  { label: "Logs", icon: ScrollTextIcon, href: "/logs", somenteSuperadmin: true },
]

function NavContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, sair } = useAuth()

  // Itens visíveis conforme o acesso do usuário (itens sem restrição são gerais).
  const podeVerItem = (item: NavItem) => {
    if (item.somenteSuperadmin) return podeVerLogs(user)
    if (item.papeis) return temPapel(user, ...item.papeis)
    return true
  }
  const itensVisiveis = navItems.filter(podeVerItem)
  const agendaAtiva = location.pathname.startsWith("/agenda")
  const [agendaAberta, setAgendaAberta] = useState(false)
  const submenuExpandido = agendaAberta || agendaAtiva

  const configVisiveis = configuracoesSubItems.filter(podeVerItem)
  const configuracoesAtiva = configVisiveis.some((item) =>
    location.pathname.startsWith(item.href)
  )
  const [configAberta, setConfigAberta] = useState(false)
  const configExpandido = configAberta || configuracoesAtiva

  const handleLogout = async () => {
    await sair()
    navigate("/login", { replace: true })
  }

  return (
      <>
        {/* Marca / Logo */}
        <SidebarHeader className="px-4 py-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <ActivityIcon className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-semibold tracking-tight">Clínica da Aprendizagem</span>
              <span className="text-xs text-muted-foreground">Corem Software Solutions</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider">
              Menu Principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {itensVisiveis.map((item) => (
                  <Fragment key={item.href}>
                    <SidebarMenuItem>
                      <NavLink to={item.href} className="block">
                        {({ isActive }) => (
                          <SidebarMenuButton
                            tooltip={item.label}
                            isActive={isActive}
                            className={isActive ? "font-medium text-zinc-900" : "text-zinc-500"}
                          >
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        )}
                      </NavLink>
                    </SidebarMenuItem>

                    {item.href === "/" && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          tooltip="Gestão de Agenda"
                          isActive={agendaAtiva}
                          onClick={() => setAgendaAberta((aberta) => !aberta)}
                          className={
                            agendaAtiva ? "font-medium text-zinc-900" : "text-zinc-500"
                          }
                        >
                          <CalendarIcon className="size-4" />
                          <span>Gestão de Agenda</span>
                          <ChevronDownIcon
                            className={cn(
                              "ml-auto size-4 transition-transform",
                              submenuExpandido && "rotate-180"
                            )}
                          />
                        </SidebarMenuButton>
                        {submenuExpandido && (
                          <SidebarMenuSub>
                            {agendaSubItems.map((sub) => (
                              <SidebarMenuSubItem key={sub.href}>
                                <NavLink to={sub.href} className="block">
                                  {({ isActive }) => (
                                    <SidebarMenuSubButton
                                      isActive={isActive}
                                      className={
                                        isActive ? "font-medium text-zinc-900" : "text-zinc-500"
                                      }
                                    >
                                      <sub.icon className="size-4" />
                                      <span>{sub.label}</span>
                                    </SidebarMenuSubButton>
                                  )}
                                </NavLink>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    )}
                  </Fragment>
                ))}

                {configVisiveis.length > 0 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Configurações"
                      isActive={configuracoesAtiva}
                      onClick={() => setConfigAberta((aberta) => !aberta)}
                      className={
                        configuracoesAtiva ? "font-medium text-zinc-900" : "text-zinc-500"
                      }
                    >
                      <SettingsIcon className="size-4" />
                      <span>Configurações</span>
                      <ChevronDownIcon
                        className={cn(
                          "ml-auto size-4 transition-transform",
                          configExpandido && "rotate-180"
                        )}
                      />
                    </SidebarMenuButton>
                    {configExpandido && (
                      <SidebarMenuSub>
                        {configVisiveis.map((sub) => (
                          <SidebarMenuSubItem key={sub.href}>
                            <NavLink to={sub.href} className="block">
                              {({ isActive }) => (
                                <SidebarMenuSubButton
                                  isActive={isActive}
                                  className={
                                    isActive ? "font-medium text-zinc-900" : "text-zinc-500"
                                  }
                                >
                                  <sub.icon className="size-4" />
                                  <span>{sub.label}</span>
                                </SidebarMenuSubButton>
                              )}
                            </NavLink>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Perfil do Usuário / Footer */}
        <SidebarFooter className="p-4">
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <button
              type="button"
              onClick={() => navigate("/perfil")}
              className="flex items-center gap-2 overflow-hidden rounded-md text-left transition-opacity hover:opacity-80"
              title="Meu perfil"
            >
              <Avatar nome={user?.nome} foto={user?.foto} className="bg-zinc-200 text-zinc-600" />
              <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-medium leading-tight text-zinc-900">
                {user?.nome ?? "Usuário"}
              </span>
                <span className="truncate text-xs leading-tight text-zinc-500">
                {user?.email ?? ""}
              </span>
              </div>
            </button>
            <AlertDialog>
              <AlertDialogTrigger className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600">
                <LogOutIcon className="size-4" />
                <span className="sr-only">Sair</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deseja sair do sistema?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você precisará fazer login novamente para acessar os dados e prontuários da clínica.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} className="bg-red-600 text-white hover:bg-red-700">
                    Sair do sistema
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SidebarFooter>
      </>
  )
}

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)

  // Fecha o menu mobile ao navegar para outra rota (sincroniza UI com a rota).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuAberto(false)
  }, [location.pathname])

  return (
      <SidebarProvider>
        {/* Desktop sidebar */}
        <Sidebar className="hidden md:flex border-r border-zinc-200 bg-zinc-50/50">
          <NavContent />
        </Sidebar>

        <SidebarInset className="flex min-w-0 flex-col bg-white">
          {/* Top header focado em Contexto e Ferramentas */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hidden md:inline-flex text-zinc-500 hover:text-zinc-900" />

              <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
                <SheetTrigger className="md:hidden flex size-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
                  <MenuIcon className="size-5" />
                  <span className="sr-only">Abrir menu</span>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 max-w-[85vw] border-r border-zinc-200 bg-zinc-50 p-0"
                >
                  <div className="flex h-full flex-col">
                    <NavContent />
                  </div>
                </SheetContent>
              </Sheet>

              <Separator orientation="vertical" className="h-5 hidden md:block bg-zinc-200" />

              {/* Espaço reservado para Breadcrumbs (ex: Dashboard > Agenda) */}
              <span className="text-sm font-medium text-zinc-900">
              Área de Trabalho
            </span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-4 md:p-6 md:pt-8">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
  )
}