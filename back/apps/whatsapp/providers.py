"""
Integração de envio de WhatsApp.

Abstrai o provedor atrás de uma interface simples. Em produção usa o
**WhatsApp Cloud API (Meta)**; sem credenciais (dev/teste), cai num provedor
**simulado** que apenas registra a mensagem — assim o fluxo roda de ponta a
ponta sem depender da Meta.

Usa apenas a biblioteca padrão (``urllib``) para não adicionar dependências.
"""
import json
import logging
import uuid
from urllib import error as urllib_error
from urllib import request as urllib_request

from django.conf import settings

logger = logging.getLogger(__name__)


class WhatsAppError(Exception):
    """Falha no envio de uma mensagem de WhatsApp."""


class WhatsAppProvider:
    """Interface de um provedor de envio."""

    def enviar_template(self, telefone, template_nome, idioma, parametros):
        """Envia uma mensagem de template e retorna o id da mensagem."""
        raise NotImplementedError

    def enviar_texto(self, telefone, texto):
        """Envia uma mensagem de texto simples (dentro da janela de 24h)."""
        raise NotImplementedError


class SimuladoProvider(WhatsAppProvider):
    """Provedor de desenvolvimento: não envia nada, apenas registra no log."""

    def enviar_template(self, telefone, template_nome, idioma, parametros):
        msg_id = f"SIMULADO-{uuid.uuid4().hex[:16]}"
        logger.info(
            "[WhatsApp SIMULADO] template=%s idioma=%s para=%s params=%s id=%s",
            template_nome, idioma, telefone, parametros, msg_id,
        )
        return msg_id

    def enviar_texto(self, telefone, texto):
        msg_id = f"SIMULADO-{uuid.uuid4().hex[:16]}"
        logger.info("[WhatsApp SIMULADO] texto para=%s: %s (id=%s)", telefone, texto, msg_id)
        return msg_id


class MetaCloudProvider(WhatsAppProvider):
    """Provedor oficial WhatsApp Cloud API (Meta / Graph API)."""

    def __init__(self, token, phone_number_id, api_version="v21.0"):
        self.token = token
        self.phone_number_id = phone_number_id
        self.api_version = api_version

    @property
    def _url(self):
        return (
            f"https://graph.facebook.com/{self.api_version}/"
            f"{self.phone_number_id}/messages"
        )

    def _post(self, payload):
        dados = json.dumps(payload).encode("utf-8")
        req = urllib_request.Request(
            self._url,
            data=dados,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib_request.urlopen(req, timeout=15) as resp:
                corpo = json.loads(resp.read().decode("utf-8"))
        except urllib_error.HTTPError as exc:
            detalhe = exc.read().decode("utf-8", errors="ignore")
            raise WhatsAppError(f"Meta retornou {exc.code}: {detalhe}") from exc
        except urllib_error.URLError as exc:
            raise WhatsAppError(f"Falha de conexão com a Meta: {exc.reason}") from exc

        try:
            return corpo["messages"][0]["id"]
        except (KeyError, IndexError):
            raise WhatsAppError(f"Resposta inesperada da Meta: {corpo}")

    def enviar_template(self, telefone, template_nome, idioma, parametros):
        payload = {
            "messaging_product": "whatsapp",
            "to": telefone,
            "type": "template",
            "template": {
                "name": template_nome,
                "language": {"code": idioma},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": str(p)} for p in parametros
                        ],
                    }
                ],
            },
        }
        return self._post(payload)

    def enviar_texto(self, telefone, texto):
        payload = {
            "messaging_product": "whatsapp",
            "to": telefone,
            "type": "text",
            "text": {"body": texto},
        }
        return self._post(payload)


def get_provider() -> WhatsAppProvider:
    """
    Retorna o provedor configurado.

    Usa a Meta Cloud API se ``WHATSAPP_TOKEN`` e ``WHATSAPP_PHONE_NUMBER_ID``
    estiverem definidos; caso contrário, o provedor simulado.
    """
    token = getattr(settings, "WHATSAPP_TOKEN", "")
    phone_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    if token and phone_id:
        return MetaCloudProvider(
            token=token,
            phone_number_id=phone_id,
            api_version=getattr(settings, "WHATSAPP_API_VERSION", "v21.0"),
        )
    return SimuladoProvider()


def modo_simulado() -> bool:
    """Indica se o envio está em modo simulado (sem credenciais da Meta)."""
    return isinstance(get_provider(), SimuladoProvider)
