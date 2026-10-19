"""Testes dos e-mails transacionais (Resend) e do fluxo "esqueci minha senha"."""
from urllib.parse import parse_qs, urlparse

import pytest
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.urls import reverse
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.tests.conftest import SENHA_PADRAO
from config.email_backend import ResendEmailBackend, montar_payload

NOVA_SENHA = "OutraSenhaForte456!"
REMETENTE = "Clínica da Aprendizagem <no-reply@clinicadaaprendizagem.com.br>"


@pytest.fixture(autouse=True)
def limpa_throttle():
    """O limite por IP do reset fica no cache; isola cada teste."""
    cache.clear()
    yield
    cache.clear()


def _html(mensagem) -> str:
    return next(c for c, mimetype in mensagem.alternatives if mimetype == "text/html")


def _uid_token(mensagem) -> dict:
    """Extrai uid/token do link presente no corpo em texto do e-mail."""
    link = next(p for p in mensagem.body.split() if p.startswith("http"))
    query = parse_qs(urlparse(link).query)
    return {"uid": query["uid"][0], "token": query["token"][0]}


# --- Backend do Resend -------------------------------------------------------

class TestResendBackend:
    def test_payload_com_html_e_texto(self):
        msg = EmailMultiAlternatives(
            "Assunto", "corpo texto", REMETENTE, ["a@clinica.com"], reply_to=["r@c.com"]
        )
        msg.attach_alternative("<p>corpo html</p>", "text/html")

        payload = montar_payload(msg)

        assert payload == {
            "from": REMETENTE,
            "to": ["a@clinica.com"],
            "subject": "Assunto",
            "reply_to": ["r@c.com"],
            "text": "corpo texto",
            "html": "<p>corpo html</p>",
        }

    def test_payload_de_mensagem_somente_html(self):
        msg = EmailMessage("Assunto", "<b>oi</b>", REMETENTE, ["a@clinica.com"])
        msg.content_subtype = "html"

        payload = montar_payload(msg)

        assert payload["html"] == "<b>oi</b>"
        assert "text" not in payload

    def test_anexo_falha_explicitamente(self):
        msg = EmailMessage("A", "b", REMETENTE, ["a@clinica.com"])
        msg.attach("x.txt", "conteudo", "text/plain")

        with pytest.raises(ValueError):
            montar_payload(msg)

    def test_envia_pela_api_do_resend(self, monkeypatch):
        chamadas = []
        monkeypatch.setattr(
            "resend.Emails.send", lambda params: chamadas.append(params) or {"id": "1"}
        )
        backend = ResendEmailBackend(api_key="re_teste")

        enviados = backend.send_messages(
            [EmailMessage("A", "b", REMETENTE, ["a@clinica.com"])]
        )

        assert enviados == 1
        assert chamadas[0]["to"] == ["a@clinica.com"]

    def test_sem_chave_levanta_improperly_configured(self, settings):
        settings.RESEND_API_KEY = ""
        backend = ResendEmailBackend()

        with pytest.raises(ImproperlyConfigured):
            backend.send_messages([EmailMessage("A", "b", REMETENTE, ["a@c.com"])])

    def test_falha_da_api_propaga_ou_e_silenciada(self, monkeypatch):
        def falha(params):
            raise RuntimeError("API fora do ar")

        monkeypatch.setattr("resend.Emails.send", falha)
        msg = EmailMessage("A", "b", REMETENTE, ["a@c.com"])

        with pytest.raises(RuntimeError):
            ResendEmailBackend(api_key="re_teste").send_messages([msg])
        silencioso = ResendEmailBackend(api_key="re_teste", fail_silently=True)
        assert silencioso.send_messages([msg]) == 0


# --- Convite -----------------------------------------------------------------

def test_convite_sai_em_html_com_link_e_remetente(api_client, direcao, cria_usuario, settings):
    settings.DEFAULT_FROM_EMAIL = REMETENTE
    convidado = cria_usuario(email="novo@clinica.com", nome="Maria Souza")
    api_client.force_authenticate(user=direcao)

    resp = api_client.post(reverse("usuario-enviar-convite", args=[convidado.pk]))

    assert resp.status_code == 200
    msg = mail.outbox[0]
    assert msg.from_email == REMETENTE
    assert "/convite?uid=" in msg.body
    html = _html(msg)
    assert "Boas-vindas, Maria!" in html
    assert "/convite?uid=" in html


def test_email_traz_logo_absoluta_do_frontend(api_client, direcao, cria_usuario, settings):
    settings.FRONTEND_URL = "https://app.clinica.test/"
    convidado = cria_usuario(email="logo@clinica.com", nome="Ana Lima")
    api_client.force_authenticate(user=direcao)

    api_client.post(reverse("usuario-enviar-convite", args=[convidado.pk]))

    assert 'src="https://app.clinica.test/logo-email.png"' in _html(mail.outbox[0])


def test_convite_com_falha_no_envio_responde_503(api_client, direcao, cria_usuario, monkeypatch):
    def falha(usuario):
        raise RuntimeError("Resend fora do ar")

    monkeypatch.setattr("apps.accounts.views.enviar_convite", falha)
    convidado = cria_usuario(email="novo@clinica.com")
    api_client.force_authenticate(user=direcao)

    resp = api_client.post(reverse("usuario-enviar-convite", args=[convidado.pk]))

    assert resp.status_code == 503
    assert "Reenviar convite" in resp.data["detail"]


