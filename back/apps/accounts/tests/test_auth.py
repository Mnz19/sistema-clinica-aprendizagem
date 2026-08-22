"""Testes dos fluxos de autenticação (login, refresh, logout, /me, troca de senha)."""
import pytest
from django.urls import reverse

from apps.accounts.models import LogAcesso
from apps.accounts.tests.conftest import SENHA_PADRAO

pytestmark = pytest.mark.django_db


class TestLogin:
    def test_login_ok_retorna_tokens_e_usuario(self, api_client, usuario):
        url = reverse("auth-login")
        resp = api_client.post(
            url, {"email": usuario.email, "password": SENHA_PADRAO}, format="json"
        )
        assert resp.status_code == 200
        assert "access" in resp.data
        assert "refresh" in resp.data
        assert resp.data["user"]["email"] == usuario.email
        assert resp.data["user"]["role"] == usuario.role

    def test_login_ok_registra_log_de_acesso(self, api_client, usuario):
        api_client.post(
            reverse("auth-login"),
            {"email": usuario.email, "password": SENHA_PADRAO},
            format="json",
        )
        log = LogAcesso.objects.latest("data_hora")
        assert log.sucesso is True
        assert log.usuario == usuario
        assert log.email_informado == usuario.email

    def test_login_senha_invalida_retorna_401_e_registra_falha(
        self, api_client, usuario
    ):
        resp = api_client.post(
            reverse("auth-login"),
            {"email": usuario.email, "password": "errada"},
            format="json",
        )
        assert resp.status_code == 401
        log = LogAcesso.objects.latest("data_hora")
        assert log.sucesso is False
        assert log.usuario is None

    def test_login_usuario_inexistente_retorna_401(self, api_client):
        resp = api_client.post(
            reverse("auth-login"),
            {"email": "naoexiste@clinica.com", "password": "x"},
            format="json",
        )
        assert resp.status_code == 401


class TestRefresh:
    def test_refresh_gera_novo_access(self, api_client, usuario):
        login = api_client.post(
            reverse("auth-login"),
            {"email": usuario.email, "password": SENHA_PADRAO},
            format="json",
        )
        refresh = login.data["refresh"]
        resp = api_client.post(
            reverse("auth-refresh"), {"refresh": refresh}, format="json"
        )
        assert resp.status_code == 200
        assert "access" in resp.data


class TestMe:
    def test_me_autenticado_retorna_dados(self, cliente_autenticado, usuario):
        resp = cliente_autenticado.get(reverse("auth-me"))
        assert resp.status_code == 200
        assert resp.data["email"] == usuario.email
        assert resp.data["nome"] == usuario.nome
        assert resp.data["role"] == usuario.role

    def test_me_nao_autenticado_retorna_401(self, api_client):
        resp = api_client.get(reverse("auth-me"))
        assert resp.status_code == 401


class TestLogout:
    def test_logout_blacklista_refresh(self, api_client, usuario):
        login = api_client.post(
            reverse("auth-login"),
            {"email": usuario.email, "password": SENHA_PADRAO},
            format="json",
        )
        refresh = login.data["refresh"]
        api_client.force_authenticate(user=usuario)

        resp = api_client.post(
            reverse("auth-logout"), {"refresh": refresh}, format="json"
        )
        assert resp.status_code == 205

        # O refresh não deve mais ser aceito após a blacklist.
        api_client.force_authenticate(user=None)
        novo = api_client.post(
            reverse("auth-refresh"), {"refresh": refresh}, format="json"
        )
        assert novo.status_code == 401


class TestTrocaSenha:
    def test_troca_senha_com_sucesso(self, cliente_autenticado, usuario):
        nova = "OutraSenha456!"
        resp = cliente_autenticado.post(
            reverse("auth-change-password"),
            {"senha_atual": SENHA_PADRAO, "nova_senha": nova},
            format="json",
        )
        assert resp.status_code == 200
        usuario.refresh_from_db()
        assert usuario.check_password(nova)

    def test_troca_senha_atual_incorreta(self, cliente_autenticado):
        resp = cliente_autenticado.post(
            reverse("auth-change-password"),
            {"senha_atual": "errada", "nova_senha": "OutraSenha456!"},
            format="json",
        )
        assert resp.status_code == 400

    def test_troca_senha_exige_autenticacao(self, api_client):
        resp = api_client.post(
            reverse("auth-change-password"),
            {"senha_atual": "x", "nova_senha": "y"},
            format="json",
        )
        assert resp.status_code == 401
