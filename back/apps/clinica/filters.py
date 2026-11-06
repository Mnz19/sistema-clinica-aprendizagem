"""Filtros django-filter do módulo de clínica."""
import django_filters as filters

from apps.clinica.models import Agendamento, Producao


class ProducaoFilter(filters.FilterSet):
    """
    Filtros da listagem de produções (calendário / relatório financeiro).

    Query params: ``data__gte``, ``data__lte``, ``profissional``, ``paciente``.
    """

    data__gte = filters.DateFilter(field_name="data", lookup_expr="gte")
    data__lte = filters.DateFilter(field_name="data", lookup_expr="lte")

    class Meta:
        model = Producao
        fields = ["data__gte", "data__lte", "profissional", "paciente"]


class AgendamentoFilter(filters.FilterSet):
    """
    Filtros da listagem de agendamentos.

    Além dos campos exatos (``data``, ``profissional``, ``sala``, ``paciente``,
    ``status``), aceita ``data__gte``/``data__lte`` para o período personalizado
    da tela de agendamentos. Datas em ``YYYY-MM-DD``; valor inválido → 400.
    """

    data__gte = filters.DateFilter(field_name="data", lookup_expr="gte")
    data__lte = filters.DateFilter(field_name="data", lookup_expr="lte")

    class Meta:
        model = Agendamento
        fields = ["data", "data__gte", "data__lte", "profissional", "sala", "paciente", "status"]
