"""Admin das confirmações por WhatsApp."""
from django.contrib import admin

from apps.whatsapp.models import ConfiguracaoConfirmacao, MensagemConfirmacao


@admin.register(ConfiguracaoConfirmacao)
class ConfiguracaoConfirmacaoAdmin(admin.ModelAdmin):
    list_display = ["ativo", "antecedencia_dias", "horario_disparo", "atualizado_em"]

    def has_add_permission(self, request):
        # Singleton: só existe uma configuração.
        return not ConfiguracaoConfirmacao.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MensagemConfirmacao)
class MensagemConfirmacaoAdmin(admin.ModelAdmin):
    list_display = [
        "destinatario_nome", "telefone", "status", "enviado_em", "respondido_em",
    ]
    list_filter = ["status"]
    search_fields = ["destinatario_nome", "telefone", "wa_message_id"]
    readonly_fields = [f.name for f in MensagemConfirmacao._meta.fields]

    def has_add_permission(self, request):
        return False
