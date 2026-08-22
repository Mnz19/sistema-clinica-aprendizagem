"""
Modelos das confirmações de consulta por WhatsApp.

- ``ConfiguracaoConfirmacao`` : configuração única da clínica (quando e como
  enviar a confirmação: antecedência em dias + horário fixo do disparo, texto e
  template aprovado na Meta).
- ``MensagemConfirmacao``     : registro (log) de cada confirmação enviada para
  um agendamento, com status e a resposta do paciente (SIM/NÃO).
"""
from datetime import time

from django.db import models


class StatusMensagem(models.TextChoices):
    """Estados de uma mensagem de confirmação."""

    PENDENTE = "PENDENTE", "Pendente"
    ENVIADO = "ENVIADO", "Enviado"
    ENTREGUE = "ENTREGUE", "Entregue"
    LIDO = "LIDO", "Lido"
    ERRO = "ERRO", "Erro"
    RESPONDIDO_SIM = "RESPONDIDO_SIM", "Confirmado pelo paciente"
    RESPONDIDO_NAO = "RESPONDIDO_NAO", "Cancelado pelo paciente"


# Texto padrão da confirmação (usado no modo simulado e como prévia). Os
# marcadores são substituídos no envio; na Meta oficial, o texto real vem do
# template aprovado — aqui serve de referência/edição pela clínica.
MENSAGEM_PADRAO = (
    "Olá, {paciente}. Seu atendimento está agendado para {data} às {hora} "
    "com {profissional}. Responda SIM para confirmar ou NÃO para cancelar."
)


class ConfiguracaoConfirmacao(models.Model):
    """Configuração única (singleton) das confirmações por WhatsApp."""

    ativo = models.BooleanField(
        "envio ativo",
        default=True,
        help_text="Quando desligado, nenhuma confirmação automática é enviada.",
    )
    antecedencia_dias = models.PositiveSmallIntegerField(
        "antecedência (dias)",
        default=1,
        help_text="Quantos dias antes da consulta a confirmação é enviada (1 = véspera).",
    )
    horario_disparo = models.TimeField(
        "horário do disparo",
        default=time(9, 0),
        help_text="Horário em que a confirmação é enviada no dia do disparo.",
    )
    mensagem = models.TextField(
        "mensagem (prévia)",
        default=MENSAGEM_PADRAO,
        help_text=(
            "Texto exibido/usado no modo simulado. Marcadores: {paciente}, "
            "{data}, {hora}, {profissional}."
        ),
    )
    template_meta_nome = models.CharField(
        "template Meta (nome)",
        max_length=100,
        blank=True,
        help_text="Nome do template aprovado no WhatsApp Cloud API (Meta).",
    )
    template_meta_idioma = models.CharField(
        "template Meta (idioma)", max_length=10, default="pt_BR"
    )

    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Configuração de confirmação"
        verbose_name_plural = "Configuração de confirmação"

    def __str__(self) -> str:
        return "Configuração de confirmação por WhatsApp"

    def save(self, *args, **kwargs):
        # Força singleton: sempre pk=1.
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def carregar(cls) -> "ConfiguracaoConfirmacao":
        """Retorna a configuração única, criando-a com os padrões se necessário."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class MensagemConfirmacao(models.Model):
    """Registro de uma confirmação enviada para um agendamento."""

    agendamento = models.ForeignKey(
        "clinica.Agendamento",
        on_delete=models.CASCADE,
        related_name="confirmacoes",
        verbose_name="agendamento",
    )
    telefone = models.CharField("telefone (E.164)", max_length=20)
    destinatario_nome = models.CharField("destinatário", max_length=150, blank=True)
    status = models.CharField(
        "status",
        max_length=20,
        choices=StatusMensagem.choices,
        default=StatusMensagem.PENDENTE,
        db_index=True,
    )
    wa_message_id = models.CharField(
        "id da mensagem (Meta)", max_length=128, blank=True, db_index=True
    )
    resposta_texto = models.CharField("resposta recebida", max_length=255, blank=True)
    erro = models.TextField("erro", blank=True)

    enviado_em = models.DateTimeField("enviado em", null=True, blank=True)
    respondido_em = models.DateTimeField("respondido em", null=True, blank=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Mensagem de confirmação"
        verbose_name_plural = "Mensagens de confirmação"
        ordering = ["-criado_em"]
        indexes = [
            models.Index(fields=["telefone", "-criado_em"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"Confirmação {self.get_status_display()} — {self.destinatario_nome}"
