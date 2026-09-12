"""
Relatório de Repasse — quanto a clínica deve a cada profissional.

Público: DIREÇÃO e FINANCEIRO.

**Base de cálculo:** ``PagamentoAgendamento.valor_repasse_calculado``, ou seja,
apenas atendimentos **com baixa de pagamento registrada**. É a mesma regra do
``repasse_mes`` no dashboard do terapeuta, então os números batem entre as duas
telas. Atendimentos ainda não pagos não entram — o repasse acompanha o
recebimento, não a produção.

O ``valor_repasse_calculado`` é um snapshot gravado no momento da baixa: editar
o ``Servico`` depois não reescreve o histórico de repasse já fechado.

Duas visões sobre o mesmo recorte:

- **Detalhado** (``?agrupar=false``, padrão): uma linha por atendimento pago.
- **Consolidado** (``?agrupar=true``): uma linha por profissional, com total de
  atendimentos, repasse e valor recebido pela clínica — a visão de fechamento.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Count, QuerySet, Sum

from apps.accounts.models import Usuario
from apps.financeiro.models import FormaPagamento, PagamentoAgendamento
from apps.relatorios.comum import formatar_conselho, rotulo_registro
from apps.relatorios.excel import (
    FORMATO_DATA,
    FORMATO_DATA_HORA,
    FORMATO_INTEIRO,
    FORMATO_MOEDA,
    Coluna,
    Relatorio,
)
from apps.relatorios.filtros import (
    FiltrosAplicados,
    ler_booleano,
    ler_id,
    ler_multipla_escolha,
    ler_periodo,
)

TITULO = "Relatório de Repasse"
NOME_ARQUIVO = "relatorio_repasse"

COLUNAS_DETALHADO: tuple[Coluna, ...] = (
    Coluna("data", "Data do atendimento", largura=17, formato=FORMATO_DATA),
    Coluna("profissional", "Profissional", largura=28),
    Coluna("conselho", "Registro", largura=16),
    Coluna("paciente", "Paciente", largura=30),
    Coluna("servico", "Serviço", largura=28),
    Coluna("valor_pago", "Valor pago", largura=14, formato=FORMATO_MOEDA, somar=True),
    Coluna(
        "valor_repasse",
        "Repasse ao profissional",
        largura=20,
        formato=FORMATO_MOEDA,
        somar=True,
    ),
    Coluna(
        "valor_clinica",
        "Retido pela clínica",
        largura=18,
        formato=FORMATO_MOEDA,
        somar=True,
    ),
    Coluna("forma_pagamento", "Forma de pagamento", largura=20),
    Coluna("registrado_por", "Baixa registrada por", largura=26),
    Coluna("registrado_em", "Baixa em", largura=18, formato=FORMATO_DATA_HORA),
)

COLUNAS_CONSOLIDADO: tuple[Coluna, ...] = (
    Coluna("profissional", "Profissional", largura=32),
    Coluna("conselho", "Registro", largura=16),
    Coluna(
        "atendimentos",
        "Atendimentos pagos",
        largura=17,
        formato=FORMATO_INTEIRO,
        somar=True,
    ),
    Coluna("valor_pago", "Total recebido", largura=16, formato=FORMATO_MOEDA, somar=True),
    Coluna(
        "valor_repasse",
        "Total a repassar",
        largura=17,
        formato=FORMATO_MOEDA,
        somar=True,
    ),
    Coluna(
        "valor_clinica",
        "Retido pela clínica",
        largura=18,
        formato=FORMATO_MOEDA,
        somar=True,
    ),
)


def _ler_filtros(params) -> FiltrosAplicados:
    """Valida os filtros do relatório e monta a descrição legível."""
    filtros = FiltrosAplicados()
    ler_periodo(params, filtros)

    if profissional := ler_id(params, "profissional"):
        filtros.registrar(
            "profissional",
            profissional,
            rotulo_registro(Usuario, profissional, "Profissional"),
        )

    formas = ler_multipla_escolha(params, "forma_pagamento", FormaPagamento.values)
    if formas:
        rotulos = [FormaPagamento(valor).label for valor in formas]
        filtros.registrar(
            "forma_pagamento", formas, f"Forma de pagamento: {', '.join(rotulos)}"
        )

    agrupar = ler_booleano(params, "agrupar") or False
    filtros.registrar(
        "agrupar", agrupar, "Visão: consolidada por profissional" if agrupar else None
    )

    return filtros


def _montar_queryset(filtros: FiltrosAplicados) -> QuerySet[PagamentoAgendamento]:
    """Aplica os filtros validados sobre as baixas de pagamento do período."""
    qs = PagamentoAgendamento.objects.select_related(
        "agendamento",
        "agendamento__paciente",
        "agendamento__profissional",
        "agendamento__servico",
        "registrado_por",
    ).all()

    # O período recorta pela data do **atendimento**, não pela data da baixa:
    # é assim que o fechamento mensal do profissional é calculado.
    if (inicio := filtros.get("data_inicio")) is not None:
        qs = qs.filter(agendamento__data__gte=inicio)
    if (fim := filtros.get("data_fim")) is not None:
        qs = qs.filter(agendamento__data__lte=fim)
    if profissional := filtros.get("profissional"):
        qs = qs.filter(agendamento__profissional_id=profissional)
    if formas := filtros.get("forma_pagamento"):
        qs = qs.filter(forma_pagamento__in=formas)

    return qs.order_by(
        "agendamento__profissional__nome", "agendamento__data"
    )


def _linha_detalhada(pagamento: PagamentoAgendamento) -> dict[str, Any]:
    """Converte uma baixa de pagamento na linha detalhada do relatório."""
    agendamento = pagamento.agendamento
    repasse = pagamento.valor_repasse_calculado

    return {
        "data": agendamento.data,
        "profissional": agendamento.profissional.nome,
        "conselho": agendamento.profissional.conselho or "",
        "paciente": agendamento.paciente.nome_completo,
        "servico": agendamento.servico.nome,
        "valor_pago": pagamento.valor_pago,
        "valor_repasse": repasse,
        # Retido = o que entrou menos o que sai para o profissional.
        "valor_clinica": pagamento.valor_pago - repasse,
        "forma_pagamento": pagamento.get_forma_pagamento_display(),
        "registrado_por": pagamento.registrado_por.nome,
        "registrado_em": pagamento.criado_em,
    }


def _linhas_consolidadas(
    queryset: QuerySet[PagamentoAgendamento],
) -> list[dict[str, Any]]:
    """Agrupa por profissional, somando atendimentos, recebido e repasse."""
    agregado = (
        queryset.values(
            "agendamento__profissional__nome",
            "agendamento__profissional__conselho_tipo",
            "agendamento__profissional__conselho_uf",
            "agendamento__profissional__conselho_numero",
        )
        .annotate(
            atendimentos=Count("id"),
            total_pago=Sum("valor_pago"),
            total_repasse=Sum("valor_repasse_calculado"),
        )
        .order_by("agendamento__profissional__nome")
    )

    linhas: list[dict[str, Any]] = []
    for item in agregado:
        pago = item["total_pago"] or Decimal("0.00")
        repasse = item["total_repasse"] or Decimal("0.00")
        tipo = item["agendamento__profissional__conselho_tipo"]
        uf = item["agendamento__profissional__conselho_uf"]
        numero = item["agendamento__profissional__conselho_numero"]
        linhas.append(
            {
                "profissional": item["agendamento__profissional__nome"],
                "conselho": formatar_conselho(tipo, uf, numero),
                "atendimentos": item["atendimentos"],
                "valor_pago": pago,
                "valor_repasse": repasse,
                "valor_clinica": pago - repasse,
            }
        )
    return linhas


def _totais(queryset: QuerySet[PagamentoAgendamento]) -> dict[str, Any]:
    """Totais do recorte — servem para as duas visões."""
    agregado = queryset.aggregate(
        atendimentos=Count("id"),
        total_pago=Sum("valor_pago"),
        total_repasse=Sum("valor_repasse_calculado"),
    )
    pago = agregado["total_pago"] or Decimal("0.00")
    repasse = agregado["total_repasse"] or Decimal("0.00")
    return {
        "atendimentos": agregado["atendimentos"] or 0,
        "valor_pago": pago,
        "valor_repasse": repasse,
        "valor_clinica": pago - repasse,
    }


def montar(params) -> Relatorio:
    """Monta o relatório de repasse (detalhado ou consolidado)."""
    filtros = _ler_filtros(params)
    pagamentos = _montar_queryset(filtros)
    agrupar = filtros.get("agrupar")

    if agrupar:
        colunas, linhas = COLUNAS_CONSOLIDADO, _linhas_consolidadas(pagamentos)
    else:
        colunas = COLUNAS_DETALHADO
        linhas = [_linha_detalhada(pagamento) for pagamento in pagamentos]

    return Relatorio(
        titulo=TITULO,
        nome_arquivo=(
            f"{NOME_ARQUIVO}_consolidado" if agrupar else NOME_ARQUIVO
        ),
        colunas=colunas,
        linhas=linhas,
        filtros_descricao=filtros.descricao,
        totais=_totais(pagamentos),
    )
