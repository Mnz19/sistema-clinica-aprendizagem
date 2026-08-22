"""Testes de T15 — DashboardTerapeutaView."""
from datetime import date, time, timedelta

import pytest
from django.urls import reverse

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db
SENHA = "SenhaForte123!"


@pytest.fixture
def cria_u(db, django_user_model):
    def _f(email, role, nome="U"):
        return django_user_model.objects.create_user(email=email, password=SENHA, role=role, nome=nome)
    return _f


@pytest.fixture
def prof(cria_u): return cria_u("prof@c.com", Papel.PROFISSIONAL)
@pytest.fixture
def direcao(cria_u): return cria_u("dir@c.com", Papel.DIRECAO)
@pytest.fixture
def recepcao(cria_u): return cria_u("rec@c.com", Papel.RECEPCAO)
@pytest.fixture
def api(db):
    from rest_framework.test import APIClient
    def _f(u):
        c = APIClient(); c.force_authenticate(user=u); return c
    return _f


URL = "/api/dashboard/terapeuta/"


def test_profissional_obtem_dashboard_vazio(api, prof):
    """DASH-01/AC3: sem agendamentos retorna zeros e listas vazias."""
    resp = api(prof).get(URL)
    assert resp.status_code == 200
    assert resp.data["por_status"][StatusAgendamento.AGENDADO] == 0
    assert resp.data["proximas_consultas"] == []
    assert resp.data["repasse_mes"] == "0"


def test_profissional_dashboard_com_agendamentos(api, prof):
    """DASH-01/AC1: métricas do mês corrente com agendamentos."""
    pac = Paciente.objects.create(nome_completo="P", data_nascimento="2015-01-01")
    sala = Sala.objects.create(nome="S")
    serv = Servico.objects.create(nome="T", duracao_minutos=50, valor_clinica="150.00", valor_repasse="0.00")
    serv.profissionais.add(prof)
    hoje = date.today()
    for i in range(2):
        Agendamento.objects.create(
            paciente=pac, profissional=prof, sala=sala, servico=serv,
            data=hoje + timedelta(days=i+1),
            horario_inicio=time(10, 0), horario_fim=time(10, 50),
            status=StatusAgendamento.AGENDADO,
        )

    resp = api(prof).get(URL)
    assert resp.status_code == 200
    assert resp.data["por_status"][StatusAgendamento.AGENDADO] == 2
    assert len(resp.data["proximas_consultas"]) >= 2


def test_recepcao_nao_acessa_dashboard(api, recepcao):
    """DASH-01: RECEPCAO não acessa endpoint → 403."""
    resp = api(recepcao).get(URL)
    assert resp.status_code == 403


def test_direcao_acessa_dashboard_de_outro_profissional(api, direcao, prof):
    """DASH-02/AC2: DIRECAO consulta dashboard de outro profissional."""
    resp = api(direcao).get(f"{URL}?profissional_id={prof.pk}")
    assert resp.status_code == 200
    assert "por_status" in resp.data
