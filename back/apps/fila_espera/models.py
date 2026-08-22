"""
Modelos do módulo de fila de espera.

- ``FilaEspera``: paciente aguardando horário disponível. Ordenação FIFO
  (por ``criado_em``). Quando convertido em agendamento, ``status`` passa
  para ``CONVERTIDO`` e ``agendamento_resultado`` aponta para o agendamento criado.
"""
from django.conf import settings
from django.db import models


class StatusFila(models.TextChoices):
    AGUARDANDO = "AGUARDANDO", "Aguardando"
    CONVERTIDO = "CONVERTIDO", "Convertido"
    RECUSADO   = "RECUSADO",   "Recusado"


class FilaEspera(models.Model):
    """Entrada de paciente na fila de espera por horário disponível."""

    paciente = models.ForeignKey(
        "pacientes.Paciente",
        on_delete=models.PROTECT,
        related_name="fila_espera",
        verbose_name="paciente",
    )
    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fila_espera",
        verbose_name="profissional preferido",
    )
    especialidade = models.ForeignKey(
        "accounts.Especialidade",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fila_espera",
        verbose_name="especialidade preferida",
    )
    preferencia_horario = models.TextField("preferência de horário", blank=True)
    observacoes = models.TextField("observações", blank=True)
    status = models.CharField(
        "status", max_length=10, choices=StatusFila.choices, default=StatusFila.AGUARDANDO, db_index=True
    )
    agendamento_resultado = models.ForeignKey(
        "clinica.Agendamento",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="origem_fila",
        verbose_name="agendamento gerado",
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Fila de espera"
        verbose_name_plural = "Fila de espera"
        ordering = ["criado_em"]  # FIFO

    def __str__(self) -> str:
        return f"{self.paciente} — {self.get_status_display()}"
