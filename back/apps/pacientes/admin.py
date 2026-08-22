"""Django Admin do módulo de pacientes."""
from django.contrib import admin

from apps.pacientes.models import DocumentoPaciente, Paciente, Responsavel


class ResponsavelInline(admin.TabularInline):
    model = Responsavel
    extra = 0


class DocumentoPacienteInline(admin.TabularInline):
    model = DocumentoPaciente
    extra = 0
    readonly_fields = ["nome_original", "enviado_por", "criado_em"]


@admin.register(Paciente)
class PacienteAdmin(admin.ModelAdmin):
    list_display = ["nome_completo", "data_nascimento", "cidade", "ativo", "atualizado_em"]
    list_filter = ["ativo", "estado", "profissionais"]
    search_fields = ["nome_completo", "cpf", "email"]
    filter_horizontal = ["profissionais"]
    readonly_fields = ["criado_por", "criado_em", "atualizado_em"]
    inlines = [ResponsavelInline, DocumentoPacienteInline]
    date_hierarchy = "criado_em"


@admin.register(Responsavel)
class ResponsavelAdmin(admin.ModelAdmin):
    list_display = ["nome", "parentesco", "paciente", "telefone", "principal"]
    list_filter = ["parentesco", "principal"]
    search_fields = ["nome", "cpf", "paciente__nome_completo"]


@admin.register(DocumentoPaciente)
class DocumentoPacienteAdmin(admin.ModelAdmin):
    list_display = ["nome_original", "tipo", "paciente", "enviado_por", "criado_em"]
    list_filter = ["tipo"]
    search_fields = ["nome_original", "descricao", "paciente__nome_completo"]
    readonly_fields = ["nome_original", "enviado_por", "criado_em"]
