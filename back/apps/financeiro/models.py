"""
Modelos do módulo financeiro.

- ``PagamentoAgendamento``: baixa de pagamento de uma consulta atendida.
  Vinculada 1:1 ao Agendamento. Armazena snapshot do valor_repasse no momento
  do registro para preservar histórico mesmo que o Servico seja editado depois.
"""
from django.conf import settings
from django.db import models


class FormaPagamento(models.TextChoices):
    DINHEIRO       = "DINHEIRO",       "Dinheiro"
    PIX            = "PIX",            "Pix"
    CARTAO_CREDITO = "CARTAO_CREDITO", "Cartão de Crédito"
    CARTAO_DEBITO  = "CARTAO_DEBITO",  "Cartão de Débito"
    CONVENIO       = "CONVENIO",       "Convênio"


class PagamentoAgendamento(models.Model):
    """Baixa de pagamento de uma consulta atendida."""

    agendamento = models.OneToOneField(
        "clinica.Agendamento",
        on_delete=models.PROTECT,
        related_name="pagamento",
        verbose_name="agendamento",
    )
    valor_pago = models.DecimalField("valor pago", max_digits=10, decimal_places=2)
    forma_pagamento = models.CharField(
        "forma de pagamento", max_length=15, choices=FormaPagamento.choices
    )
    valor_repasse_calculado = models.DecimalField(
        "repasse calculado",
        max_digits=10,
        decimal_places=2,
        help_text="Snapshot do repasse do serviço no momento da baixa.",
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pagamentos_registrados",
        verbose_name="registrado por",
    )
    criado_em = models.DateTimeField("registrado em", auto_now_add=True)

    class Meta:
        verbose_name = "Pagamento"
        verbose_name_plural = "Pagamentos"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"Pagamento #{self.agendamento_id} — R$ {self.valor_pago}"
