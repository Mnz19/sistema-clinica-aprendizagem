/**
 * Formatos numéricos do Excel que o backend declara em cada coluna.
 *
 * Espelham as constantes de `apps/relatorios/excel.py`. A tela usa esses
 * valores como dica de formatação/alinhamento — assim a prévia mostra moeda e
 * data do mesmo jeito que a planilha exportada.
 */
export const FORMATO_MOEDA = "R$ #,##0.00"
export const FORMATO_DATA = "DD/MM/YYYY"
export const FORMATO_DATA_HORA = "DD/MM/YYYY HH:MM"
export const FORMATO_INTEIRO = "#,##0"
