"""Testes de T12 — endpoints de baixa de pagamento."""
from datetime import date, time

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
def financeiro(cria_u): return cria_u("fin@c.com", Papel.FINANCEIRO)
@pytest.fixture
def direcao(cria_u): return cria_u("dir@c.com", Papel.DIRECAO)
@pytest.fixture
def prof(cria_u): return cria_u("prof@c.com", Papel.PROFISSIONAL)


@pytest.fixture
def ag_atendido(db, prof, direcao):
    from rest_framework.test import APIClient
    pac = Paciente.objects.create(nome_completo="P", data_nascimento="2015-01-01")
    sala = Sala.objects.create(nome="S")
    serv = Servico.objects.create(
        nome="T", duracao_minutos=50,
        valor_clinica="200.00", valor_repasse="120.00",
    )
    serv.profissionais.add(prof)
    return Agendamento.objects.create(
        paciente=pac, profissional=prof, sala=sala, servico=serv,
        data=date(2026, 10, 1), horario_inicio=time(10, 0), horario_fim=time(10, 50),
        status=StatusAgendamento.ATENDIDO,
    )


@pytest.fixture
def api(db):
    from rest_framework.test import APIClient
    def _f(u):
        c = APIClient()
        c.force_authenticate(user=u)
        return c
    return _f


def url_pag(ag_id): return reverse("agendamento-pagamento", args=[ag_id])


def test_financeiro_registra_baixa(api, financeiro, ag_atendido):
    """FIN-01/AC1: FINANCEIRO registra baixa → 201 com valor_repasse_calculado."""
    resp = api(financeiro).post(url_pag(ag_atendido.id), {
        "valor_pago": "200.00", "forma_pagamento": "PIX",
    }, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["valor_repasse_calculado"] == "120.00"


def test_dupla_baixa_retorna_400(api, financeiro, ag_atendido):
    """FIN-01/AC2: segunda baixa no mesmo agendamento → 400."""
    api(financeiro).post(url_pag(ag_atendido.id), {"valor_pago": "200.00", "forma_pagamento": "PIX"}, format="json")
    resp = api(financeiro).post(url_pag(ag_atendido.id), {"valor_pago": "200.00", "forma_pagamento": "PIX"}, format="json")
    assert resp.status_code == 400


def test_baixa_em_nao_atendido_retorna_400(api, financeiro, ag_atendido):
    """FIN-01/AC4: agendamento AGENDADO (não atendido) → 400."""
    ag_atendido.status = StatusAgendamento.AGENDADO
    ag_atendido.save()
    resp = api(financeiro).post(url_pag(ag_atendido.id), {"valor_pago": "200.00", "forma_pagamento": "PIX"}, format="json")
    assert resp.status_code == 400


def test_profissional_nao_acessa_pagamento(api, prof, ag_atendido):
    """FIN-01/AC5: PROFISSIONAL → 403."""
    resp = api(prof).post(url_pag(ag_atendido.id), {"valor_pago": "200.00", "forma_pagamento": "PIX"}, format="json")
    assert resp.status_code == 403


def test_get_pagamento(api, financeiro, ag_atendido):
    """FIN-01/AC3: GET retorna dados da baixa."""
    api(financeiro).post(url_pag(ag_atendido.id), {"valor_pago": "200.00", "forma_pagamento": "DINHEIRO"}, format="json")
    resp = api(financeiro).get(url_pag(ag_atendido.id))
    assert resp.status_code == 200
    assert resp.data["valor_pago"] == "200.00"
    assert resp.data["forma_pagamento"] == "DINHEIRO"


def test_get_sem_pagamento_retorna_404(api, financeiro, ag_atendido):
    """FIN-01/AC3: sem baixa → 404."""
    resp = api(financeiro).get(url_pag(ag_atendido.id))
    assert resp.status_code == 404
