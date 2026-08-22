"""Django Admin do prontuário modular."""
from django.contrib import admin

from apps.prontuario.models import (
    Atestado,
    AnexoEntrada,
    CategoriaItemProntuario,
    ComentarioEntrada,
    EntradaProntuario,
    GrupoExames,
    ItemProntuario,
    ModeloAtestado,
    ProtocoloProntuario,
    TextoPadrao,
)


class AnexoEntradaInline(admin.TabularInline):
    model = AnexoEntrada
    extra = 0
    readonly_fields = ["nome_original", "enviado_por", "criado_em"]


class ComentarioEntradaInline(admin.TabularInline):
    model = ComentarioEntrada
    extra = 0
    readonly_fields = ["autor", "criado_em", "atualizado_em"]


@admin.register(CategoriaItemProntuario)
class CategoriaItemProntuarioAdmin(admin.ModelAdmin):
    list_display = ["nome", "profissional", "ordem", "ativo"]
    list_filter = ["ativo"]
    search_fields = ["nome", "profissional__nome"]


@admin.register(ItemProntuario)
class ItemProntuarioAdmin(admin.ModelAdmin):
    list_display = ["nome", "profissional", "tipo_item", "visivel", "ordem", "ativo"]
    list_filter = ["tipo_item", "visivel", "ativo"]
    search_fields = ["nome", "profissional__nome"]
    readonly_fields = ["criado_em", "atualizado_em"]


@admin.register(EntradaProntuario)
class EntradaProntuarioAdmin(admin.ModelAdmin):
    list_display = ["paciente", "item", "autor", "data_evento", "criado_em"]
    list_filter = ["data_evento"]
    search_fields = ["paciente__nome_completo", "titulo", "conteudo"]
    readonly_fields = ["profissional", "autor", "schema_snapshot", "criado_em", "atualizado_em"]
    date_hierarchy = "data_evento"
    inlines = [AnexoEntradaInline, ComentarioEntradaInline]


@admin.register(TextoPadrao)
class TextoPadraoAdmin(admin.ModelAdmin):
    list_display = ["titulo", "profissional", "compartilhado", "ordem", "ativo"]
    list_filter = ["compartilhado", "ativo"]
    search_fields = ["titulo", "conteudo"]
    readonly_fields = ["criado_em", "atualizado_em"]


@admin.register(GrupoExames)
class GrupoExamesAdmin(admin.ModelAdmin):
    list_display = ["nome", "profissional", "ordem", "ativo"]
    list_filter = ["ativo"]
    search_fields = ["nome"]


@admin.register(ModeloAtestado)
class ModeloAtestadoAdmin(admin.ModelAdmin):
    list_display = ["nome", "profissional", "ordem", "ativo"]
    list_filter = ["ativo"]
    search_fields = ["nome", "titulo"]


@admin.register(Atestado)
class AtestadoAdmin(admin.ModelAdmin):
    list_display = ["titulo", "paciente", "profissional", "emitido_em"]
    search_fields = ["titulo", "paciente__nome_completo"]
    readonly_fields = ["corpo_resolvido", "cids", "emitido_em", "criado_em", "atualizado_em"]
    date_hierarchy = "emitido_em"


@admin.register(ProtocoloProntuario)
class ProtocoloProntuarioAdmin(admin.ModelAdmin):
    list_display = ["nome", "especialidade", "tipo_item", "ativo"]
    list_filter = ["tipo_item", "ativo", "especialidade"]
    search_fields = ["nome", "descricao"]
