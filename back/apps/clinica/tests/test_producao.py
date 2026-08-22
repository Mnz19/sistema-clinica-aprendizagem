"""Testes do endpoint /api/producoes/ — consulta do ledger de produção.

Os lançamentos de ``Producao`` são criados pelo signal ``post_save`` de
``Agendamento`` (ver ``test_signal_producao.py``). Aqui validamos apenas a
exposição de leitura: filtros de período/profissional e isolamento por papel.
"""
from datetime import date, time

import pytest

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Producao, Sala, Servico, StatusAgendamento
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

SENHA = "SenhaForte123!"
URL = "/api/producoes/"


@pytest.fixture
def cria_u(db, django_user_model):
    def _f(email, role, nome="U"):
        return django_user_model.objects.create_user(email=email, password=SENHA, role=role, nome=nome)
    return _f


@pytest.fixture
def direcao(cria_u): return cria_u("dir@c.com", Papel.DIRECAO)


@pytest.fixture
def prof(cria_u): return cria_u("prof@c.com", Papel.PROFISSIONAL)


@pytest.fixture
def outro_prof(cria_u): return cria_u("prof2@c.com", Papel.PROFISSIONAL)


@pytest.fixture
def api(db):
    from rest_framework.test import APIClient
    def _f(u):
        c = APIClient(); c.force_authenticate(user=u); return c
    return _f


@pytest.fixture
def agendamentos(db, prof):
    """Cria agendamentos em vários status; o signal gera a produção correspondente."""
    pac = Paciente.objects.create(nome_completo="P", data_nascimento="2015-01-01")
    sala = Sala.objects.create(nome="S")
    serv = Servico.objects.create(
        nome="T", duracao_minutos=50,
        valor_clinica="150.00", valor_repasse="0.00"
    )
    serv.profissionais.add(prof)

    def _cria(data, horario, status):
        return Agendamento.objects.create(
            paciente=pac, profissional=prof, sala=sala, servico=serv,
            data=data, horario_inicio=horario,
            horario_fim=time(horario.hour, horario.minute + 50),
            status=status,
        )

    return [
        _cria(date(2026, 11, 1), time(9, 0), StatusAgendamento.ATENDIDO),
        _cria(date(2026, 11, 2), time(10, 0), StatusAgendamento.FALTA),
        _cria(date(2026, 11, 4), time(14, 0), StatusAgendamento.AGENDADO),
    ]


def test_agendamento_atendido_aparece_na_producao(api, direcao, agendamentos):
    """Regressão: um agendamento ATENDIDO deve aparecer na aba de produções."""
    resp = api(direcao).get(URL)
    assert resp.status_code == 200
    motivos = {p["motivo"] for p in resp.data}
    assert "Atendimento Realizado" in motivos


def test_lista_apenas_agendamentos_com_cobranca(api, direcao, agendamentos):
    """Só há produção para ATENDIDO e FALTA; AGENDADO não gera lançamento."""
    resp = api(direcao).get(URL)
    assert resp.status_code == 200
    # 3 agendamentos, mas apenas ATENDIDO + FALTA geram produção.
    assert len(resp.data) == Producao.objects.count() == 2


def test_filtro_por_periodo(api, direcao, agendamentos):
    """?data__gte / ?data__lte filtram o ledger por data do atendimento."""
    resp = api(direcao).get(URL, {"data__gte": "2026-11-02", "data__lte": "2026-11-02"})
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]["motivo"] == "Falta do Paciente"


def test_profissional_ve_apenas_a_propria_producao(api, prof, outro_prof, agendamentos):
    """Isolamento por papel: PROFISSIONAL não enxerga produção de colegas."""
    resp_dono = api(prof).get(URL)
    assert resp_dono.status_code == 200
    assert len(resp_dono.data) == 2

    resp_outro = api(outro_prof).get(URL)
    assert resp_outro.status_code == 200
    assert resp_outro.data == []
