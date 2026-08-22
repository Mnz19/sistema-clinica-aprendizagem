"""Serializer (somente leitura) da trilha de auditoria.

Traduz o ``auditlog.models.LogEntry`` para um contrato em português, pronto para a
linha do tempo do front: quem, quando, em qual tabela/objeto, qual ação e o diff
campo-a-campo (antes/depois).
"""
from auditlog.models import LogEntry
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

# Rótulos das ações do auditlog em português (padrão pt-br do projeto).
ACAO_LABELS = {
    LogEntry.Action.CREATE: "Criação",
    LogEntry.Action.UPDATE: "Edição",
    LogEntry.Action.DELETE: "Exclusão",
    LogEntry.Action.ACCESS: "Acesso",
}


class LogEntrySerializer(serializers.ModelSerializer):
    """Representação de leitura de um evento de auditoria."""

    acao = serializers.IntegerField(source="action", read_only=True)
    acao_label = serializers.SerializerMethodField()
    tabela = serializers.CharField(source="content_type.model", read_only=True)
    tabela_label = serializers.CharField(source="content_type.name", read_only=True)
    objeto_id = serializers.CharField(source="object_pk", read_only=True)
    objeto_repr = serializers.CharField(source="object_repr", read_only=True)
    usuario = serializers.SerializerMethodField()
    ip = serializers.CharField(source="remote_addr", read_only=True)
    data_hora = serializers.DateTimeField(source="timestamp", read_only=True)
    alteracoes = serializers.SerializerMethodField()

    class Meta:
        model = LogEntry
        fields = [
            "id",
            "acao",
            "acao_label",
            "tabela",
            "tabela_label",
            "objeto_id",
            "objeto_repr",
            "usuario",
            "ip",
            "data_hora",
            "alteracoes",
        ]

    def get_acao_label(self, obj) -> str:
        return ACAO_LABELS.get(obj.action, str(obj.action))

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_usuario(self, obj):
        """Autor da alteração (ou ``None`` quando feita fora de um request)."""
        ator = obj.actor
        if not ator:
            return None
        return {"id": ator.id, "nome": ator.nome, "email": ator.email}

    def get_alteracoes(self, obj) -> dict:
        """Diff campo-a-campo: ``{campo: [valor_antigo, valor_novo]}``."""
        return obj.changes_dict or {}
