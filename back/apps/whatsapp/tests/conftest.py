"""Fixtures dos testes de confirmação por WhatsApp."""
from datetime import date, datetime, time

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento
from apps.pacientes.models import Paciente

SENHA = "SenhaForte123!"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def cria_usuario(db, django_user_model):
    def _cria(email, role=Papel.PROFISSIONAL, **extra):
        extra.setdefault("nome", "Fulano")
        return django_user_model.objects.create_user(
            email=email, password=SENHA, role=role, **extra
        )

    return _cria


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario("direcao@clinica.com", role=Papel.DIRECAO)


@pytest.fixture
def recepcao(cria_usuario):
    return cria_usuario("recep@clinica.com", role=Papel.RECEPCAO)


@pytest.fixture
def profissional(cria_usuario):
    return cria_usuario("prof@clinica.com", role=Papel.PROFISSIONAL, nome="Gabrielle")


@pytest.fixture
def cliente(api_client):
    def _login(usuario):
        api_client.force_authenticate(user=usuario)
        return api_client

    return _login


@pytest.fixture
def paciente_com_responsavel(db):
    paciente = Paciente.objects.create(
        nome_completo="João da Silva", data_nascimento="2015-05-10", telefone="91911112222"
    )
    paciente.responsaveis.create(
        nome="Ana Silva", parentesco="MAE", telefone="91999990000", principal=True
    )
    return paciente


@pytest.fixture
def cria_agendamento(db, profissional, paciente_com_responsavel):
    def _cria(data=date(2026, 7, 20), status=StatusAgendamento.AGENDADO):
        if isinstance(data, str):
            data = datetime.strptime(data, "%Y-%m-%d").date()
        sala = Sala.objects.create(nome="Sala 1")
        servico = Servico.objects.create(
            nome="Psicoterapia",
            duracao_minutos=50,
            valor_clinica="200.00",
            valor_repasse="0.00",
        )
        servico.profissionais.add(profissional)
        return Agendamento.objects.create(
            paciente=paciente_com_responsavel,
            profissional=profissional,
            sala=sala,
            servico=servico,
            data=data,
            horario_inicio=time(15, 0),
            horario_fim=time(15, 50),
            status=status,
        )

    return _cria
