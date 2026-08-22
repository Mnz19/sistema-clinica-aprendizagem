from django.apps import AppConfig


class AuditoriaConfig(AppConfig):
    """
    App de auditoria: não tem models próprios.

    Apenas expõe, via API somente-leitura (``/api/logs/``), a trilha de alterações
    capturada pelo django-auditlog (``auditlog.models.LogEntry``). A captura em si é
    configurada em ``config/settings/base.py`` (AUDITLOG_*).
    """

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.auditoria"
    verbose_name = "Auditoria"
