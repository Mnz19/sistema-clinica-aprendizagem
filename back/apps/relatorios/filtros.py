"""
Leitura e validação dos filtros dos relatórios (fronteira da API).

Todo parâmetro vem da query string, então é texto não confiável: datas, ids e
valores de enum são validados aqui e qualquer coisa inválida vira
``ValidationError`` (HTTP 400) com mensagem em português — nunca um 500 nem um
filtro silenciosamente ignorado.

``FiltrosAplicados`` guarda, além dos valores, os rótulos legíveis do que foi
aplicado: é o que aparece no topo da planilha para que a exportação seja
auditável meses depois.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Sequence

from rest_framework.exceptions import ValidationError

_FORMATO_DATA_ISO = "%Y-%m-%d"


@dataclass
class FiltrosAplicados:
    """Valores validados + descrição legível dos filtros aplicados."""

    valores: dict[str, Any] = field(default_factory=dict)
    rotulos: list[str] = field(default_factory=list)

    def get(self, chave: str, padrao: Any = None) -> Any:
        return self.valores.get(chave, padrao)

    def registrar(self, chave: str, valor: Any, rotulo: str | None = None) -> None:
        """Guarda o valor e, se informado, o rótulo legível correspondente."""
        self.valores[chave] = valor
        if rotulo:
            self.rotulos.append(rotulo)

    @property
    def descricao(self) -> str:
        """Linha de filtros exibida no cabeçalho da planilha."""
        return " · ".join(self.rotulos)


def ler_data(params, nome: str) -> date | None:
    """Lê uma data ``YYYY-MM-DD`` da query string; ``None`` se ausente/vazia."""
    bruto = (params.get(nome) or "").strip()
    if not bruto:
        return None
    try:
        return datetime.strptime(bruto, _FORMATO_DATA_ISO).date()
    except ValueError:
        raise ValidationError(
            {nome: f"Data inválida: '{bruto}'. Use o formato AAAA-MM-DD."}
        )


def ler_id(params, nome: str) -> int | None:
    """Lê um id inteiro positivo da query string; ``None`` se ausente/vazio."""
    bruto = (params.get(nome) or "").strip()
    if not bruto:
        return None
    try:
        valor = int(bruto)
    except ValueError:
        raise ValidationError({nome: f"Identificador inválido: '{bruto}'."})
    if valor <= 0:
        raise ValidationError({nome: "O identificador deve ser positivo."})
    return valor


def ler_booleano(params, nome: str) -> bool | None:
    """
    Lê um booleano tolerante (``true/false``, ``1/0``, ``sim/nao``).

    Devolve ``None`` quando ausente — que significa "não filtrar por isso",
    diferente de ``False`` ("filtrar pelos inativos").
    """
    bruto = (params.get(nome) or "").strip().lower()
    if not bruto:
        return None
    if bruto in {"true", "1", "sim"}:
        return True
    if bruto in {"false", "0", "nao", "não"}:
        return False
    raise ValidationError({nome: f"Valor booleano inválido: '{bruto}'."})


def ler_texto(params, nome: str) -> str:
    """Lê um texto livre (busca), já sem espaços nas pontas."""
    return (params.get(nome) or "").strip()


def ler_multipla_escolha(
    params, nome: str, validos: Sequence[str]
) -> list[str]:
    """
    Lê um parâmetro multi-valor (``?status=A&status=B``) validado contra ``validos``.

    Aceita também valores separados por vírgula (``?status=A,B``), porque é o
    formato que o axios produz ao serializar um array simples.
    """
    brutos: list[str] = []
    for item in params.getlist(nome):
        brutos.extend(parte.strip() for parte in item.split(",") if parte.strip())

    invalidos = [item for item in brutos if item not in validos]
    if invalidos:
        raise ValidationError(
            {
                nome: (
                    f"Valores inválidos: {', '.join(invalidos)}. "
                    f"Aceitos: {', '.join(validos)}."
                )
            }
        )
    # Remove duplicatas preservando a ordem de chegada.
    return list(dict.fromkeys(brutos))


def ler_periodo(params, filtros: FiltrosAplicados) -> tuple[date | None, date | None]:
    """
    Lê ``data_inicio``/``data_fim``, valida a ordem e registra o rótulo do período.

    Compartilhado pelos quatro relatórios: o período é o filtro principal de
    todos eles.
    """
    inicio = ler_data(params, "data_inicio")
    fim = ler_data(params, "data_fim")

    if inicio and fim and inicio > fim:
        raise ValidationError(
            {"data_inicio": "A data inicial não pode ser posterior à data final."}
        )

    filtros.valores["data_inicio"] = inicio
    filtros.valores["data_fim"] = fim

    if inicio and fim:
        filtros.rotulos.append(f"Período: {inicio:%d/%m/%Y} a {fim:%d/%m/%Y}")
    elif inicio:
        filtros.rotulos.append(f"A partir de {inicio:%d/%m/%Y}")
    elif fim:
        filtros.rotulos.append(f"Até {fim:%d/%m/%Y}")

    return inicio, fim
