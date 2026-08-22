"""Views do módulo fila de espera."""
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import Papel
from apps.accounts.permissions import tem_papel
from apps.clinica.serializers import AgendamentoSerializer
from apps.fila_espera.models import FilaEspera, StatusFila
from apps.fila_espera.serializers import FilaEsperaSerializer


class FilaEsperaViewSet(viewsets.ModelViewSet):
    """CRUD da fila de espera + actions converter/, candidatos/ e recusar/."""

    serializer_class = FilaEsperaSerializer
    permission_classes = [tem_papel(Papel.RECEPCAO, Papel.DIRECAO)]
    filterset_fields = ["status", "profissional", "especialidade"]
    ordering = ["criado_em"]

    def get_queryset(self):
        return FilaEspera.objects.select_related(
            "paciente", "profissional", "especialidade"
        ).all()

    @action(detail=False, methods=["get"], url_path="candidatos")
    def candidatos(self, request):
        """GET /api/fila-espera/candidatos/ — candidatos para preencher um horário vago.

        Retorna entradas ``AGUARDANDO`` em ordem FIFO compatíveis com o filtro:
        uma entrada casa com o ``profissional`` (ou ``especialidade``) informado ou
        quando não tem preferência (campo nulo — serve para qualquer prestador).
        """
        qs = self.get_queryset().filter(status=StatusFila.AGUARDANDO)

        profissional = request.query_params.get("profissional")
        if profissional:
            qs = qs.filter(Q(profissional_id=profissional) | Q(profissional__isnull=True))

        especialidade = request.query_params.get("especialidade")
        if especialidade:
            qs = qs.filter(Q(especialidade_id=especialidade) | Q(especialidade__isnull=True))

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="recusar")
    def recusar(self, request, pk=None):
        """POST /api/fila-espera/{id}/recusar/ — marca a entrada como RECUSADO."""
        entrada = self.get_object()

        if entrada.status != StatusFila.AGUARDANDO:
            return Response(
                {"detail": f"Entrada já está com status '{entrada.status}' e não pode ser recusada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entrada.status = StatusFila.RECUSADO
        entrada.save(update_fields=["status", "atualizado_em"])
        return Response(self.get_serializer(entrada).data)

    @action(detail=True, methods=["post"], url_path="converter")
    def converter(self, request, pk=None):
        """POST /api/fila-espera/{id}/converter/ — converte em agendamento."""
        entrada = self.get_object()

        if entrada.status != StatusFila.AGUARDANDO:
            return Response(
                {"detail": f"Entrada já está com status '{entrada.status}' e não pode ser convertida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AgendamentoSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        agendamento = serializer.save()

        entrada.status = StatusFila.CONVERTIDO
        entrada.agendamento_resultado = agendamento
        entrada.save(update_fields=["status", "agendamento_resultado", "atualizado_em"])

        return Response(
            AgendamentoSerializer(agendamento, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
