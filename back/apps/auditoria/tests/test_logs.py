"""Testes da trilha de auditoria (endpoint /api/logs/).

Cobrem o controle de acesso (DIREÇÃO/superusuário) e a leitura/filtragem dos
eventos que o django-auditlog captura automaticamente ao salvar/excluir models.
"""
import pytest
from auditlog.models import LogEntry
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import Papel

Usuario = get_user_model()
SENHA = "SenhaForte123!"
pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def cria_usuario(db):
    def _cria(email, role=Papel.PROFISSIONAL, **extra):
        extra.setdefault("nome", "Usuário de Teste")
        return Usuario.objects.create_user(
            email=email, password=SENHA, role=role, **extra
        )

    return _cria


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario(email="direcao@clinica.com", role=Papel.DIRECAO)


@pytest.fixture
def profissional(cria_usuario):
    return cria_usuario(email="profissional@clinica.com", role=Papel.PROFISSIONAL)


@pytest.fixture
def superuser(db):
    # Superusuário técnico com papel não-DIREÇÃO: valida a regra "OU is_superuser".
    return Usuario.objects.create_user(
        email="root@clinica.com",
        password=SENHA,
        nome="Root",
        role=Papel.PROFISSIONAL,
        is_superuser=True,
        is_staff=True,
    )


class TestAcessoLogs:
    def test_anonimo_recebe_401(self, api_client):
        assert api_client.get(reverse("log-list")).status_code == 401

    def test_profissional_recebe_403(self, api_client, profissional):
        api_client.force_authenticate(user=profissional)
        assert api_client.get(reverse("log-list")).status_code == 403

    def test_direcao_acessa(self, api_client, direcao):
        api_client.force_authenticate(user=direcao)
        assert api_client.get(reverse("log-list")).status_code == 200

    def test_superuser_acessa(self, api_client, superuser):
        api_client.force_authenticate(user=superuser)
        assert api_client.get(reverse("log-list")).status_code == 200


class TestLeituraLogs:
    def test_lista_paginada_com_shape_pt_br(self, api_client, direcao):
        # criar o próprio 'direcao' já gerou um LogEntry (create de usuario).
        api_client.force_authenticate(user=direcao)
        resp = api_client.get(reverse("log-list"))
        assert resp.status_code == 200
        # resposta paginada (count/next/previous/results) — só neste endpoint.
        assert set(resp.data) >= {"count", "next", "previous", "results"}
        assert resp.data["count"] >= 1
        item = resp.data["results"][0]
        assert {
            "acao",
            "acao_label",
            "tabela",
            "tabela_label",
            "objeto_id",
            "usuario",
            "data_hora",
            "alteracoes",
        } <= set(item)

    def test_filtra_por_tabela(self, api_client, direcao):
        api_client.force_authenticate(user=direcao)
        resp = api_client.get(reverse("log-list"), {"tabela": "usuario"})
        assert resp.status_code == 200
        assert resp.data["count"] >= 1
        assert all(r["tabela"] == "usuario" for r in resp.data["results"])
        # tabela inexistente na trilha → vazio
        vazio = api_client.get(reverse("log-list"), {"tabela": "session"})
        assert vazio.data["count"] == 0

    def test_filtra_por_usuario(self, api_client, direcao, profissional):
        # Carimba um evento com o autor 'direcao' para testar o filtro de usuário.
        evento = LogEntry.objects.filter(content_type__model="usuario").first()
        evento.actor = direcao
        evento.save(update_fields=["actor"])

        api_client.force_authenticate(user=direcao)
        resp = api_client.get(reverse("log-list"), {"usuario": direcao.id})
        assert resp.status_code == 200
        assert resp.data["count"] >= 1
        assert all(r["usuario"]["id"] == direcao.id for r in resp.data["results"])

    def test_action_modelos_lista_tabelas(self, api_client, direcao):
        api_client.force_authenticate(user=direcao)
        resp = api_client.get(reverse("log-modelos"))
        assert resp.status_code == 200
        tabelas = {m["tabela"] for m in resp.data}
        assert "usuario" in tabelas


class TestAutorViaJWT:
    """Garante que alterações feitas via API (JWT) gravam o autor, não 'Sistema'."""

    def test_autor_capturado_em_alteracao_via_api(self, api_client, direcao):
        # Request autenticado por Bearer token (como o front faz), e não por
        # force_authenticate: exercita o AuditlogUserMiddleware resolvendo o JWT.
        token = str(AccessToken.for_user(direcao))
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        resp = api_client.post(
            reverse("usuario-list"),
            {
                "nome": "Criado via API",
                "email": "via_api@clinica.com",
                "role": Papel.RECEPCAO,
                "password": SENHA,
            },
            format="json",
        )
        assert resp.status_code == 201, resp.data
        log = LogEntry.objects.filter(
            content_type__model="usuario", object_pk=str(resp.data["id"]), action=0
        ).first()
        assert log is not None
        assert log.actor_id == direcao.id  # e não None ("Sistema")
