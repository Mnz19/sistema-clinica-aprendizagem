"""Fixtures compartilhadas dos testes do app de contas."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Papel

SENHA_PADRAO = "SenhaForte123!"


@pytest.fixture
def api_client():
    """Cliente HTTP do DRF para chamar os endpoints."""
    return APIClient()


@pytest.fixture
def cria_usuario(db, django_user_model):
    """Fábrica de usuários para os testes."""

    def _cria(email="profissional@clinica.com", senha=SENHA_PADRAO, **extra):
        extra.setdefault("nome", "Usuário de Teste")
        extra.setdefault("role", Papel.PROFISSIONAL)
        return django_user_model.objects.create_user(
            email=email, password=senha, **extra
        )

    return _cria


@pytest.fixture
def usuario(cria_usuario):
    """Usuário comum (papel PROFISSIONAL)."""
    return cria_usuario()


@pytest.fixture
def direcao(cria_usuario):
    """Usuário com papel DIREÇÃO (acesso total)."""
    return cria_usuario(email="direcao@clinica.com", role=Papel.DIRECAO)


@pytest.fixture
def cliente_autenticado(api_client, usuario):
    """Cliente já autenticado como usuário comum via ``force_authenticate``."""
    api_client.force_authenticate(user=usuario)
    return api_client
