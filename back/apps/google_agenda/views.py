"""
Endpoints da integração com o Google Agenda.

- ``GET    /api/google/status/``     → estado da conexão do usuário logado.
- ``GET    /api/google/authorize/``  → devolve a URL de consentimento do Google.
- ``GET    /api/google/callback/``   → retorno do Google (público); troca o code
                                       por tokens e redireciona ao frontend.
- ``PATCH  /api/google/status/``     → liga/desliga a sincronização (``ativa``).
- ``DELETE /api/google/disconnect/`` → desconecta a conta do usuário logado.
"""
from __future__ import annotations

import logging

from django.conf import settings
from django.core import signing
from django.http import HttpResponseRedirect
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.google_agenda import services
from apps.google_agenda.models import ContaGoogle

logger = logging.getLogger(__name__)


class GoogleStatusView(APIView):
    """Estado da conexão do profissional autenticado + liga/desliga do sync."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(services.status_para(request.user))

    @extend_schema(request={"application/json": {"type": "object"}}, responses=None)
    def patch(self, request):
        """Liga/desliga a sincronização: body ``{"ativa": true|false}``."""
        conta = ContaGoogle.objects.filter(usuario=request.user).first()
        if conta is None:
            return Response(
                {"detail": "Nenhuma conta Google conectada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        ativa = request.data.get("ativa")
        if not isinstance(ativa, bool):
            return Response(
                {"ativa": "Informe um booleano (true/false)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        conta.ativa = ativa
        conta.save(update_fields=["ativa", "atualizado_em"])
        return Response(services.status_para(request.user))


class GoogleAuthorizeView(APIView):
    """Devolve a URL para onde o frontend deve levar o profissional consentir."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not services.esta_configurado():
            return Response(
                {"detail": "Integração com o Google Agenda não configurada."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        url = services.gerar_url_autorizacao(request.user)
        return Response({"authorization_url": url})


class GoogleCallbackView(APIView):
    """
    Retorno do Google após o consentimento (aberto no navegador, sem JWT).

    A identidade do usuário vem do parâmetro assinado ``state``. Ao final,
    redireciona o navegador de volta ao frontend (sucesso ou erro).
    """

    permission_classes = []
    authentication_classes = []

    @extend_schema(responses={302: None})
    def get(self, request):
        erro = request.GET.get("error")
        code = request.GET.get("code")
        state = request.GET.get("state", "")

        if erro or not code:
            logger.info("Callback do Google sem code (erro=%s).", erro)
            return HttpResponseRedirect(settings.GOOGLE_OAUTH_ERROR_REDIRECT)

        try:
            services.processar_callback(code=code, state=state)
        except (signing.BadSignature, signing.SignatureExpired):
            logger.warning("State inválido/expirado no callback do Google.")
            return HttpResponseRedirect(settings.GOOGLE_OAUTH_ERROR_REDIRECT)
        except Exception:  # noqa: BLE001 — qualquer falha volta como erro ao front
            logger.exception("Falha ao processar o callback do Google.")
            return HttpResponseRedirect(settings.GOOGLE_OAUTH_ERROR_REDIRECT)

        return HttpResponseRedirect(settings.GOOGLE_OAUTH_SUCCESS_REDIRECT)


class GoogleDisconnectView(APIView):
    """Desconecta a conta Google do profissional autenticado."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: None})
    def delete(self, request):
        desconectado = services.desconectar(request.user)
        if not desconectado:
            return Response(
                {"detail": "Nenhuma conta Google conectada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"detail": "Google Agenda desconectado."})
