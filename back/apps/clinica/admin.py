"""Django Admin do módulo de clínica."""
from django.contrib import admin

from apps.clinica.models import (
    AusenciaProfissional,
    DisponibilidadeProfissional,
    Producao,
    Sala,
    Servico,
)


@admin.register(Sala)
class SalaAdmin(admin.ModelAdmin):
    list_display = ["nome", "ativa", "atualizado_em"]
    list_filter = ["ativa"]
    search_fields = ["nome"]


@admin.register(Servico)
class ServicoAdmin(admin.ModelAdmin):
    list_display = [
        "nome",
        "listar_profissionais",
        "duracao_minutos",
        "valor_clinica",
        "valor_repasse",
        "ativo",
        "atualizado_em",
    ]
    list_filter = ["ativo"]
    search_fields = ["nome", "profissionais__nome"]
    filter_horizontal = ["profissionais"]

    @admin.display(description="profissionais")
    def listar_profissionais(self, obj):
        return ", ".join(p.nome for p in obj.profissionais.all()) or "—"


@admin.register(DisponibilidadeProfissional)
class DisponibilidadeProfissionalAdmin(admin.ModelAdmin):
    list_display = [
        "profissional",
        "get_dia_semana_display",
        "horario_inicio",
        "horario_fim",
        "ativo",
        "atualizado_em",
    ]
    list_filter = ["dia_semana", "ativo"]
    search_fields = ["profissional__nome"]

    @admin.display(description="dia da semana")
    def get_dia_semana_display(self, obj):
        return obj.get_dia_semana_display()


@admin.register(AusenciaProfissional)
class AusenciaProfissionalAdmin(admin.ModelAdmin):
    list_display = [
        "profissional",
        "data_inicio",
        "data_fim",
        "motivo",
        "ativo",
        "atualizado_em",
    ]
    list_filter = ["ativo"]
    search_fields = ["profissional__nome", "motivo"]


@admin.register(Producao)
class ProducaoAdmin(admin.ModelAdmin):
    """Ledger de produção — somente leitura no Admin (imutável pela regra de negócio)."""

    list_display = [
        "data",
        "paciente",
        "profissional",
        "servico_nome",
        "valor",
        "motivo",
        "criado_em",
    ]
    list_filter = ["motivo", "data"]
    search_fields = ["servico_nome", "paciente__nome_completo", "profissional__nome"]
    readonly_fields = [
        "agendamento",
        "paciente",
        "profissional",
        "data",
        "servico_nome",
        "valor",
        "motivo",
        "criado_em",
        "atualizado_em",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
