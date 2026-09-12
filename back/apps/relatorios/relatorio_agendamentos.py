"""
Relatório de Agendamentos — agenda consolidada com desfecho de cada consulta.

Público: DIREÇÃO, SUPERVISÃO e RECEPÇÃO. Responde "o que foi agendado no
período, para quem, com quem, e no que deu" — incluindo faltas e desmarcações
com o respectivo parecer, que é o que a recepção precisa para cobrar reposição.

O filtro de status é multi-valor (``?status=ATENDIDO&status=FALTA``), espelhando
o comportamento que ``RelatorioProducaoViewSet`` já expõe hoje.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from django.db.models import QuerySet

from apps.accounts.models import Usuario
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento
from apps.pacientes.models import Paciente
from apps.relatorios.comum import rotulo_registro
from apps.relatorios.excel import (
    FORMATO_DATA,
    FORMATO_INTEIRO,
    Coluna,
    Relatorio,
)
from apps.relatorios.filtros import (
    FiltrosAplicados,
    ler_id,
    ler_multipla_escolha,
    ler_periodo,
)

TITULO = "Relatório de Agendamentos"
NOME_ARQUIVO = "relatorio_agendamentos"

COLUNAS: tuple[Coluna, ...] = (
    Coluna("data", "Data", largura=12, formato=FORMATO_DATA),
    Coluna("dia_semana", "Dia da semana", largura=15),
    Coluna("horario_inicio", "Início", largura=9),
    Coluna("horario_fim", "Fim", largura=9),
    Coluna("paciente", "Paciente", largura=32),
    Coluna("paciente_telefone", "Telefone", largura=16),
    Coluna("profissional", "Profissional", largura=28),
    Coluna("servico", "Serviço", largura=28),
    Coluna("sala", "Sala", largura=18),
    Coluna("status", "Status", largura=16),
    Coluna("parecer_status", "Parecer / justificativa", largura=40),
    Coluna("recorrencia", "Recorrência", largura=16),
    Coluna("duracao_minutos", "Duração (min)", largura=13, formato=FORMATO_INTEIRO),
    Coluna("observacoes", "Observações", largura=36),
    Coluna("criado_em", "Agendado em", largura=18, formato="DD/MM/YYYY HH:MM"),
)

_DIAS_SEMANA = (
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo",
)


def _ler_filtros(params) -> FiltrosAplicados:
    """Valida os filtros do relatório e monta a descrição legível."""
    filtros = FiltrosAplicados()
    ler_periodo(params, filtros)

    status = ler_multipla_escolha(params, "status", StatusAgendamento.values)
    if status:
        rotulos = [StatusAgendamento(valor).label for valor in status]
        filtros.registrar("status", status, f"Status: {', '.join(rotulos)}")

    for chave, modelo, prefixo in (
        ("profissional", Usuario, "Profissional"),
        ("paciente", Paciente, "Paciente"),
        ("sala", Sala, "Sala"),
        ("servico", Servico, "Serviço"),
    ):
        if valor := ler_id(params, chave):
            campo = "nome_completo" if modelo is Paciente else "nome"
            filtros.registrar(
                chave, valor, rotulo_registro(modelo, valor, prefixo, campo)
            )

    return filtros


def _montar_queryset(filtros: FiltrosAplicados) -> QuerySet[Agendamento]:
    """Aplica os filtros validados e pré-carrega os vínculos usados nas colunas."""
    qs = Agendamento.objects.select_related(
        "paciente", "profissional", "sala", "servico", "serie"
    ).all()

    if (inicio := filtros.get("data_inicio")) is not None:
        qs = qs.filter(data__gte=inicio)
    if (fim := filtros.get("data_fim")) is not None:
        qs = qs.filter(data__lte=fim)
    if status := filtros.get("status"):
        qs = qs.filter(status__in=status)
    for chave, campo in (
        ("profissional", "profissional_id"),
        ("paciente", "paciente_id"),
        ("sala", "sala_id"),
        ("servico", "servico_id"),
    ):
        if valor := filtros.get(chave):
            qs = qs.filter(**{campo: valor})

    return qs.order_by("data", "horario_inicio")


def _recorrencia(agendamento: Agendamento) -> str:
    """Descreve a série recorrente do agendamento, se houver."""
    if not agendamento.serie:
        return "Avulso"
    numero = agendamento.numero_na_serie
    rotulo = agendamento.serie.get_frequencia_display()
    return f"{rotulo} ({numero}ª)" if numero else rotulo


def _duracao_minutos(agendamento: Agendamento) -> int:
    """Duração agendada da consulta, em minutos."""
    inicio = datetime.combine(agendamento.data, agendamento.horario_inicio)
    fim = datetime.combine(agendamento.data, agendamento.horario_fim)
    return int((fim - inicio).total_seconds() // 60)


def _linha(agendamento: Agendamento) -> dict[str, Any]:
    """Converte um agendamento na linha do relatório."""
    return {
        "data": agendamento.data,
        "dia_semana": _DIAS_SEMANA[agendamento.data.weekday()],
        "horario_inicio": agendamento.horario_inicio.strftime("%H:%M"),
        "horario_fim": agendamento.horario_fim.strftime("%H:%M"),
        "paciente": agendamento.paciente.nome_completo,
        "paciente_telefone": agendamento.paciente.telefone,
        "profissional": agendamento.profissional.nome,
        "servico": agendamento.servico.nome,
        "sala": agendamento.sala.nome,
        "status": agendamento.get_status_display(),
        "parecer_status": agendamento.parecer_status or "",
        "recorrencia": _recorrencia(agendamento),
        "duracao_minutos": _duracao_minutos(agendamento),
        "observacoes": agendamento.observacoes or "",
        "criado_em": agendamento.criado_em,
    }


def montar(params) -> Relatorio:
    """Monta o relatório de agendamentos a partir dos filtros da query string."""
    filtros = _ler_filtros(params)
    agendamentos = _montar_queryset(filtros)
    return Relatorio(
        titulo=TITULO,
        nome_arquivo=NOME_ARQUIVO,
        colunas=COLUNAS,
        linhas=[_linha(agendamento) for agendamento in agendamentos],
        filtros_descricao=filtros.descricao,
    )
