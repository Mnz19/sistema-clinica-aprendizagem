"""Serializers das confirmações por WhatsApp."""
from rest_framework import serializers

from apps.whatsapp.models import ConfiguracaoConfirmacao, MensagemConfirmacao


class ConfiguracaoConfirmacaoSerializer(serializers.ModelSerializer):
    """Configuração única do envio de confirmações."""

    simulado = serializers.SerializerMethodField()

    class Meta:
        model = ConfiguracaoConfirmacao
        fields = [
            "ativo",
            "antecedencia_dias",
            "horario_disparo",
            "mensagem",
            "template_meta_nome",
            "template_meta_idioma",
            "simulado",
            "atualizado_em",
        ]
        read_only_fields = ["simulado", "atualizado_em"]

    def get_simulado(self, obj) -> bool:
        """Indica se o envio está em modo simulado (sem credenciais da Meta)."""
        from apps.whatsapp.providers import modo_simulado

        return modo_simulado()

    def validate_antecedencia_dias(self, value):
        if value < 0 or value > 30:
            raise serializers.ValidationError("Use um valor entre 0 e 30 dias.")
        return value


class MensagemConfirmacaoSerializer(serializers.ModelSerializer):
    """Registro (log) de uma confirmação enviada."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    paciente_nome = serializers.CharField(
        source="agendamento.paciente.nome_completo", read_only=True, default=None
    )
    data_consulta = serializers.DateField(
        source="agendamento.data", read_only=True, default=None
    )

    class Meta:
        model = MensagemConfirmacao
        fields = [
            "id",
            "agendamento",
            "paciente_nome",
            "data_consulta",
            "telefone",
            "destinatario_nome",
            "status",
            "status_display",
            "resposta_texto",
            "erro",
            "enviado_em",
            "respondido_em",
            "criado_em",
        ]
        read_only_fields = fields
