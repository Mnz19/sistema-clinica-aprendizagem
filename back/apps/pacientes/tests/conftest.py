"""Fixtures dos testes do módulo de pacientes."""
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
    def _cria(email, senha=SENHA_PADRAO, role=Papel.PROFISSIONAL, **extra):
        extra.setdefault("nome", "Usuário de Teste")
        return django_user_model.objects.create_user(
            email=email, password=senha, role=role, **extra
        )

    return _cria


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario("direcao@clinica.com", role=Papel.DIRECAO)


@pytest.fixture
def recepcao(cria_usuario):
    return cria_usuario("recepcao@clinica.com", role=Papel.RECEPCAO)


@pytest.fixture
def financeiro(cria_usuario):
    return cria_usuario("financeiro@clinica.com", role=Papel.FINANCEIRO)


@pytest.fixture
def prof_a(cria_usuario):
    return cria_usuario("prof.a@clinica.com", role=Papel.PROFISSIONAL, nome="Profissional A")


@pytest.fixture
def prof_b(cria_usuario):
    return cria_usuario("prof.b@clinica.com", role=Papel.PROFISSIONAL, nome="Profissional B")


@pytest.fixture
def cliente(api_client):
    def _login(usuario):
        api_client.force_authenticate(user=usuario)
        return api_client

    return _login


@pytest.fixture
def cria_paciente(db):
    def _cria(nome="João da Silva", data_nascimento="2015-05-10", profissionais=None, **extra):
        paciente = Paciente.objects.create(
            nome_completo=nome, data_nascimento=data_nascimento, **extra
        )
        if profissionais:
            paciente.profissionais.set(profissionais)
        return paciente

    return _cria
