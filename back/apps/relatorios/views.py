"""
Views da aba de Relatórios.

Cada relatório é uma única view que atende dois formatos a partir do **mesmo**
queryset filtrado:

- ``GET /api/relatorios/<nome>/``              → JSON (prévia na tela)
- ``GET /api/relatorios/<nome>/?formato=xlsx`` → download da planilha

Servir os dois do mesmo lugar é o que garante que a planilha baixada seja
exatamente o que a tela mostrou: um só ponto de filtragem, um só ponto de
permissão.

O acesso é decidido só pelo papel (ver ``permissions.py``): nenhum relatório
desta aba é aberto ao papel PROFISSIONAL, então não há recorte "apenas os
próprios atendimentos" aqui — quem tem acesso vê a clínica inteira.
"""
from __future__ import annotations

from typing import Any, Callable

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.relatorios import (
    relatorio_agendamentos,
    relatorio_pacientes,
    relatorio_producao,
    relatorio_repasse,
)
from apps.relatorios.excel import (
    MAX_LINHAS_RELATORIO,
    Relatorio,
    gerar_planilha,
    serializar_colunas,
)
from apps.relatorios.permissions import (
    PodeVerRelatorioFinanceiro,
    PodeVerRelatorioOperacional,
)
from apps.relatorios.serializers import RelatorioRespostaSerializer

FORMATO_XLSX = "xlsx"

_PARAMETROS_COMUNS = [
    OpenApiParameter(
        "formato",
        str,
        description="`xlsx` baixa a planilha; omitido devolve JSON.",
        enum=[FORMATO_XLSX, "json"],
    ),
    OpenApiParameter("data_inicio", str, description="Início do período (AAAA-MM-DD)."),
    OpenApiParameter("data_fim", str, description="Fim do período (AAAA-MM-DD)."),
]


def _resposta_json(relatorio: Relatorio) -> Response:
    """Serializa o relatório para a prévia na tela."""
    return Response(
        {
            "titulo": relatorio.titulo,
            "colunas": serializar_colunas(relatorio.colunas),
            "linhas": relatorio.linhas,
            "totais": relatorio.totais,
            "total_registros": relatorio.total_registros,
            "filtros_descricao": relatorio.filtros_descricao,
        }
    )


class RelatorioBaseView(APIView):
    """
    Base das views de relatório: monta, aplica o isolamento e responde.

    Subclasses declaram ``permission_classes`` e ``montar_relatorio``.
    """

    #: Função ``(params) -> Relatorio`` do módulo do relatório.
    montar_relatorio: Callable[[Any], Relatorio]

    def get(self, request: Request) -> Response:
        params = request.query_params
        relatorio = self.montar_relatorio(params)

        if relatorio.total_registros > MAX_LINHAS_RELATORIO:
            raise ValidationError(
                {
                    "detail": (
                        f"O recorte selecionado tem {relatorio.total_registros} "
                        f"registros, acima do limite de {MAX_LINHAS_RELATORIO} "
                        "por relatório. Reduza o período ou aplique mais filtros."
                    )
                }
            )

        if params.get("formato") == FORMATO_XLSX:
            return gerar_planilha(relatorio)
        return _resposta_json(relatorio)


@extend_schema(
    tags=["Relatórios"],
    responses={200: RelatorioRespostaSerializer},
    summary="Relatório de pacientes (dados cadastrais)",
    parameters=_PARAMETROS_COMUNS
    + [
        OpenApiParameter("ativo", bool, description="Filtra ativos/inativos."),
        OpenApiParameter(
            "cadastro_incompleto", bool, description="Filtra cadastros incompletos."
        ),
        OpenApiParameter("profissional", int, description="Id do profissional vinculado."),
        OpenApiParameter("estado", str, description="UF do endereço (ex.: PA)."),
        OpenApiParameter("cidade", str, description="Cidade (busca parcial)."),
        OpenApiParameter("busca", str, description="Nome do paciente (busca parcial)."),
    ],
)
class RelatorioPacientesView(RelatorioBaseView):
    """Dados cadastrais dos pacientes — DIREÇÃO, SUPERVISÃO e RECEPÇÃO."""

    permission_classes = [PodeVerRelatorioOperacional]
    montar_relatorio = staticmethod(relatorio_pacientes.montar)


@extend_schema(
    tags=["Relatórios"],
    responses={200: RelatorioRespostaSerializer},
    summary="Relatório de agendamentos",
    parameters=_PARAMETROS_COMUNS
    + [
        OpenApiParameter(
            "status",
            str,
            description="Status do agendamento; aceita múltiplos valores.",
            many=True,
        ),
        OpenApiParameter("profissional", int, description="Id do profissional."),
        OpenApiParameter("paciente", int, description="Id do paciente."),
        OpenApiParameter("sala", int, description="Id da sala."),
        OpenApiParameter("servico", int, description="Id do serviço."),
    ],
)
class RelatorioAgendamentosView(RelatorioBaseView):
    """Agenda consolidada — DIREÇÃO, SUPERVISÃO e RECEPÇÃO."""

    permission_classes = [PodeVerRelatorioOperacional]
    montar_relatorio = staticmethod(relatorio_agendamentos.montar)


@extend_schema(
    tags=["Relatórios"],
    responses={200: RelatorioRespostaSerializer},
    summary="Relatório de produção (faturamento)",
    parameters=_PARAMETROS_COMUNS
    + [
        OpenApiParameter(
            "motivo",
            str,
            description="Motivo da cobrança; aceita múltiplos valores.",
            many=True,
        ),
        OpenApiParameter("profissional", int, description="Id do profissional."),
        OpenApiParameter("paciente", int, description="Id do paciente."),
    ],
)
class RelatorioProducaoView(RelatorioBaseView):
    """Faturamento por atendimento — DIREÇÃO e FINANCEIRO."""

    permission_classes = [PodeVerRelatorioFinanceiro]
    montar_relatorio = staticmethod(relatorio_producao.montar)


@extend_schema(
    tags=["Relatórios"],
    responses={200: RelatorioRespostaSerializer},
    summary="Relatório de repasse ao profissional",
    parameters=_PARAMETROS_COMUNS
    + [
        OpenApiParameter("profissional", int, description="Id do profissional."),
        OpenApiParameter(
            "forma_pagamento",
            str,
            description="Forma de pagamento; aceita múltiplos valores.",
            many=True,
        ),
        OpenApiParameter(
            "agrupar",
            bool,
            description="`true` consolida uma linha por profissional.",
        ),
    ],
)
class RelatorioRepasseView(RelatorioBaseView):
    """Repasse devido por profissional — DIREÇÃO e FINANCEIRO."""

    permission_classes = [PodeVerRelatorioFinanceiro]
    montar_relatorio = staticmethod(relatorio_repasse.montar)
