"""
Modelos da integração com o Google Agenda.

- ``ContaGoogle`` : vínculo OAuth de um profissional com o Google Agenda dele.
  Guarda o refresh token (criptografado) e o access token em cache. Um por
  usuário (OneToOne). Enquanto ``ativa`` estiver ``True``, os agendamentos do
  profissional são espelhados no calendário.
- ``EventoGoogle``: mapa entre um ``Agendamento`` da clínica e o evento criado
  no Google (``google_event_id``), guardando também em qual conta/calendário ele
  vive — o que permite detectar a transferência para outro profissional.

Design deliberadamente desacoplado: o app de ``clinica`` não conhece o Google.
Nenhum campo foi adicionado ao ``Agendamento``; toda a ligação vive aqui.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.google_agenda import crypto


class ContaGoogle(models.Model):
    """Conta Google conectada por um profissional (OAuth 2.0)."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conta_google",
        verbose_name="usuário",
    )
    email_google = models.EmailField(
        "e-mail da conta Google",
        blank=True,
        help_text="E-mail da conta Google autorizada (para exibição).",
    )
    # Refresh token: credencial de longa duração, guardada SEMPRE criptografada
    # (ver apps.google_agenda.crypto). Nunca exposto em serializers/logs.
    refresh_token_cifrado = models.TextField("refresh token (cifrado)")
    # Access token em cache + validade, para evitar um refresh a cada sincronização.
    access_token = models.TextField("access token", blank=True)
    access_token_expira_em = models.DateTimeField(
        "access token expira em", null=True, blank=True
    )
    scopes = models.TextField("escopos concedidos", blank=True)
    calendar_id = models.CharField(
        "ID do calendário",
        max_length=255,
        default="primary",
        help_text="Calendário de destino no Google (padrão: agenda principal).",
    )
    ativa = models.BooleanField(
        "sincronização ativa",
        default=True,
        help_text="Quando desligada, os agendamentos deixam de ser enviados ao Google.",
    )

    conectada_em = models.DateTimeField("conectada em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Conta Google"
        verbose_name_plural = "Contas Google"

    def __str__(self) -> str:
        return f"{self.usuario} → {self.email_google or 'Google Agenda'}"

    # --- Refresh token (nunca em texto puro) ---------------------------------
    def definir_refresh_token(self, valor: str) -> None:
        """Criptografa e guarda o refresh token."""
        self.refresh_token_cifrado = crypto.criptografar(valor)

    @property
    def refresh_token(self) -> str:
        """Refresh token em claro (descriptografado sob demanda)."""
        return crypto.descriptografar(self.refresh_token_cifrado)


class EventoGoogle(models.Model):
    """Vínculo entre um ``Agendamento`` e o evento correspondente no Google."""

    agendamento = models.OneToOneField(
        "clinica.Agendamento",
        on_delete=models.CASCADE,
        related_name="evento_google",
        verbose_name="agendamento",
    )
    conta = models.ForeignKey(
        ContaGoogle,
        on_delete=models.CASCADE,
        related_name="eventos",
        verbose_name="conta Google",
        help_text="Conta/calendário onde o evento foi criado.",
    )
    google_event_id = models.CharField("ID do evento no Google", max_length=1024)
    ultima_sincronizacao = models.DateTimeField(
        "última sincronização", auto_now=True
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "Evento no Google"
        verbose_name_plural = "Eventos no Google"

    def __str__(self) -> str:
        return f"Agendamento #{self.agendamento_id} → {self.google_event_id}"
