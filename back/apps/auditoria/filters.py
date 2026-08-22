"""Filtros da trilha de auditoria (aba "Logs").

Pensados para a investigação pela Direção: por usuário que fez a alteração, tabela
alterada, id do objeto, tipo de ação e intervalo de datas.
"""
import django_filters as filters
from auditlog.models import LogEntry


class LogEntryFilter(filters.FilterSet):
    """FilterSet do ``LogEntry`` com nomes de query em português."""

    # Usuário (autor) que fez a alteração.
    usuario = filters.NumberFilter(field_name="actor")
    # Tabela alterada (nome do model, ex.: "paciente", "usuario").
    tabela = filters.CharFilter(field_name="content_type__model", lookup_expr="iexact")
    # Id do objeto alterado (object_pk é texto e cobre PK de qualquer tipo).
    objeto_id = filters.CharFilter(field_name="object_pk", lookup_expr="exact")
    # Ação: 0=criação, 1=edição, 2=exclusão, 3=acesso.
    acao = filters.NumberFilter(field_name="action")
    # Intervalo de datas (inclusive) sobre o momento da alteração.
    data_inicio = filters.DateFilter(field_name="timestamp", lookup_expr="date__gte")
    data_fim = filters.DateFilter(field_name="timestamp", lookup_expr="date__lte")

    class Meta:
        model = LogEntry
        fields = ["usuario", "tabela", "objeto_id", "acao", "data_inicio", "data_fim"]
