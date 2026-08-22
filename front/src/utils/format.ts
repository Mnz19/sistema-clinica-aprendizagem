/** Utilitários de formatação (datas, CPF, telefone) usados na interface. */

/** Formata uma data ISO (`YYYY-MM-DD`) para `DD/MM/AAAA`. */
export function formatarData(iso?: string | null): string {
  if (!iso) return "—"
  const [ano, mes, dia] = iso.slice(0, 10).split("-")
  if (!ano || !mes || !dia) return "—"
  return `${dia}/${mes}/${ano}`
}

/**
 * Formata um datetime ISO como `DD/MM/AAAA HH:MM` no fuso da clínica
 * (America/Belem), independentemente do fuso do navegador.
 */
export function formatarDataHora(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

/** Formata um CPF (só dígitos) como `000.000.000-00`. */
export function formatarCpf(cpf?: string | null): string {
  if (!cpf) return "—"
  const d = cpf.replace(/\D/g, "").padStart(11, "0").slice(0, 11)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Formata um telefone brasileiro (10 ou 11 dígitos). */
export function formatarTelefone(tel?: string | null): string {
  if (!tel) return "—"
  const d = tel.replace(/\D/g, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return tel
}

/** Formata um CEP (só dígitos) como `00000-000`. */
export function formatarCep(cep?: string | null): string {
  if (!cep) return "—"
  const d = cep.replace(/\D/g, "")
  if (d.length !== 8) return cep
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

/** Remove tudo que não é dígito. */
export function apenasDigitos(valor?: string | null): string {
  return (valor ?? "").replace(/\D/g, "")
}

/** Formata um valor numérico como moeda brasileira (`R$ 0,00`). */
export function formatarMoeda(valor?: number | null): string {
  if (valor == null) return "—"
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

/** Formata uma duração em minutos como `1h 30min` (ou `45min`). */
export function formatarDuracao(minutos?: number | null): string {
  if (minutos == null) return "—"
  const horas = Math.floor(minutos / 60)
  const restante = minutos % 60
  if (horas === 0) return `${restante}min`
  if (restante === 0) return `${horas}h`
  return `${horas}h ${restante}min`
}

/** Formata um horário `HH:mm` (ou `HH:mm:ss`) mantendo apenas horas e minutos. */
export function formatarHorario(hora?: string | null): string {
  if (!hora) return "—"
  return hora.slice(0, 5)
}

/**
 * Formata uma duração em segundos como cronômetro `HH:MM:SS` (ou `MM:SS` até 1h).
 * Usado pelo cronômetro do atendimento no prontuário.
 */
export function formatarCronometro(segundos?: number | null): string {
  if (segundos == null || segundos < 0) return "00:00"
  const total = Math.floor(segundos)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
