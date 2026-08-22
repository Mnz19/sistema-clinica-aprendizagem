"""
Registro central de rotas do projeto.

- ``/admin/``      → Django Admin (gestão de usuários pela DIREÇÃO)
- ``/health/``     → healthcheck simples (usado pelo Docker)
- ``/api/schema/`` → schema OpenAPI (drf-spectacular)
- ``/api/docs/``   → Swagger UI
- ``/api/auth/``   → autenticação (login, refresh, logout, /me, troca de senha)
- ``/api/``        → demais rotas dos apps (usuários)
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def health(_request):
    """Verifica a conectividade com o banco e responde o status da aplicação."""
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
        status = "ok"
    except OperationalError as exc:
        status = f"error: {exc.__class__.__name__}"
    return JsonResponse({"status": status})


urlpatterns = [
    path(
        "",
        RedirectView.as_view(pattern_name="swagger-ui", permanent=False),
        name="root-redirect",
    ),
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    # OpenAPI (schema + UIs)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Módulo de autenticação e usuários
    path("api/", include("apps.accounts.urls")),
    # Módulo de pacientes (cadastro, responsáveis e anexos)
    path("api/", include("apps.pacientes.urls")),
    # Trilha de auditoria (aba "Logs" — DIREÇÃO/superusuário)
    path("api/", include("apps.auditoria.urls")),
    # Módulo de clínica (salas, serviços e agenda)
    path("api/", include("apps.clinica.urls")),
    # Prontuário eletrônico (linha do tempo clínica e anexos)
    path("api/", include("apps.prontuario.urls")),
    # Confirmações de consulta por WhatsApp
    path("api/", include("apps.whatsapp.urls")),
    # Módulo financeiro (pagamentos e repasses)
    path("api/", include("apps.financeiro.urls")),
    # Fila de espera de pacientes
    path("api/", include("apps.fila_espera.urls")),
]

# Em desenvolvimento, o Django serve os arquivos de mídia (anexos) enviados.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
