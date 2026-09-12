"""
Relatório de Produção — faturamento da clínica por atendimento.

Público: DIREÇÃO e FINANCEIRO. Opera sobre o ledger ``Producao``, que é um
snapshot do ``valor_clinica`` no momento em que o agendamento passou a gerar
cobrança — atendimento realizado, falta ou cancelamento tardio (< 8h).

Usar o ledger em vez de recalcular a partir do ``Servico`` é intencional: o
valor do serviço pode ter mudado depois, e o relatório precisa reproduzir o que
foi efetivamente cobrado na época.

O relatório também informa se o atendimento já teve baixa de pagamento, para o
fechamento cruzar produção × recebimento.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import QuerySet, Sum

from apps.accounts.models import Usuario
from apps.clinica.models import Producao
from apps.clinica.signals import (
    MOTIVO_CANCELAMENTO_TARDIO,
    MOTIVO_FALTA,
    MOTIVO_REALIZADO,
)
from apps.pacientes.models import Paciente
from apps.relatorios.comum import rotulo_registro
from apps.relatorios.excel import (
    FORMATO_DATA,
    FORMATO_MOEDA,
    Coluna,
    Relatorio,
)
from apps.relatorios.filtros import (
    FiltrosAplicados,
    ler_id,
    ler_multipla_escolha,
    ler_periodo,
)

TITULO = "Relatório de Produção"
NOME_ARQUIVO = "relatorio_producao"

#: Motivos que o ledger grava (ver ``apps.clinica.signals``). Expostos aqui para
#: o filtro validar a entrada e o frontend montar o seletor.
MOTIVOS = (MOTIVO_REALIZADO, MOTIVO_FALTA, MOTIVO_CANCELAMENTO_TARDIO)

COLUNAS: tuple[Coluna, ...] = (
    Coluna("data", "Data", largura=12, formato=FORMATO_DATA),
    Coluna("paciente", "Paciente", largura=32),
    Coluna("profissional", "Profissional", largura=28),
    Coluna("servico_nome", "Serviço", largura=28),
    Coluna("motivo", "Motivo da cobrança", largura=24),
    Coluna("valor", "Valor produzido", largura=16, formato=FORMATO_MOEDA, somar=True),
    Coluna("pagamento_situacao", "Pagamento", largura=14),
    Coluna("valor_pago", "Valor pago", largura=14, formato=FORMATO_MOEDA, somar=True),
    Coluna("forma_pagamento", "Forma de pagamento", largura=20),
    Coluna("status_agendamento", "Status da consulta", largura=18),
)


def _ler_filtros(params) -> FiltrosAplicados:
    """Valida os filtros do relatório e monta a descrição legível."""
    filtros = FiltrosAplicados()
    ler_periodo(params, filtros)

    motivos = ler_multipla_escolha(params, "motivo", MOTIVOS)
    if motivos:
        filtros.registrar("motivo", motivos, f"Motivo: {', '.join(motivos)}")

    if profissional := ler_id(params, "profissional"):
        filtros.registrar(
            "profissional",
            profissional,
            rotulo_registro(Usuario, profissional, "Profissional"),
        )
    if paciente := ler_id(params, "paciente"):
        filtros.registrar(
            "paciente",
            paciente,
            rotulo_registro(Paciente, paciente, "Paciente", "nome_completo"),
        )

    return filtros


def _montar_queryset(filtros: FiltrosAplicados) -> QuerySet[Producao]:
    """Aplica os filtros validados e pré-carrega os vínculos usados nas colunas."""
    # ``agendamento__pagamento`` no select_related evita uma query por linha ao
    # consultar a baixa de pagamento (OneToOne reverso).
    qs = Producao.objects.select_related(
        "paciente", "profissional", "agendamento", "agendamento__pagamento"
    ).all()

    if (inicio := filtros.get("data_inicio")) is not None:
        qs = qs.filter(data__gte=inicio)
    if (fim := filtros.get("data_fim")) is not None:
        qs = qs.filter(data__lte=fim)
    if motivos := filtros.get("motivo"):
        qs = qs.filter(motivo__in=motivos)
    if profissional := filtros.get("profissional"):
        qs = qs.filter(profissional_id=profissional)
    if paciente := filtros.get("paciente"):
        qs = qs.filter(paciente_id=paciente)

    return qs.order_by("data", "paciente__nome_completo")


def _linha(producao: Producao) -> dict[str, Any]:
    """Converte um lançamento de produção na linha do relatório."""
    # ``pagamento`` é OneToOne reverso: ausente significa "sem baixa registrada".
    pagamento = getattr(producao.agendamento, "pagamento", None)

    return {
        "data": producao.data,
        "paciente": producao.paciente.nome_completo,
        "profissional": producao.profissional.nome,
        "servico_nome": producao.servico_nome,
        "motivo": producao.motivo,
        "valor": producao.valor,
        "pagamento_situacao": "Pago" if pagamento else "Em aberto",
        "valor_pago": pagamento.valor_pago if pagamento else None,
        "forma_pagamento": (
            pagamento.get_forma_pagamento_display() if pagamento else ""
        ),
        "status_agendamento": producao.agendamento.get_status_display(),
    }


def _totais(queryset: QuerySet[Producao]) -> dict[str, Any]:
    """Soma o produzido e o efetivamente pago no recorte filtrado."""
    agregado = queryset.aggregate(
        total_produzido=Sum("valor"),
        total_pago=Sum("agendamento__pagamento__valor_pago"),
    )
    return {
        "valor": agregado["total_produzido"] or Decimal("0.00"),
        "valor_pago": agregado["total_pago"] or Decimal("0.00"),
    }


def montar(params) -> Relatorio:
    """Monta o relatório de produção a partir dos filtros da query string."""
    filtros = _ler_filtros(params)
    producoes = _montar_queryset(filtros)
    return Relatorio(
        titulo=TITULO,
        nome_arquivo=NOME_ARQUIVO,
        colunas=COLUNAS,
        linhas=[_linha(producao) for producao in producoes],
        filtros_descricao=filtros.descricao,
        totais=_totais(producoes),
    )
