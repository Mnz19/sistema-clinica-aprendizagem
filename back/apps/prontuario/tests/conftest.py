"""Fixtures dos testes do prontuário."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Papel
from apps.pacientes.models import Paciente

SENHA_PADRAO = "SenhaForte123!"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def cria_usuario(db, django_user_model):
    def _cria(email, role=Papel.PROFISSIONAL, **extra):
        extra.setdefault("nome", "Usuário de Teste")
        return django_user_model.objects.create_user(
            email=email, password=SENHA_PADRAO, role=role, **extra
        )

    return _cria


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario("direcao@clinica.com", role=Papel.DIRECAO)


@pytest.fixture
def supervisao(cria_usuario):
    return cria_usuario("sup@clinica.com", role=Papel.SUPERVISAO)


@pytest.fixture
def recepcao(cria_usuario):
    return cria_usuario("recep@clinica.com", role=Papel.RECEPCAO)


@pytest.fixture
def prof_a(cria_usuario):
    return cria_usuario("prof.a@clinica.com", role=Papel.PROFISSIONAL, nome="Prof A")


@pytest.fixture
def prof_b(cria_usuario):
    return cria_usuario("prof.b@clinica.com", role=Papel.PROFISSIONAL, nome="Prof B")


@pytest.fixture
def cliente(api_client):
    def _login(usuario):
        api_client.force_authenticate(user=usuario)
        return api_client

    return _login


@pytest.fixture
def cria_paciente(db):
    def _cria(nome="Paciente Teste", profissionais=None, **extra):
        p = Paciente.objects.create(
            nome_completo=nome, data_nascimento="2015-05-10", **extra
        )
        if profissionais:
            p.profissionais.set(profissionais)
        return p

    return _cria
