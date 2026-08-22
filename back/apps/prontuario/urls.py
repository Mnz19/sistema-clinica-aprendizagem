"""Rotas do prontuário modular."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.prontuario.views import (
    AtestadoViewSet,
    AnexoEntradaViewSet,
    CategoriaItemProntuarioViewSet,
    ComentarioEntradaViewSet,
    ConfigProntuarioView,
    EntradaProntuarioViewSet,
    GrupoExamesViewSet,
    ItemProntuarioViewSet,
    ModeloAtestadoViewSet,
    OpcoesProntuarioView,
    ProtocoloProntuarioViewSet,
    TextoPadraoViewSet,
)

router = DefaultRouter()
# Configuração (DIREÇÃO)
router.register(r"prontuario/categorias", CategoriaItemProntuarioViewSet, basename="categoria-prontuario")
router.register(r"prontuario/itens", ItemProntuarioViewSet, basename="item-prontuario")
router.register(r"prontuario/textos-padrao", TextoPadraoViewSet, basename="texto-padrao")
router.register(r"prontuario/grupos-exames", GrupoExamesViewSet, basename="grupo-exames")
router.register(r"prontuario/modelos-atestado", ModeloAtestadoViewSet, basename="modelo-atestado")
router.register(r"prontuario/protocolos", ProtocoloProntuarioViewSet, basename="protocolo-prontuario")
# Preenchimento
router.register(r"prontuario/entradas", EntradaProntuarioViewSet, basename="entrada-prontuario")
router.register(r"prontuario/anexos", AnexoEntradaViewSet, basename="anexo-prontuario")
router.register(r"prontuario/comentarios", ComentarioEntradaViewSet, basename="comentario-prontuario")
router.register(r"prontuario/atestados", AtestadoViewSet, basename="atestado")

urlpatterns = [
    path("prontuario/opcoes/", OpcoesProntuarioView.as_view(), name="opcoes-prontuario"),
    path("prontuario/config/replicar/", ConfigProntuarioView.as_view(), name="replicar-prontuario"),
] + router.urls
