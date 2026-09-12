"""Rotas do módulo de pacientes."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.pacientes.views import (
    DocumentoPacienteViewSet,
    NotaFiscalPacienteViewSet,
    PacienteViewSet,
    ProfissionaisDisponiveisView,
)

router = DefaultRouter()
router.register(r"pacientes", PacienteViewSet, basename="paciente")
router.register(r"documentos", DocumentoPacienteViewSet, basename="documento-paciente")
router.register(
    r"notas-fiscais", NotaFiscalPacienteViewSet, basename="nota-fiscal-paciente"
)

urlpatterns = [
    path(
        "profissionais/",
        ProfissionaisDisponiveisView.as_view(),
        name="profissionais-disponiveis",
    ),
    *router.urls,
]
