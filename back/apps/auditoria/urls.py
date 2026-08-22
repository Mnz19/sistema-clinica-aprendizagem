"""Rotas do app de auditoria: trilha de alterações em ``/api/logs/``."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.auditoria.views import LogEntryViewSet

router = DefaultRouter()
router.register(r"logs", LogEntryViewSet, basename="log")

urlpatterns = [
    path("", include(router.urls)),
]
