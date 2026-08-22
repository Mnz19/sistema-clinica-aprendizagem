"""Rotas do módulo de clínica (salas, serviços, agenda e produção)."""
from rest_framework.routers import DefaultRouter

from apps.clinica.views import (
    AgendamentoViewSet,
    AusenciaProfissionalViewSet,
    DashboardTerapeutaView,
    DisponibilidadeProfissionalViewSet,
    ProducaoViewSet,
    RelatorioProducaoViewSet,
    SalaViewSet,
    ServicoViewSet,
)

router = DefaultRouter()
router.register(r"salas", SalaViewSet, basename="sala")
router.register(r"servicos", ServicoViewSet, basename="servico")
router.register(
    r"disponibilidades", DisponibilidadeProfissionalViewSet, basename="disponibilidade"
)
router.register(r"ausencias", AusenciaProfissionalViewSet, basename="ausencia")
router.register(r"agendamentos", AgendamentoViewSet, basename="agendamento")
router.register(r"dashboard/terapeuta", DashboardTerapeutaView, basename="dashboard-terapeuta")
router.register(r"producoes", ProducaoViewSet, basename="producao")
router.register(
    r"relatorio-producao", RelatorioProducaoViewSet, basename="relatorio-producao"
)

urlpatterns = router.urls
