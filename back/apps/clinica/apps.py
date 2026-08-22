"""Configuração do app de clínica (salas, serviços, agenda e produção)."""
from django.apps import AppConfig


class ClinicaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.clinica"
    verbose_name = "Clínica"

    def ready(self) -> None:
        # Registra os signals (ledger de Produção vinculado ao Agendamento).
        import apps.clinica.signals  # noqa: F401
