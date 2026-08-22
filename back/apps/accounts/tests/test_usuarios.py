"""Testes de gestão de usuários (criação restrita à DIREÇÃO) e do modelo Usuario."""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from apps.accounts.models import Papel
from apps.accounts.tests.conftest import SENHA_PADRAO

Usuario = get_user_model()
pytestmark = pytest.mark.django_db


class TestModeloUsuario:
    def test_cria_usuario_com_email_normalizado(self, cria_usuario):
        u = cria_usuario(email="Fulano@Clinica.COM")
        # O domínio é normalizado para minúsculas pelo manager.
        assert u.email == "Fulano@clinica.com"
        assert u.check_password(SENHA_PADRAO)
        assert u.role == Papel.PROFISSIONAL

    def test_cria_superusuario_tem_papel_direcao(self, db):
        su = Usuario.objects.create_superuser(
            email="admin@clinica.com", password=SENHA_PADRAO, nome="Admin"
        )
        assert su.is_staff and su.is_superuser
        assert su.role == Papel.DIRECAO

    def test_email_sem_valor_gera_erro(self, db):
        with pytest.raises(ValueError):
            Usuario.objects.create_user(email="", password=SENHA_PADRAO)


class TestGestaoUsuarios:
    def test_direcao_cria_usuario(self, api_client, direcao):
        api_client.force_authenticate(user=direcao)
        resp = api_client.post(
            reverse("usuario-list"),
            {
                "nome": "Nova Recepção",
                "email": "recepcao@clinica.com",
                "role": Papel.RECEPCAO,
                "password": SENHA_PADRAO,
            },
            format="json",
        )
        assert resp.status_code == 201
        criado = Usuario.objects.get(email="recepcao@clinica.com")
        assert criado.role == Papel.RECEPCAO
        # A senha nunca é devolvida e é armazenada com hash.
        assert "password" not in resp.data
        assert criado.check_password(SENHA_PADRAO)

    def test_supervisao_pode_listar_usuarios(self, api_client, cria_usuario):
        supervisor = cria_usuario(email="sup@clinica.com", role=Papel.SUPERVISAO)
        api_client.force_authenticate(user=supervisor)
        resp = api_client.get(reverse("usuario-list"))
        assert resp.status_code == 200

    def test_profissional_nao_pode_listar_usuarios(self, cliente_autenticado):
        resp = cliente_autenticado.get(reverse("usuario-list"))
        assert resp.status_code == 403

    def test_recepcao_nao_pode_listar_usuarios(self, api_client, cria_usuario):
        recep = cria_usuario(email="rec@clinica.com", role=Papel.RECEPCAO)
        api_client.force_authenticate(user=recep)
        assert api_client.get(reverse("usuario-list")).status_code == 403

    def test_anonimo_nao_pode_criar_usuario(self, api_client):
        resp = api_client.post(reverse("usuario-list"), {}, format="json")
        assert resp.status_code == 401

    def test_delete_desativa_usuario(self, api_client, direcao, cria_usuario):
        alvo = cria_usuario(email="alvo@clinica.com", role=Papel.PROFISSIONAL)
        api_client.force_authenticate(user=direcao)
        resp = api_client.delete(reverse("usuario-detail", args=[alvo.id]))
        assert resp.status_code == 204
        alvo.refresh_from_db()
        assert alvo.is_active is False  # exclusão lógica
        assert Usuario.objects.filter(id=alvo.id).exists()

    def test_direcao_nao_desativa_a_si_mesma(self, api_client, direcao):
        api_client.force_authenticate(user=direcao)
        resp = api_client.delete(reverse("usuario-detail", args=[direcao.id]))
        assert resp.status_code == 400
        direcao.refresh_from_db()
        assert direcao.is_active is True

    def test_reativar_usuario_via_patch(self, api_client, direcao, cria_usuario):
        alvo = cria_usuario(email="inativo@clinica.com", is_active=False)
        api_client.force_authenticate(user=direcao)
        resp = api_client.patch(
            reverse("usuario-detail", args=[alvo.id]),
            {"is_active": True},
            format="json",
        )
        assert resp.status_code == 200
        alvo.refresh_from_db()
        assert alvo.is_active is True
