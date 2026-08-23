"""Configuração do app de integração com o Google Agenda (Calendar API)."""
from django.apps import AppConfig


class GoogleAgendaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.google_agenda"
    verbose_name = "Google Agenda"

    def ready(self) -> None:
        # Registra os signals que espelham os agendamentos no Google Agenda.
        import apps.google_agenda.signals  # noqa: F401
