"""
Views do módulo de clínica.

- ``SalaViewSet``                        → /api/salas/
- ``ServicoViewSet``                     → /api/servicos/
- ``DisponibilidadeProfissionalViewSet`` → /api/disponibilidades/
- ``AusenciaProfissionalViewSet``        → /api/ausencias/
- ``AgendamentoViewSet``                 → /api/agendamentos/
- ``ProducaoViewSet``                    → /api/producoes/ (somente leitura)

Todos exigem autenticação JWT. Salas, serviços, disponibilidades e ausências
implementam exclusão lógica no ``destroy``; agendamentos usam o status
``CANCELADO`` para encerrar consultas sem apagar o histórico. Produções são
geradas automaticamente via signal e expostas apenas para consulta.
``DESMARCADO`` para encerrar consultas sem apagar o histórico.
"""
from auditlog.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Papel
from apps.accounts.permissions import tem_papel
from apps.auditoria.serializers import LogEntrySerializer
from apps.clinica.models import StatusAgendamento as SA
from apps.clinica.filters import ProducaoFilter
from apps.clinica.models import (
    Agendamento,
    AusenciaProfissional,
    DisponibilidadeProfissional,
    Producao,
    Sala,
    Servico,
)
from apps.clinica.serializers import (
    AgendamentoSerializer,
    AusenciaProfissionalSerializer,
    DisponibilidadeProfissionalSerializer,
    ProducaoSerializer,
    SalaOcupacaoSerializer,
    SalaSerializer,
    ServicoSerializer,
)
from apps.clinica.transitions import validar_transicao