# --- Esqueci minha senha: solicitação ----------------------------------------

class TestSolicitarRedefinicao:
    url = reverse("auth-password-reset")

    def test_envia_link_para_conta_ativa(self, api_client, usuario):
        resp = api_client.post(self.url, {"email": usuario.email.upper()}, format="json")

        assert resp.status_code == 200
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == [usuario.email]
        assert "/redefinir-senha?uid=" in msg.body
        assert "Redefinir minha senha" in _html(msg)

    def test_email_desconhecido_responde_igual_sem_enviar(self, api_client, usuario):
        resp_existente = api_client.post(self.url, {"email": usuario.email}, format="json")
        resp_desconhecido = api_client.post(
            self.url, {"email": "ninguem@clinica.com"}, format="json"
        )

        assert resp_desconhecido.status_code == 200
        assert resp_desconhecido.data == resp_existente.data
        assert len(mail.outbox) == 1

    def test_conta_desativada_nao_recebe(self, api_client, cria_usuario):
        inativo = cria_usuario(email="inativo@clinica.com", is_active=False)

        resp = api_client.post(self.url, {"email": inativo.email}, format="json")

        assert resp.status_code == 200
        assert mail.outbox == []

    def test_falha_no_envio_nao_vaza_para_a_resposta(self, api_client, usuario, monkeypatch):
        def falha(u):
            raise RuntimeError("Resend fora do ar")

        monkeypatch.setattr("apps.accounts.views.enviar_redefinicao_senha", falha)

        resp = api_client.post(self.url, {"email": usuario.email}, format="json")

        assert resp.status_code == 200

    def test_limite_de_tentativas_por_ip(self, api_client, usuario, monkeypatch):
        monkeypatch.setattr(
            ScopedRateThrottle,
            "THROTTLE_RATES",
            {**ScopedRateThrottle.THROTTLE_RATES, "password_reset": "2/hour"},
        )

        codigos = [
            api_client.post(self.url, {"email": usuario.email}, format="json").status_code
            for _ in range(3)
        ]

        assert codigos == [200, 200, 429]


# --- Esqueci minha senha: confirmação ----------------------------------------

class TestConfirmarRedefinicao:
    url = reverse("auth-password-reset-confirm")

    def _solicitar(self, api_client, usuario) -> dict:
        api_client.post(reverse("auth-password-reset"), {"email": usuario.email}, format="json")
        dados = _uid_token(mail.outbox[-1])
        mail.outbox.clear()
        return dados

    def test_redefine_senha_avisa_e_encerra_sessoes(self, api_client, cria_usuario):
        usuario = cria_usuario(precisa_trocar_senha=True)
        sessao_antiga = RefreshToken.for_user(usuario)
        dados = self._solicitar(api_client, usuario)

        resp = api_client.post(self.url, {**dados, "nova_senha": NOVA_SENHA}, format="json")

        assert resp.status_code == 200, resp.data
        usuario.refresh_from_db()
        assert usuario.check_password(NOVA_SENHA)
        assert usuario.precisa_trocar_senha is False
        assert BlacklistedToken.objects.filter(token__jti=sessao_antiga["jti"]).exists()
        assert len(mail.outbox) == 1
        assert "Sua senha foi alterada" in _html(mail.outbox[0])

    def test_link_nao_pode_ser_reutilizado(self, api_client, usuario):
        dados = self._solicitar(api_client, usuario)
        api_client.post(self.url, {**dados, "nova_senha": NOVA_SENHA}, format="json")

        resp = api_client.post(
            self.url, {**dados, "nova_senha": "TerceiraSenha789!"}, format="json"
        )

        assert resp.status_code == 400

    def test_token_invalido(self, api_client, usuario):
        dados = self._solicitar(api_client, usuario)

        resp = api_client.post(
            self.url, {**dados, "token": "invalido", "nova_senha": NOVA_SENHA}, format="json"
        )

        assert resp.status_code == 400
        usuario.refresh_from_db()
        assert usuario.check_password(SENHA_PADRAO)

    def test_conta_desativada_nao_redefine(self, api_client, usuario):
        dados = self._solicitar(api_client, usuario)
        usuario.is_active = False
        usuario.save(update_fields=["is_active"])

        resp = api_client.post(self.url, {**dados, "nova_senha": NOVA_SENHA}, format="json")

        assert resp.status_code == 400

    def test_senha_fraca_e_recusada(self, api_client, usuario):
        dados = self._solicitar(api_client, usuario)

        resp = api_client.post(self.url, {**dados, "nova_senha": "123"}, format="json")

        assert resp.status_code == 400


def test_troca_de_senha_envia_aviso(api_client, usuario):
    api_client.force_authenticate(user=usuario)

    resp = api_client.post(
        reverse("auth-change-password"),
        {"senha_atual": SENHA_PADRAO, "nova_senha": NOVA_SENHA},
        format="json",
    )

    assert resp.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject.startswith("Sua senha foi alterada")
