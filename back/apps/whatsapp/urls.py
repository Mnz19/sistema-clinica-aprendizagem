"""Rotas das confirmações por WhatsApp."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.whatsapp.views import (
    ConfiguracaoConfirmacaoView,
    EnviarConfirmacaoView,
    MensagemConfirmacaoViewSet,
    WebhookView,
)

router = DefaultRouter()
router.register(
    r"whatsapp/mensagens", MensagemConfirmacaoViewSet, basename="whatsapp-mensagem"
)

urlpatterns = [
    path("whatsapp/config/", ConfiguracaoConfirmacaoView.as_view(), name="whatsapp-config"),
    path(
        "whatsapp/enviar/<int:agendamento_id>/",
        EnviarConfirmacaoView.as_view(),
        name="whatsapp-enviar",
    ),
    path("whatsapp/webhook/", WebhookView.as_view(), name="whatsapp-webhook"),
    *router.urls,
]
