"""API somente-leitura da trilha de auditoria (aba "Logs").

Expõe ``auditlog.models.LogEntry`` em ``/api/logs/``, restrito à DIREÇÃO ou ao
superusuário, com filtros (usuário, tabela, id do objeto, ação, datas), busca e
paginação. A captura dos eventos é feita pelo django-auditlog (ver settings).
"""
from auditlog.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.accounts.permissions import IsDirecaoOuSuperuser
from apps.auditoria.filters import LogEntryFilter
from apps.auditoria.serializers import LogEntrySerializer


class LogsPagination(PageNumberPagination):
    """
    Paginação exclusiva da trilha de auditoria (tabela de alto volume).

    Fica só nesta view de propósito: o projeto não define paginação global e as
    demais listagens (usuários, pacientes) devolvem array puro — não devem mudar.
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


@extend_schema_view(
    list=extend_schema(
        summary="Lista a trilha de auditoria (create/update/delete de todos os models)."
    ),
    retrieve=extend_schema(summary="Detalha um evento de auditoria."),
)
class LogEntryViewSet(viewsets.ReadOnlyModelViewSet):
    """Consulta da trilha de alterações. Somente leitura, DIREÇÃO/superusuário."""

    queryset = LogEntry.objects.select_related("actor", "content_type").all()
    serializer_class = LogEntrySerializer
    permission_classes = [IsDirecaoOuSuperuser]
    pagination_class = LogsPagination
    filterset_class = LogEntryFilter
    search_fields = ["object_repr", "actor__nome", "actor__email"]
    ordering_fields = ["timestamp"]
    ordering = ["-timestamp"]

    @extend_schema(responses={200: None})
    @action(detail=False, methods=["get"])
    def modelos(self, request):
        """
        Tabelas (models) que possuem registros na trilha.

        Usada para popular o filtro de "tabela" no front, sem listar models que
        nunca sofreram alteração.
        """
        ids = LogEntry.objects.values_list("content_type", flat=True).distinct()
        content_types = ContentType.objects.filter(id__in=ids).order_by("model")
        dados = [{"tabela": ct.model, "tabela_label": ct.name} for ct in content_types]
        return Response(dados)
