/**
 * Máscaras progressivas para campos de formulário (aplicadas no onChange).
 *
 * Retornam o valor já formatado conforme o usuário digita, limitando a
 * quantidade de dígitos. A máscara é apenas visual: o backend normaliza CPF,
 * telefone e CEP para dígitos, então o banco guarda sempre só números.
 */

function digitos(valor: string, max: number): string {
  return valor.replace(/\D/g, "").slice(0, max)
}

/** Máscara de CPF: `000.000.000-00`. */
export function maskCPF(valor: string): string {
  const d = digitos(valor, 11)
  let out = d
  if (d.length > 9) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  else if (d.length > 6) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  else if (d.length > 3) out = `${d.slice(0, 3)}.${d.slice(3)}`
  return out
}

/** Máscara de telefone: `(00) 0000-0000` ou `(00) 00000-0000`. */
export function maskTelefone(valor: string): string {
  const d = digitos(valor, 11)
  if (d.length === 0) return ""
  if (d.length < 3) return `(${d}`
  const ddd = d.slice(0, 2)
  const resto = d.slice(2)
  if (resto.length <= 4) return `(${ddd}) ${resto}`
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`
}

/** Máscara de CEP: `00000-000`. */
export function maskCEP(valor: string): string {
  const d = digitos(valor, 8)
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`
  return d
}
