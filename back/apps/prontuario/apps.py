"""Configuração do app de prontuário eletrônico."""
from django.apps import AppConfig


class ProntuarioConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.prontuario"
    verbose_name = "Prontuário eletrônico"
