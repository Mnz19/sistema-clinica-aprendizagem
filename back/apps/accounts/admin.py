"""Configuração do Django Admin para usuários e logs de acesso."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import Especialidade, LogAcesso, Usuario


@admin.register(Especialidade)
class EspecialidadeAdmin(admin.ModelAdmin):
    """Lista gerenciável de especialidades dos prestadores."""

    list_display = ["nome", "ativo", "criado_em"]
    list_filter = ["ativo"]
    search_fields = ["nome"]
    readonly_fields = ["criado_em", "atualizado_em"]


@admin.register(Usuario)
class UsuarioAdmin(BaseUserAdmin):
    """
    Admin do usuário customizado (login por e-mail, com papel).

    Usa formulários baseados em e-mail em vez de username. A DIREÇÃO gerencia a
    equipe por aqui ou pelo endpoint restrito ``/api/usuarios/``.
    """

    ordering = ["nome"]
    list_display = ["email", "nome", "role", "is_active", "is_staff", "last_login"]
    list_filter = ["role", "is_active", "is_staff", "is_superuser"]
    search_fields = ["email", "nome", "cpf"]
    # ``role`` é derivado do conjunto ``papeis`` (papel principal) — somente leitura
    # na edição; na criação ele é escolhido em ``add_fieldsets`` e semeia ``papeis``.
    readonly_fields = ["role", "last_login", "criado_em", "atualizado_em"]
    filter_horizontal = ["papeis", "especialidades", "groups", "user_permissions"]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # Usuário criado pelo admin sem papéis explícitos herda o ``role`` escolhido.
        usuario = form.instance
        if not usuario.papeis.exists():
            from apps.accounts.models import PapelUsuario

            papel, _ = PapelUsuario.objects.get_or_create(codigo=usuario.role)
            usuario.papeis.add(papel)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Dados pessoais"), {
            "fields": (
                "nome",
                "foto",
                "cpf",
                ("rg", "rg_orgao_emissor"),
                ("data_nascimento", "sexo"),
                ("telefone", "celular"),
            )
        }),
        (_("Registro no conselho"), {
            "fields": (("conselho_tipo", "conselho_uf", "conselho_numero"),)
        }),
        (_("Endereço"), {
            "fields": (
                "cep",
                ("logradouro", "numero"),
                "complemento",
                "bairro",
                ("cidade", "estado"),
            )
        }),
        (_("Qualificação profissional"), {"fields": ("especialidades",)}),
        (_("Papel e permissões"), {
            "fields": (
                "papeis",
                "role",
                "is_active",
                "is_staff",
                "is_superuser",
                "precisa_trocar_senha",
                "groups",
                "user_permissions",
            )
        }),
        (_("Datas"), {"fields": ("last_login", "criado_em", "atualizado_em")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "nome", "role", "password1", "password2"),
        }),
    )


@admin.register(LogAcesso)
class LogAcessoAdmin(admin.ModelAdmin):
    """Visualização (somente leitura) da trilha de acessos exigida pela LGPD."""

    list_display = ["email_informado", "usuario", "sucesso", "ip", "data_hora"]
    list_filter = ["sucesso", "data_hora"]
    search_fields = ["email_informado", "ip"]
    readonly_fields = [
        "usuario",
        "email_informado",
        "sucesso",
        "ip",
        "user_agent",
        "data_hora",
    ]
    date_hierarchy = "data_hora"

    def has_add_permission(self, request):
        # Logs de acesso são gerados pelo sistema; não se criam manualmente.
        return False

    def has_change_permission(self, request, obj=None):
        return False