class SalaViewSet(viewsets.ModelViewSet):
    """CRUD de salas de atendimento (exclusão lógica via ``ativa``)."""

    queryset = Sala.objects.all()
    serializer_class = SalaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["ativa"]
    search_fields = ["nome"]
    ordering_fields = ["nome", "criado_em", "atualizado_em"]
    ordering = ["nome"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.ativa = False
        instance.save(update_fields=["ativa", "atualizado_em"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="ocupacao")
    def ocupacao(self, request):
        """
        GET /api/salas/ocupacao/ — estado de ocupação de cada sala ativa.

        Uma sala está "em uso" quando existe um agendamento ``EM_ATENDIMENTO``
        (atendimento iniciado e ainda não finalizado). Base da visão de ocupação
        por sala.
        """
        salas = Sala.objects.filter(ativa=True).order_by("nome")

        # Um único query dos atendimentos em andamento, indexado por sala.
        em_andamento = (
            Agendamento.objects.filter(
                status=SA.EM_ATENDIMENTO,
                atendimento_iniciado_em__isnull=False,
                atendimento_finalizado_em__isnull=True,
            )
            .select_related("paciente", "profissional", "servico")
            .order_by("atendimento_iniciado_em")
        )
        por_sala: dict[int, Agendamento] = {}
        for ag in em_andamento:
            # Mantém o mais antigo por sala (não deveria haver mais de um).
            por_sala.setdefault(ag.sala_id, ag)

        dados = []
        for sala in salas:
            ag = por_sala.get(sala.id)
            atendimento = None
            if ag is not None:
                atendimento = {
                    "agendamento_id": ag.id,
                    "paciente_id": ag.paciente_id,
                    "paciente_nome": ag.paciente.nome_completo,
                    "profissional_id": ag.profissional_id,
                    "profissional_nome": ag.profissional.nome,
                    "servico_nome": ag.servico.nome,
                    "atendimento_iniciado_em": ag.atendimento_iniciado_em,
                    "duracao_atendimento_segundos": ag.duracao_atendimento_segundos,
                }
            dados.append(
                {
                    "sala_id": sala.id,
                    "sala_nome": sala.nome,
                    "em_uso": ag is not None,
                    "atendimento": atendimento,
                }
            )

        serializer = SalaOcupacaoSerializer(dados, many=True)
        return Response(serializer.data)


class ServicoViewSet(viewsets.ModelViewSet):
    """CRUD de serviços prestados (exclusão lógica via ``ativo``)."""

    queryset = Servico.objects.prefetch_related("profissionais").all()
    serializer_class = ServicoSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["ativo", "profissionais"]
    search_fields = ["nome"]
    ordering_fields = ["nome", "valor_clinica", "duracao_minutos", "criado_em", "atualizado_em"]
    ordering = ["nome"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.ativo = False
        instance.save(update_fields=["ativo", "atualizado_em"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class DisponibilidadeProfissionalViewSet(viewsets.ModelViewSet):
    """CRUD da disponibilidade recorrente do profissional (exclusão lógica via ``ativo``)."""

    queryset = DisponibilidadeProfissional.objects.all()
    serializer_class = DisponibilidadeProfissionalSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["profissional", "dia_semana", "ativo"]
    ordering_fields = ["dia_semana", "horario_inicio", "criado_em", "atualizado_em"]
    ordering = ["profissional", "dia_semana", "horario_inicio"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.ativo = False
        instance.save(update_fields=["ativo", "atualizado_em"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AusenciaProfissionalViewSet(viewsets.ModelViewSet):
    """CRUD das ausências do profissional (exclusão lógica via ``ativo``)."""

    queryset = AusenciaProfissional.objects.all()
    serializer_class = AusenciaProfissionalSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["profissional", "ativo"]
    ordering_fields = ["data_inicio", "data_fim", "criado_em", "atualizado_em"]
    ordering = ["-data_inicio"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.ativo = False
        instance.save(update_fields=["ativo", "atualizado_em"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AgendamentoViewSet(viewsets.ModelViewSet):
    """
    CRUD de agendamentos de consulta.

    PROFISSIONAL: acessa apenas os próprios agendamentos.
    RECEPCAO / DIRECAO: acessa todos.

    Filtros disponíveis para visualização em calendário: ``data``, ``profissional``,
    ``sala``, ``paciente`` e ``status``. O ``horario_fim`` é calculado e validado
    pelo ``AgendamentoSerializer`` antes de salvar.
    """

    serializer_class = AgendamentoSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["data", "profissional", "sala", "paciente", "status"]
    ordering_fields = ["data", "horario_inicio", "criado_em", "atualizado_em"]
    ordering = ["data", "horario_inicio"]

    def get_queryset(self):
        qs = (
            Agendamento.objects.select_related("paciente", "profissional", "sala", "servico")
            .prefetch_related("confirmacoes")
            .all()
        )
        if self.request.user.role == Papel.PROFISSIONAL and self.action == "list":
            qs = qs.filter(profissional=self.request.user)
        return qs

    def get_object(self):
        obj = super().get_object()
        if self.request.user.role == Papel.PROFISSIONAL and obj.profissional != self.request.user:
            raise PermissionDenied("Acesso negado: este agendamento pertence a outro profissional.")
        return obj

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == Papel.PROFISSIONAL:
            profissional = serializer.validated_data.get("profissional")
            if profissional and profissional != user:
                raise PermissionDenied(
                    "Profissional só pode criar agendamentos para si mesmo."
                )
        serializer.save()

    @action(detail=True, methods=["post"], url_path="recorrente")
    def recorrente(self, request, pk=None):
        """POST /api/agendamentos/{id}/recorrente/ — cria série recorrente."""
        from apps.clinica.services import criar_serie
        from apps.clinica.models import Frequencia

        if request.user.role not in (Papel.RECEPCAO, Papel.DIRECAO):
            raise PermissionDenied("Apenas RECEPCAO ou DIRECAO podem criar séries recorrentes.")

        agendamento = self.get_object()
        frequencia = request.data.get("frequencia")
        data_fim_str = request.data.get("data_fim_recorrencia")

        if not frequencia or frequencia not in Frequencia.values:
            return Response(
                {"frequencia": f"Obrigatório. Valores: {Frequencia.values}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not data_fim_str:
            return Response(
                {"data_fim_recorrencia": "Obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from datetime import date as date_type
        try:
            data_fim = date_type.fromisoformat(data_fim_str)
        except ValueError:
            return Response(
                {"data_fim_recorrencia": "Formato inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from rest_framework.exceptions import ValidationError as DRFValidationError
        try:
            criados, nao_criados = criar_serie(agendamento, frequencia, data_fim, request.user)
        except DRFValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(criados, many=True)
        return Response(
            {
                "criados": serializer.data,
                "total_criados": len(criados),
                "nao_criados": nao_criados,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="cancelar-serie")
    def cancelar_serie(self, request, pk=None):
        """POST /api/agendamentos/{id}/cancelar-serie/ — cancela todas as ocorrências futuras da série."""
        import datetime
        agendamento = self.get_object()

        if not agendamento.serie_id:
            return Response(
                {"detail": "Este agendamento não pertence a uma série recorrente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parecer = request.data.get("parecer_status", "Série cancelada pela recepção.")
        if not parecer.strip():
            return Response(
                {"parecer_status": "Informe o motivo do cancelamento da série."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hoje = datetime.date.today()
        futuras = Agendamento.objects.filter(
            serie=agendamento.serie,
            data__gte=hoje,
            status__in=[SA.AGENDADO, SA.PRE_CONFIRMADO, SA.CONFIRMADO],
        ).exclude(id=agendamento.id)

        canceladas = futuras.update(
            status=SA.DESMARCADO,
            parecer_status=parecer,
        )

        return Response(
            {"detail": f"{canceladas} sessão(ões) futura(s) desmarcada(s)."},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="transferir",
        permission_classes=[tem_papel(Papel.RECEPCAO, Papel.DIRECAO)],
    )
    def transferir(self, request, pk=None):
        """
        POST /api/agendamentos/{id}/transferir/ — transfere para outro profissional.

        Body: ``{"profissional": <id>, "confirmar": <bool>}``.

        Estar fora da disponibilidade semanal do profissional de destino é apenas
        um aviso: a primeira chamada retorna ``requer_confirmacao=True`` com os
        ``avisos`` e **não** salva; reenvie com ``confirmar=true`` para efetivar.
        Ausência/férias na data, serviço não oferecido e choque de horário
        (agenda dupla) continuam bloqueando (400). Restrito a RECEPCAO/DIRECAO.
        """
        from django.contrib.auth import get_user_model
        from apps.clinica.services import transferir_agendamento

        agendamento = self.get_object()

        profissional_id = request.data.get("profissional")
        if not profissional_id:
            return Response(
                {"profissional": "Informe o profissional de destino."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Usuario = get_user_model()
        try:
            novo_profissional = Usuario.objects.get(pk=profissional_id)
        except (Usuario.DoesNotExist, ValueError, TypeError):
            return Response(
                {"profissional": "Profissional de destino não encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        confirmar = request.data.get("confirmar", False) in (True, "true", "True", 1, "1")

        # transferir_agendamento levanta ValidationError (400) para bloqueios.
        efetivada, avisos = transferir_agendamento(
            agendamento, novo_profissional, confirmar=confirmar
        )

        serializer = self.get_serializer(agendamento)
        return Response(
            {
                "requer_confirmacao": not efetivada,
                "avisos": avisos,
                "agendamento": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="logs")
    def logs(self, request, pk=None):
        """GET /api/agendamentos/{id}/logs/ — histórico de auditoria do agendamento."""
        agendamento = self.get_object()
        ct = ContentType.objects.get_for_model(Agendamento)
        entries = LogEntry.objects.filter(
            content_type=ct, object_id=str(agendamento.pk)
        ).select_related("actor").order_by("timestamp")
        serializer = LogEntrySerializer(entries, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post", "get"], url_path="pagamento",
            permission_classes=[tem_papel(Papel.FINANCEIRO, Papel.DIRECAO)])
    def pagamento(self, request, pk=None):
        """POST/GET /api/agendamentos/{id}/pagamento/ — baixa de pagamento."""
        from apps.financeiro.models import PagamentoAgendamento
        from apps.financeiro.serializers import PagamentoAgendamentoSerializer

        agendamento = self.get_object()

        if request.method == "GET":
            try:
                pag = agendamento.pagamento
            except PagamentoAgendamento.DoesNotExist:
                return Response(
                    {"detail": "Nenhum pagamento registrado para este agendamento."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response(PagamentoAgendamentoSerializer(pag).data)

        # POST — registrar baixa
        if agendamento.status not in (SA.ATENDIDO,):
            return Response(
                {"detail": "Não é possível registrar pagamento para consulta não atendida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if hasattr(agendamento, "pagamento"):
            return Response(
                {"detail": "Agendamento já possui pagamento registrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valor_repasse = agendamento.servico.valor_repasse
        serializer = PagamentoAgendamentoSerializer(data={
            **request.data,
            "agendamento": agendamento.pk,
        })
        serializer.is_valid(raise_exception=True)
        serializer.save(
            registrado_por=request.user,
            valor_repasse_calculado=valor_repasse,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="iniciar-atendimento")
    def iniciar_atendimento(self, request, pk=None):
        """
        POST /api/agendamentos/{id}/iniciar-atendimento/ — inicia o cronômetro.

        Marca ``atendimento_iniciado_em`` e move o status para ``EM_ATENDIMENTO``,
        deixando a sala em uso. Permitido a PROFISSIONAL (do próprio agendamento)
        e DIRECAO, a partir de AGENDADO, PRE_CONFIRMADO ou CONFIRMADO.
        """
        agendamento = self.get_object()

        if agendamento.atendimento_em_andamento:
            return Response(
                {"detail": "O atendimento já foi iniciado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Valida a transição para EM_ATENDIMENTO (papel + estado de origem).
        # Levanta ValidationError (estado terminal) ou PermissionDenied (papel).
        validar_transicao(agendamento.status, SA.EM_ATENDIMENTO, request.user.role)

        # A sala não pode já estar ocupada por outro atendimento em andamento.
        sala_ocupada = (
            Agendamento.objects.filter(
                sala_id=agendamento.sala_id,
                status=SA.EM_ATENDIMENTO,
                atendimento_finalizado_em__isnull=True,
            )
            .exclude(pk=agendamento.pk)
            .exists()
        )
        if sala_ocupada:
            return Response(
                {"detail": "A sala já está em uso por outro atendimento."},
                status=status.HTTP_409_CONFLICT,
            )

        agendamento.atendimento_iniciado_em = timezone.now()
        agendamento.atendimento_finalizado_em = None
        agendamento.status = SA.EM_ATENDIMENTO
        agendamento.save(
            update_fields=[
                "atendimento_iniciado_em",
                "atendimento_finalizado_em",
                "status",
                "atualizado_em",
            ]
        )
        serializer = self.get_serializer(agendamento)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="finalizar-atendimento")
    def finalizar_atendimento(self, request, pk=None):
        """
        POST /api/agendamentos/{id}/finalizar-atendimento/ — encerra o atendimento.

        Marca ``atendimento_finalizado_em`` e move o status para ``ATENDIDO``
        (o que gera a Produção via signal) e libera a sala. Exige um atendimento
        em andamento; permitido a PROFISSIONAL (dono) e DIRECAO.
        """
        agendamento = self.get_object()

        if not agendamento.atendimento_iniciado_em:
            return Response(
                {"detail": "O atendimento não foi iniciado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if agendamento.atendimento_finalizado_em:
            return Response(
                {"detail": "O atendimento já foi finalizado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validar_transicao(agendamento.status, SA.ATENDIDO, request.user.role)

        agendamento.atendimento_finalizado_em = timezone.now()
        agendamento.status = SA.ATENDIDO
        agendamento.save(
            update_fields=["atendimento_finalizado_em", "status", "atualizado_em"]
        )
        serializer = self.get_serializer(agendamento)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DashboardTerapeutaView(viewsets.ViewSet):
    """GET /api/dashboard/terapeuta/ — métricas do profissional logado."""

    permission_classes = [tem_papel(Papel.PROFISSIONAL, Papel.DIRECAO)]

    def list(self, request):
        from datetime import date
        from django.db.models import Sum
        from apps.financeiro.models import PagamentoAgendamento

        profissional_id = request.query_params.get("profissional_id")
        if profissional_id and request.user.role == Papel.DIRECAO:
            profissional_pk = profissional_id
        else:
            profissional_pk = request.user.pk

        hoje = date.today()
        agendamentos = Agendamento.objects.filter(
            profissional_id=profissional_pk,
            data__year=hoje.year,
            data__month=hoje.month,
        )

        por_status = {}
        for s in SA.values:
            por_status[s] = agendamentos.filter(status=s).count()

        repasse_mes = PagamentoAgendamento.objects.filter(
            agendamento__profissional_id=profissional_pk,
            agendamento__data__year=hoje.year,
            agendamento__data__month=hoje.month,
        ).aggregate(total=Sum("valor_repasse_calculado"))["total"] or 0

        from datetime import timedelta
        proximas = Agendamento.objects.filter(
            profissional_id=profissional_pk,
            data__gte=hoje,
            data__lte=hoje + timedelta(days=7),
            status__in=[SA.AGENDADO, SA.PRE_CONFIRMADO, SA.CONFIRMADO],
        ).select_related("paciente", "sala").order_by("data", "horario_inicio")

        from apps.clinica.serializers import AgendamentoSerializer
        return Response({
            "por_status": por_status,
            "repasse_mes": str(repasse_mes),
            "proximas_consultas": AgendamentoSerializer(proximas, many=True, context={"request": request}).data,
        })


class ProducaoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta do ledger de produção (somente leitura).

    Filtros: ``?data__gte=``, ``?data__lte=``, ``?profissional=``, ``?paciente=``.
    Os lançamentos são criados/atualizados pelo signal ``post_save`` de
    ``Agendamento`` — não há create/update/delete pela API.
    """

    queryset = Producao.objects.select_related(
        "agendamento", "paciente", "profissional"
    ).all()
    serializer_class = ProducaoSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = ProducaoFilter
    ordering_fields = ["data", "valor", "criado_em"]
    ordering = ["-data"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Isolamento por papel: PROFISSIONAL vê apenas a própria produção.
        if self.request.user.role == Papel.PROFISSIONAL:
            qs = qs.filter(profissional=self.request.user)
        return qs


class RelatorioProducaoViewSet(viewsets.ViewSet):
    """
    GET /api/relatorio-producao/ — relatório de produção com filtro por status.

    Diferente do ledger (``/api/producoes/``), este relatório opera sobre os
    ``Agendamento`` e aceita filtro multi-valor: ?status=ATENDIDO&status=FALTA.
    Parâmetros: status (multi), data_inicio, data_fim, profissional.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = Agendamento.objects.select_related(
            "paciente", "profissional", "sala", "servico"
        ).prefetch_related("confirmacoes")

        # Filtro de status: aceita múltiplos valores (?status=X&status=Y)
        status_params = request.query_params.getlist("status")
        if status_params:
            status_validos = [s for s in status_params if s in SA.values]
            invalidos = [s for s in status_params if s not in SA.values]
            if invalidos:
                return Response(
                    {"status": f"Status inválidos: {invalidos}. Válidos: {SA.values}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if status_validos:
                qs = qs.filter(status__in=status_validos)

        # Filtros opcionais de data e profissional
        data_inicio = request.query_params.get("data_inicio")
        data_fim = request.query_params.get("data_fim")
        profissional_id = request.query_params.get("profissional")

        if data_inicio:
            qs = qs.filter(data__gte=data_inicio)
        if data_fim:
            qs = qs.filter(data__lte=data_fim)
        if profissional_id:
            qs = qs.filter(profissional_id=profissional_id)

        # Isolamento por papel: PROFISSIONAL vê só a própria produção
        if request.user.role == Papel.PROFISSIONAL:
            qs = qs.filter(profissional=request.user)

        qs = qs.order_by("data", "horario_inicio")

        from apps.clinica.serializers import AgendamentoSerializer
        serializer = AgendamentoSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)
