"""Admin da integração com o Google Agenda (somente leitura de segredos)."""
from django.contrib import admin

from apps.google_agenda.models import ContaGoogle, EventoGoogle


@admin.register(ContaGoogle)
class ContaGoogleAdmin(admin.ModelAdmin):
    list_display = ("usuario", "email_google", "ativa", "conectada_em")
    list_filter = ("ativa",)
    search_fields = ("usuario__nome", "usuario__email", "email_google")
    # Nunca expõe/edita o refresh token nem o access token pela interface.
    exclude = ("refresh_token_cifrado", "access_token")
    readonly_fields = (
        "usuario",
        "email_google",
        "scopes",
        "access_token_expira_em",
        "conectada_em",
        "atualizado_em",
    )


@admin.register(EventoGoogle)
class EventoGoogleAdmin(admin.ModelAdmin):
    list_display = ("agendamento", "conta", "google_event_id", "ultima_sincronizacao")
    search_fields = ("google_event_id", "conta__usuario__email")
    readonly_fields = ("criado_em", "ultima_sincronizacao")
