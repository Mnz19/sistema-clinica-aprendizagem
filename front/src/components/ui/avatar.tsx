import { cn } from "@/lib/utils"

/** Iniciais (primeiro + último nome) para o fallback do avatar. */
function iniciais(nome?: string) {
  if (!nome) return "--"
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ""
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase() || "--"
}

interface AvatarProps {
  nome?: string
  foto?: string | null
  className?: string
}

/** Avatar que mostra a foto de perfil ou, na ausência, as iniciais do nome. */
export function Avatar({ nome, foto, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {foto ? (
        <img
          src={foto}
          alt={nome ?? "Avatar"}
          className="size-full object-cover"
        />
      ) : (
        iniciais(nome)
      )}
    </span>
  )
}
