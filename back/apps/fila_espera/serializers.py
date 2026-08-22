from rest_framework import serializers

from apps.fila_espera.models import FilaEspera


class FilaEsperaSerializer(serializers.ModelSerializer):
    paciente_nome = serializers.CharField(source="paciente.nome_completo", read_only=True)
    paciente_telefone = serializers.CharField(source="paciente.telefone", read_only=True, default="")
    profissional_nome = serializers.CharField(source="profissional.nome", read_only=True, default=None)
    especialidade_nome = serializers.CharField(source="especialidade.nome", read_only=True, default=None)

    class Meta:
        model = FilaEspera
        fields = [
            "id",
            "paciente",
            "paciente_nome",
            "paciente_telefone",
            "profissional",
            "profissional_nome",
            "especialidade",
            "especialidade_nome",
            "preferencia_horario",
            "observacoes",
            "status",
            "agendamento_resultado",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "agendamento_resultado", "criado_em", "atualizado_em"]
