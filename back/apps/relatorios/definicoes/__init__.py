"""Registro dos relatórios disponíveis, indexados pelo ``slug`` da URL."""
from apps.relatorios.definicoes.agendamentos import RelatorioAgendamentos
from apps.relatorios.definicoes.base import RelatorioBase
from apps.relatorios.definicoes.pacientes import RelatorioPacientes
from apps.relatorios.definicoes.producao import RelatorioProducao
from apps.relatorios.definicoes.repasse import RelatorioRepasse

RELATORIOS: dict[str, RelatorioBase] = {
    relatorio.slug: relatorio
    for relatorio in (
        RelatorioPacientes(),
        RelatorioAgendamentos(),
        RelatorioProducao(),
        RelatorioRepasse(),
    )
}

__all__ = [
    "RELATORIOS",
    "RelatorioAgendamentos",
    "RelatorioBase",
    "RelatorioPacientes",
    "RelatorioProducao",
    "RelatorioRepasse",
]
