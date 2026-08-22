"""Rotas do app de contas: autenticação e gestão de usuários."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.accounts.views import (
    ConviteConfirmarView,
    EspecialidadeViewSet,
    LoginView,
    LogoutView,
    MeView,
    ResetSenhaConfirmarView,
    ResetSenhaSolicitarView,
    TrocaSenhaView,
    UsuarioViewSet,
)

router = DefaultRouter()
router.register(r"usuarios", UsuarioViewSet, basename="usuario")
router.register(r"especialidades", EspecialidadeViewSet, basename="especialidade")

auth_patterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("verify/", TokenVerifyView.as_view(), name="auth-verify"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("change-password/", TrocaSenhaView.as_view(), name="auth-change-password"),
    path(
        "password-reset/",
        ResetSenhaSolicitarView.as_view(),
        name="auth-password-reset",
    ),
    path(
        "password-reset/confirm/",
        ResetSenhaConfirmarView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path(
        "convite/confirmar/",
        ConviteConfirmarView.as_view(),
        name="auth-convite-confirmar",
    ),
]

urlpatterns = [
    path("auth/", include(auth_patterns)),
    path("", include(router.urls)),
]
