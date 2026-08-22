from rest_framework import serializers

from apps.financeiro.models import PagamentoAgendamento


class PagamentoAgendamentoSerializer(serializers.ModelSerializer):
    registrado_por_nome = serializers.CharField(
        source="registrado_por.nome", read_only=True
    )

    class Meta:
        model = PagamentoAgendamento
        fields = [
            "id",
            "agendamento",
            "valor_pago",
            "forma_pagamento",
            "valor_repasse_calculado",
            "registrado_por",
            "registrado_por_nome",
            "criado_em",
        ]
        read_only_fields = ["id", "valor_repasse_calculado", "registrado_por", "criado_em"]
