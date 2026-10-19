"""
Backend de e-mail do Django que envia pela API HTTP do Resend.

Plugado via ``EMAIL_BACKEND``: todo ``send_mail`` / ``EmailMultiAlternatives`` do
projeto passa a sair pelo Resend sem que o código de negócio conheça o provedor.
Usa HTTPS (443) em vez de SMTP, o que evita bloqueios de porta na VPS.

Anexos ainda não são suportados (nenhum fluxo envia anexo hoje); uma mensagem com
anexo falha explicitamente em vez de sair sem ele.
"""
import logging

import resend
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import EmailMessage

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    """Envia cada ``EmailMessage`` como uma chamada a ``POST /emails`` do Resend."""

    def __init__(self, fail_silently: bool = False, api_key: str | None = None, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = api_key or getattr(settings, "RESEND_API_KEY", "")

    def send_messages(self, email_messages: list[EmailMessage]) -> int:
        if not email_messages:
            return 0
        if not self.api_key:
            raise ImproperlyConfigured(
                "RESEND_API_KEY não definida: configure a chave para enviar e-mails."
            )
        resend.api_key = self.api_key

        enviados = 0
        for mensagem in email_messages:
            if self._enviar(mensagem):
                enviados += 1
        return enviados

    def _enviar(self, mensagem: EmailMessage) -> bool:
        try:
            resposta = resend.Emails.send(montar_payload(mensagem))
        except Exception:
            # Não registra destinatários no log (dado pessoal — LGPD).
            logger.exception("Falha ao enviar e-mail pelo Resend: %r", mensagem.subject)
            if not self.fail_silently:
                raise
            return False
        logger.info("E-mail enviado pelo Resend (id=%s).", resposta.get("id"))
        return True


def montar_payload(mensagem: EmailMessage) -> dict:
    """Converte uma ``EmailMessage`` do Django no corpo esperado pela API do Resend."""
    if mensagem.attachments:
        raise ValueError("ResendEmailBackend ainda não suporta anexos.")

    payload: dict = {
        "from": mensagem.from_email or settings.DEFAULT_FROM_EMAIL,
        "to": list(mensagem.to),
        "subject": mensagem.subject,
    }
    if mensagem.cc:
        payload["cc"] = list(mensagem.cc)
    if mensagem.bcc:
        payload["bcc"] = list(mensagem.bcc)
    if mensagem.reply_to:
        payload["reply_to"] = list(mensagem.reply_to)
    if mensagem.extra_headers:
        payload["headers"] = dict(mensagem.extra_headers)

    corpo_html = _corpo_html(mensagem)
    if mensagem.content_subtype == "html":
        payload["html"] = mensagem.body
    else:
        payload["text"] = mensagem.body
        if corpo_html:
            payload["html"] = corpo_html
    return payload


def _corpo_html(mensagem: EmailMessage) -> str | None:
    """Retorna a alternativa ``text/html`` de um ``EmailMultiAlternatives``, se houver."""
    for conteudo, mimetype in getattr(mensagem, "alternatives", None) or []:
        if mimetype == "text/html":
            return conteudo
    return None
