from rest_framework.routers import DefaultRouter

from apps.fila_espera.views import FilaEsperaViewSet

router = DefaultRouter()
router.register(r"fila-espera", FilaEsperaViewSet, basename="fila-espera")

urlpatterns = router.urls
