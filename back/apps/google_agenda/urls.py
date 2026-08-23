"""Rotas da integração com o Google Agenda."""
from django.urls import path

from apps.google_agenda.views import (
    GoogleAuthorizeView,
    GoogleCallbackView,
    GoogleDisconnectView,
    GoogleStatusView,
)

urlpatterns = [
    path("google/status/", GoogleStatusView.as_view(), name="google-status"),
    path("google/authorize/", GoogleAuthorizeView.as_view(), name="google-authorize"),
    path("google/callback/", GoogleCallbackView.as_view(), name="google-callback"),
    path(
        "google/disconnect/",
        GoogleDisconnectView.as_view(),
        name="google-disconnect",
    ),
]
