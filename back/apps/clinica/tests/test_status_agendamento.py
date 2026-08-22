"""
Testes de T01 — StatusAgendamento atualizado.

Cobre:
- Status padrão na criação (AGENDADO)
- Status PRE_CONFIRMADO é aceito pelo serializer/view
- FALTA e DESMARCADO exigem parecer_status
- DESMARCADO exclui slot de conflito (não bloqueia nova marcação)
"""
from datetime import date, time

import pytest
from django.urls import reverse

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

SENHA = "SenhaForte123!"


# ---------------------------------------------------------------------------
# Fixtures locais
# ---------------------------------------------------------------------------

@pytest.fixture
def cria_usuario(db, django_user_model):
    def _cria(email, role=Papel.DIRECAO, **extra):
        extra.setdefault("nome", "Usuário Teste")
        return django_user_model.objects.create_user(email=email, password=SENHA, role=role, **extra)
    return _cria


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario("direcao@clinica.com", role=Papel.DIRECAO)


@pytest.fixture
def profissional(cria_usuario):
    return cria_usuario("prof@clinica.com", role=Papel.PROFISSIONAL, nome="Dr. Teste")


@pytest.fixture
def api_cliente(profissional):
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=profissional)
    return client


@pytest.fixture
def api_direcao(direcao):
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=direcao)
    return client


@pytest.fixture
def paciente(db):
    return Paciente.objects.create(nome_completo="Paciente Teste", data_nascimento="2015-01-01")


@pytest.fixture
def sala(db):
    return Sala.objects.create(nome="Sala 1")


@pytest.fixture
def servico(db, profissional):
    servico = Servico.objects.create(
        nome="Psicoterapia",
        duracao_minutos=50,
        valor_clinica="150.00",
        valor_repasse="0.00",
    )
    servico.profissionais.add(profissional)
    return servico


@pytest.fixture
def payload_base(paciente, profissional, sala, servico):
    return {
        "paciente": paciente.id,
        "profissional": profissional.id,
        "sala": sala.id,
        "servico": servico.id,
        "data": "2026-09-01",
        "horario_inicio": "10:00:00",
    }


# ---------------------------------------------------------------------------
# Testes — AC spec SCHED-03
# ---------------------------------------------------------------------------

def test_criacao_define_status_agendado(api_direcao, payload_base):
    """AC SCHED-03/Done-when: status inicial é AGENDADO."""
    resp = api_direcao.post(reverse("agendamento-list"), payload_base, format="json")

    assert resp.status_code == 201, resp.data
    assert resp.data["status"] == StatusAgendamento.AGENDADO


def test_status_pre_confirmado_e_valido(api_direcao, paciente, profissional, sala, servico):
    """AC SCHED-03/Done-when: PRE_CONFIRMADO é um status válido e aceito."""
    ag = Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data=date(2026, 9, 2),
        horario_inicio=time(10, 0),
        horario_fim=time(10, 50),
        status=StatusAgendamento.AGENDADO,
    )

    resp = api_direcao.patch(
        reverse("agendamento-detail", args=[ag.id]),
        {"status": StatusAgendamento.PRE_CONFIRMADO},
        format="json",
    )

    assert resp.status_code == 200, resp.data
    ag.refresh_from_db()
    assert ag.status == StatusAgendamento.PRE_CONFIRMADO


def test_falta_sem_parecer_retorna_400(api_direcao, paciente, profissional, sala, servico):
    """AC SCHED-03/Done-when AC6: FALTA sem parecer_status retorna 400."""
    ag = Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data=date(2026, 9, 3),
        horario_inicio=time(10, 0),
        horario_fim=time(10, 50),
        status=StatusAgendamento.CONFIRMADO,
    )

    resp = api_direcao.patch(
        reverse("agendamento-detail", args=[ag.id]),
        {"status": StatusAgendamento.FALTA},
        format="json",
    )

    assert resp.status_code == 400
    assert "parecer_status" in resp.data


def test_desmarcado_sem_parecer_retorna_400(api_direcao, paciente, profissional, sala, servico):
    """AC SCHED-03/Done-when AC6: DESMARCADO sem parecer_status retorna 400."""
    ag = Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data=date(2026, 9, 4),
        horario_inicio=time(10, 0),
        horario_fim=time(10, 50),
        status=StatusAgendamento.AGENDADO,
    )

    resp = api_direcao.patch(
        reverse("agendamento-detail", args=[ag.id]),
        {"status": StatusAgendamento.DESMARCADO},
        format="json",
    )

    assert resp.status_code == 400
    assert "parecer_status" in resp.data


def test_desmarcado_libera_slot_para_novo_agendamento(api_direcao, paciente, profissional, sala, servico, payload_base):
    """
    AC T01/Done-when: slot de agendamento DESMARCADO não conta como conflito
    (_tem_sobreposicao exclui DESMARCADO).
    """
    # Cria agendamento e o desmarca
    ag = Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data=date(2026, 9, 5),
        horario_inicio=time(10, 0),
        horario_fim=time(10, 50),
        status=StatusAgendamento.DESMARCADO,
        parecer_status="Cancelado pelo responsável.",
    )

    # Tenta criar novo agendamento no mesmo slot
    novo_payload = {**payload_base, "data": "2026-09-05", "horario_inicio": "10:00:00"}
    resp = api_direcao.post(reverse("agendamento-list"), novo_payload, format="json")

    assert resp.status_code == 201, resp.data


def test_enum_possui_sete_status():
    """Enum de status: 6 originais + EM_ATENDIMENTO (cronômetro do atendimento)."""
    valores = [s.value for s in StatusAgendamento]
    assert set(valores) == {
        "AGENDADO",
        "PRE_CONFIRMADO",
        "CONFIRMADO",
        "EM_ATENDIMENTO",
        "ATENDIDO",
        "FALTA",
        "DESMARCADO",
    }
    assert len(valores) == 7
