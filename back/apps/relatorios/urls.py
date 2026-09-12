"""
Rotas da aba de Relatórios.

``/api/relatorios/pacientes/``    → dados cadastrais (DIREÇÃO/SUPERVISÃO/RECEPÇÃO)
``/api/relatorios/agendamentos/`` → agenda consolidada (DIREÇÃO/SUPERVISÃO/RECEPÇÃO)
``/api/relatorios/producao/``     → faturamento (DIREÇÃO/FINANCEIRO)
``/api/relatorios/repasse/``      → repasse ao profissional (DIREÇÃO/FINANCEIRO)

Todas aceitam ``?formato=xlsx`` para baixar a planilha em vez do JSON.
"""
from django.urls import path

from apps.relatorios.views import (
    RelatorioAgendamentosView,
    RelatorioPacientesView,
    RelatorioProducaoView,
    RelatorioRepasseView,
)

urlpatterns = [
    path(
        "relatorios/pacientes/",
        RelatorioPacientesView.as_view(),
        name="relatorio-pacientes",
    ),
    path(
        "relatorios/agendamentos/",
        RelatorioAgendamentosView.as_view(),
        name="relatorio-agendamentos",
    ),
    path(
        "relatorios/producao/",
        RelatorioProducaoView.as_view(),
        name="relatorio-producao-xlsx",
    ),
    path(
        "relatorios/repasse/",
        RelatorioRepasseView.as_view(),
        name="relatorio-repasse",
    ),
]
