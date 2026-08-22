"""
Views das confirmações por WhatsApp.

- ``ConfiguracaoConfirmacaoView`` → /api/whatsapp/config/     (GET/PUT, gestores)
- ``MensagemConfirmacaoViewSet``  → /api/whatsapp/mensagens/  (log, leitura)
- ``EnviarConfirmacaoView``       → /api/whatsapp/enviar/<id>/ (reenvio manual)
- ``WebhookView``                 → /api/whatsapp/webhook/     (Meta: verify + inbound)
"""
import logging

from django.conf import settings
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Papel
from apps.accounts.permissions import tem_papel
from apps.clinica.models import Agendamento
from apps.whatsapp.models import ConfiguracaoConfirmacao, MensagemConfirmacao
from apps.whatsapp.serializers import (
    ConfiguracaoConfirmacaoSerializer,
    MensagemConfirmacaoSerializer,
)
from apps.whatsapp.services import (
    atualizar_status_entrega,
    enviar_confirmacao,
    processar_resposta,
)

logger = logging.getLogger(__name__)

# Quem gerencia a configuração e dispara reenvios (direção/supervisão/recepção).
PodeGerenciarConfirmacoes = tem_papel(Papel.DIRECAO, Papel.SUPERVISAO, Papel.RECEPCAO)
# Configuração (mais sensível): direção e supervisão.
PodeConfigurar = tem_papel(Papel.DIRECAO, Papel.SUPERVISAO)


class ConfiguracaoConfirmacaoView(APIView):
    """Configuração única das confirmações (GET para ver, PUT/PATCH para editar)."""

    serializer_class = ConfiguracaoConfirmacaoSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [PodeConfigurar()]
        return [PodeGerenciarConfirmacoes()]

    @extend_schema(responses=ConfiguracaoConfirmacaoSerializer)
    def get(self, request):
        config = ConfiguracaoConfirmacao.carregar()
        return Response(ConfiguracaoConfirmacaoSerializer(config).data)

    @extend_schema(
        request=ConfiguracaoConfirmacaoSerializer,
        responses=ConfiguracaoConfirmacaoSerializer,
    )
    def put(self, request):
        return self._atualizar(request, parcial=False)

    @extend_schema(
        request=ConfiguracaoConfirmacaoSerializer,
        responses=ConfiguracaoConfirmacaoSerializer,
    )
    def patch(self, request):
        return self._atualizar(request, parcial=True)

    def _atualizar(self, request, parcial):
        config = ConfiguracaoConfirmacao.carregar()
        serializer = ConfiguracaoConfirmacaoSerializer(
            config, data=request.data, partial=parcial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MensagemConfirmacaoViewSet(viewsets.ReadOnlyModelViewSet):
    """Log (somente leitura) das confirmações enviadas."""

    serializer_class = MensagemConfirmacaoSerializer
    permission_classes = [PodeGerenciarConfirmacoes]
    queryset = MensagemConfirmacao.objects.select_related(
        "agendamento", "agendamento__paciente"
    )
    filterset_fields = ["status", "agendamento"]
    ordering = ["-criado_em"]


class EnviarConfirmacaoView(APIView):
    """Envia (ou reenvia) manualmente a confirmação de um agendamento."""

    permission_classes = [PodeGerenciarConfirmacoes]
    serializer_class = MensagemConfirmacaoSerializer

    @extend_schema(request=None, responses=MensagemConfirmacaoSerializer)
    def post(self, request, agendamento_id):
        agendamento = (
            Agendamento.objects.filter(pk=agendamento_id)
            .select_related("paciente", "profissional")
            .first()
        )
        if agendamento is None:
            return Response(
                {"detail": "Agendamento não encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        registro = enviar_confirmacao(agendamento, forcar=True)
        return Response(
            MensagemConfirmacaoSerializer(registro).data,
            status=status.HTTP_201_CREATED,
        )


class _PublicoParaWebhook(BasePermission):
    def has_permission(self, request, view):
        return True


class WebhookView(APIView):
    """
    Webhook do WhatsApp Cloud API (Meta).

    - ``GET``  → verificação do webhook (responde o ``hub.challenge``).
    - ``POST`` → recebe respostas dos pacientes e status de entrega.
    """

    permission_classes = [_PublicoParaWebhook]
    authentication_classes = []

    @extend_schema(responses={200: None})
    def get(self, request):
        modo = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge", "")
        esperado = getattr(settings, "WHATSAPP_VERIFY_TOKEN", "")
        if modo == "subscribe" and token and token == esperado:
            return HttpResponse(challenge, content_type="text/plain")
        return HttpResponse("Verificação inválida.", status=403)

    @extend_schema(request=None, responses={200: None})
    def post(self, request):
        try:
            self._processar(request.data)
        except Exception:  # nunca devolve erro à Meta (evita reentregas em loop)
            logger.exception("Falha ao processar webhook do WhatsApp")
        return Response({"status": "ok"})

    @staticmethod
    def _processar(payload):
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                valor = change.get("value", {})

                # Respostas dos pacientes (mensagens recebidas).
                for msg in valor.get("messages", []):
                    if msg.get("type") != "text":
                        continue
                    telefone = msg.get("from", "")
                    texto = msg.get("text", {}).get("body", "")
                    processar_resposta(telefone, texto)

                # Status de entrega (sent/delivered/read/failed).
                for st in valor.get("statuses", []):
                    atualizar_status_entrega(st.get("id", ""), st.get("status", ""))
