"""
Testes de integração — T09 (scoping), T10 (transitions), T11 (recorrente), T13 (logs),
Fix SCHED-04 (conflitos via HTTP).
"""
from datetime import date, time

import pytest
from django.urls import reverse

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento, Frequencia
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

SENHA = "SenhaForte123!"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def cria_usuario(db, django_user_model):
    def _f(email, role=Papel.DIRECAO, nome="Usuário"):
        return django_user_model.objects.create_user(email=email, password=SENHA, role=role, nome=nome)
    return _f


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario("dir@c.com", Papel.DIRECAO, "Dir")


@pytest.fixture
def recepcao(cria_usuario):
    return cria_usuario("rec@c.com", Papel.RECEPCAO, "Rec")


@pytest.fixture
def prof_a(cria_usuario):
    return cria_usuario("prof_a@c.com", Papel.PROFISSIONAL, "ProfA")


@pytest.fixture
def prof_b(cria_usuario):
    return cria_usuario("prof_b@c.com", Papel.PROFISSIONAL, "ProfB")


@pytest.fixture
def paciente(db):
    return Paciente.objects.create(nome_completo="Pac", data_nascimento="2015-01-01")


@pytest.fixture
def sala(db):
    return Sala.objects.create(nome="S1")


@pytest.fixture
def servico_a(db, prof_a):
    servico = Servico.objects.create(
        nome="Terapia A", duracao_minutos=50,
        valor_clinica="150.00", valor_repasse="0.00"
    )
    servico.profissionais.add(prof_a)
    return servico


@pytest.fixture
def servico_b(db, prof_b):
    servico = Servico.objects.create(
        nome="Terapia B", duracao_minutos=50,
        valor_clinica="150.00", valor_repasse="0.00"
    )
    servico.profissionais.add(prof_b)
    return servico


@pytest.fixture
def api(db):
    from rest_framework.test import APIClient
    def _login(user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c
    return _login


@pytest.fixture
def ag_prof_a(db, paciente, prof_a, sala, servico_a):
    return Agendamento.objects.create(
        paciente=paciente, profissional=prof_a, sala=sala, servico=servico_a,
        data=date(2026, 10, 1), horario_inicio=time(10, 0), horario_fim=time(10, 50),
        status=StatusAgendamento.AGENDADO,
    )


@pytest.fixture
def ag_prof_b(db, paciente, prof_b, sala, servico_b):
    return Agendamento.objects.create(
        paciente=paciente, profissional=prof_b, sala=sala, servico=servico_b,
        data=date(2026, 10, 2), horario_inicio=time(14, 0), horario_fim=time(14, 50),
        status=StatusAgendamento.AGENDADO,
    )


# ---------------------------------------------------------------------------
# T09 — Isolamento por papel
# ---------------------------------------------------------------------------

def test_profissional_lista_apenas_proprios(api, prof_a, ag_prof_a, ag_prof_b):
    """AUTH-01: PROFISSIONAL vê somente agendamentos próprios."""
    resp = api(prof_a).get(reverse("agendamento-list"))
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.data]
    assert ag_prof_a.id in ids
    assert ag_prof_b.id not in ids


def test_profissional_nao_acessa_agendamento_alheio(api, prof_a, ag_prof_b):
    """AUTH-02: PROFISSIONAL recebe 403 ao acessar agendamento de outro."""
    resp = api(prof_a).get(reverse("agendamento-detail", args=[ag_prof_b.id]))
    assert resp.status_code == 403


def test_recepcao_lista_todos(api, recepcao, ag_prof_a, ag_prof_b):
    """AUTH-03: RECEPCAO vê todos os agendamentos."""
    resp = api(recepcao).get(reverse("agendamento-list"))
    ids = [a["id"] for a in resp.data]
    assert ag_prof_a.id in ids
    assert ag_prof_b.id in ids


def test_direcao_lista_todos(api, direcao, ag_prof_a, ag_prof_b):
    """AUTH-03: DIRECAO vê todos os agendamentos."""
    resp = api(direcao).get(reverse("agendamento-list"))
    ids = [a["id"] for a in resp.data]
    assert ag_prof_a.id in ids
    assert ag_prof_b.id in ids


def test_profissional_nao_cria_para_outro(api, prof_a, paciente, sala, servico_b, prof_b):
    """AUTH-01: PROFISSIONAL não pode criar agendamento para outro profissional → 403."""
    payload = {
        "paciente": paciente.id, "profissional": prof_b.id,
        "sala": sala.id, "servico": servico_b.id,
        "data": "2026-10-05", "horario_inicio": "09:00:00",
    }
    resp = api(prof_a).post(reverse("agendamento-list"), payload, format="json")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# T10 — Transições de status via serializer
# ---------------------------------------------------------------------------

def test_recepcao_pre_confirma(api, recepcao, ag_prof_a):
    """SCHED-04: RECEPCAO move AGENDADO → PRE_CONFIRMADO."""
    resp = api(recepcao).patch(
        reverse("agendamento-detail", args=[ag_prof_a.id]),
        {"status": StatusAgendamento.PRE_CONFIRMADO}, format="json",
    )
    assert resp.status_code == 200
    ag_prof_a.refresh_from_db()
    assert ag_prof_a.status == StatusAgendamento.PRE_CONFIRMADO


def test_profissional_confirma_apos_pre_confirmacao(api, prof_a, ag_prof_a, recepcao):
    """SCHED-05: PROFISSIONAL confirma depois que RECEPCAO pré-confirmou."""
    ag_prof_a.status = StatusAgendamento.PRE_CONFIRMADO
    ag_prof_a.save()
    resp = api(prof_a).patch(
        reverse("agendamento-detail", args=[ag_prof_a.id]),
        {"status": StatusAgendamento.CONFIRMADO}, format="json",
    )
    assert resp.status_code == 200


def test_profissional_nao_confirma_sem_pre_confirmacao(api, prof_a, ag_prof_a):
    """SCHED-05/AC1: AGENDADO → CONFIRMADO é transição inválida para qualquer papel → 400."""
    # SPEC_DEVIATION: spec pede 403, mas AGENDADO→CONFIRMADO não é uma transição válida
    # para nenhum papel (estado intermediário PRE_CONFIRMADO é obrigatório), portanto
    # a implementação retorna 400 (ValidationError) com lista de transições válidas.
    resp = api(prof_a).patch(
        reverse("agendamento-detail", args=[ag_prof_a.id]),
        {"status": StatusAgendamento.CONFIRMADO}, format="json",
    )
    assert resp.status_code == 400
    assert "status" in resp.data


def test_recepcao_nao_pode_confirmar(api, recepcao, ag_prof_a):
    """SCHED-04/AC2: RECEPCAO não pode mover PRE_CONFIRMADO → CONFIRMADO."""
    ag_prof_a.status = StatusAgendamento.PRE_CONFIRMADO
    ag_prof_a.save()
    resp = api(recepcao).patch(
        reverse("agendamento-detail", args=[ag_prof_a.id]),
        {"status": StatusAgendamento.CONFIRMADO}, format="json",
    )
    assert resp.status_code == 403


def test_estado_terminal_nao_transita(api, direcao, ag_prof_a):
    """SCHED-03/AC5: estado terminal ATENDIDO não aceita transição de saída → 400."""
    ag_prof_a.status = StatusAgendamento.ATENDIDO
    ag_prof_a.save()
    resp = api(direcao).patch(
        reverse("agendamento-detail", args=[ag_prof_a.id]),
        {"status": StatusAgendamento.AGENDADO}, format="json",
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# T11 — @action recorrente/
# ---------------------------------------------------------------------------

def test_recepcao_cria_serie_recorrente(api, recepcao, ag_prof_a):
    """SCHED-09: RECEPCAO cria série semanal → 201 com criados e nao_criados."""
    resp = api(recepcao).post(
        reverse("agendamento-recorrente", args=[ag_prof_a.id]),
        {"frequencia": Frequencia.SEMANAL, "data_fim_recorrencia": "2026-10-22"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["total_criados"] == 3
    assert resp.data["nao_criados"] == []


def test_serie_recorrente_frequencia_invalida(api, recepcao, ag_prof_a):
    """SCHED-09/AC1: frequência inválida → 400."""
    resp = api(recepcao).post(
        reverse("agendamento-recorrente", args=[ag_prof_a.id]),
        {"frequencia": "DIARIO", "data_fim_recorrencia": "2026-10-22"},
        format="json",
    )
    assert resp.status_code == 400


def test_profissional_nao_cria_serie(api, prof_a, ag_prof_a):
    """SCHED-11: PROFISSIONAL não pode criar série → 403."""
    resp = api(prof_a).post(
        reverse("agendamento-recorrente", args=[ag_prof_a.id]),
        {"frequencia": Frequencia.SEMANAL, "data_fim_recorrencia": "2026-10-22"},
        format="json",
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# T13 — @action logs/
# ---------------------------------------------------------------------------

def test_direcao_obtem_logs_agendamento(api, direcao, ag_prof_a):
    """SCHED-12: DIRECAO obtém log de agendamento → 200."""
    # Gera um evento de auditoria modificando o agendamento
    ag_prof_a.observacoes = "Teste de log"
    ag_prof_a.save()

    resp = api(direcao).get(reverse("agendamento-logs", args=[ag_prof_a.id]))
    assert resp.status_code == 200
    assert isinstance(resp.data, list)


def test_profissional_obtem_logs_proprios(api, prof_a, ag_prof_a):
    """SCHED-13: PROFISSIONAL vê logs do próprio agendamento."""
    resp = api(prof_a).get(reverse("agendamento-logs", args=[ag_prof_a.id]))
    assert resp.status_code == 200


def test_profissional_bloqueado_em_logs_alheios(api, prof_a, ag_prof_b):
    """SCHED-13: PROFISSIONAL recebe 403 em logs de agendamento alheio."""
    resp = api(prof_a).get(reverse("agendamento-logs", args=[ag_prof_b.id]))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Fix SCHED-04 — Conflitos de horário via HTTP (regressão)
# ---------------------------------------------------------------------------

def test_conflito_profissional_retorna_400_com_detalhe(api, direcao, paciente, prof_a, sala, servico_a, payload_base):
    """SCHED-04/AC1: Segundo agendamento no mesmo horário do profissional → 400 com campo 'profissional'."""
    payload_base = {
        "paciente": paciente.id, "profissional": prof_a.id,
        "sala": sala.id, "servico": servico_a.id,
        "data": "2026-11-10", "horario_inicio": "09:00:00",
    }
    # Cria o primeiro agendamento
    resp1 = api(direcao).post(reverse("agendamento-list"), payload_base, format="json")
    assert resp1.status_code == 201

    # Tenta criar segundo no mesmo slot — deve conflitar no profissional
    sala2 = Sala.objects.create(nome="S2")
    payload_conflito = {**payload_base, "sala": sala2.id}
    resp2 = api(direcao).post(reverse("agendamento-list"), payload_conflito, format="json")

    assert resp2.status_code == 400, resp2.data
    assert "profissional" in resp2.data


def test_conflito_sala_retorna_400_com_detalhe(api, direcao, paciente, prof_a, prof_b, sala, servico_a, servico_b):
    """SCHED-04/AC2: Dois profissionais diferentes na mesma sala e horário → 400 com campo 'sala'."""
    # Primeiro agendamento: prof_a na sala às 10h
    resp1 = api(direcao).post(reverse("agendamento-list"), {
        "paciente": paciente.id, "profissional": prof_a.id,
        "sala": sala.id, "servico": servico_a.id,
        "data": "2026-11-11", "horario_inicio": "10:00:00",
    }, format="json")
    assert resp1.status_code == 201

    # Segundo agendamento: prof_b na mesma sala e horário → conflito de sala
    resp2 = api(direcao).post(reverse("agendamento-list"), {
        "paciente": paciente.id, "profissional": prof_b.id,
        "sala": sala.id, "servico": servico_b.id,
        "data": "2026-11-11", "horario_inicio": "10:00:00",
    }, format="json")

    assert resp2.status_code == 400, resp2.data
    assert "sala" in resp2.data


def test_agendamento_desmarcado_libera_slot(api, direcao, paciente, prof_a, sala, servico_a):
    """SCHED-04/AC4: Slot DESMARCADO não conta como conflito — novo agendamento é aceito."""
    # Cria e desmarca um agendamento
    resp1 = api(direcao).post(reverse("agendamento-list"), {
        "paciente": paciente.id, "profissional": prof_a.id,
        "sala": sala.id, "servico": servico_a.id,
        "data": "2026-11-12", "horario_inicio": "11:00:00",
    }, format="json")
    assert resp1.status_code == 201
    ag_id = resp1.data["id"]

    api(direcao).patch(reverse("agendamento-detail", args=[ag_id]), {
        "status": StatusAgendamento.DESMARCADO,
        "parecer_status": "Paciente cancelou.",
    }, format="json")

    # Novo agendamento no mesmo slot deve ser aceito
    resp2 = api(direcao).post(reverse("agendamento-list"), {
        "paciente": paciente.id, "profissional": prof_a.id,
        "sala": sala.id, "servico": servico_a.id,
        "data": "2026-11-12", "horario_inicio": "11:00:00",
    }, format="json")
    assert resp2.status_code == 201, resp2.data


@pytest.fixture
def payload_base(paciente, prof_a, sala, servico_a):
    return {
        "paciente": paciente.id, "profissional": prof_a.id,
        "sala": sala.id, "servico": servico_a.id,
        "data": "2026-11-10", "horario_inicio": "09:00:00",
    }


# ---------------------------------------------------------------------------
# Fix SCHED-05 AC4/AC5 — Cancelamento de série recorrente
# ---------------------------------------------------------------------------

def test_cancelar_ocorrencia_nao_afeta_serie(api, recepcao, ag_prof_a):
    """SCHED-05/AC4: PATCH de uma ocorrência não cancela as demais da série."""
    # Cria série de 3 semanas
    resp_serie = api(recepcao).post(
        reverse("agendamento-recorrente", args=[ag_prof_a.id]),
        {"frequencia": "SEMANAL", "data_fim_recorrencia": "2026-10-22"},
        format="json",
    )
    assert resp_serie.status_code == 201
    ids_criados = [a["id"] for a in resp_serie.data["criados"]]
    assert len(ids_criados) == 3

    # Cancela apenas a primeira ocorrência da série
    primeira = ids_criados[0]
    resp_cancel = api(recepcao).patch(
        reverse("agendamento-detail", args=[primeira]),
        {"status": StatusAgendamento.DESMARCADO, "parecer_status": "Conflito de agenda."},
        format="json",
    )
    assert resp_cancel.status_code == 200

    # As demais devem permanecer AGENDADO
    for ag_id in ids_criados[1:]:
        ag = Agendamento.objects.get(id=ag_id)
        assert ag.status == StatusAgendamento.AGENDADO, f"ag {ag_id} foi cancelado indevidamente"


def test_cancelar_serie_completa(api, recepcao, ag_prof_a):
    """SCHED-05/AC5: POST cancelar-serie/ desmarca todas as ocorrências futuras."""
    # Cria série
    resp_serie = api(recepcao).post(
        reverse("agendamento-recorrente", args=[ag_prof_a.id]),
        {"frequencia": "SEMANAL", "data_fim_recorrencia": "2026-10-22"},
        format="json",
    )
    assert resp_serie.status_code == 201
    ids_criados = [a["id"] for a in resp_serie.data["criados"]]

    # Cancela toda a série a partir do agendamento de origem
    resp_cancel = api(recepcao).post(
        reverse("agendamento-cancelar-serie", args=[ag_prof_a.id]),
        {"parecer_status": "Terapeuta em licença."},
        format="json",
    )
    assert resp_cancel.status_code == 200
    assert "desmarcada" in resp_cancel.data["detail"]

    # Verifica que as ocorrências futuras foram desmarcadas
    desmarcados = Agendamento.objects.filter(
        id__in=ids_criados, status=StatusAgendamento.DESMARCADO
    ).count()
    assert desmarcados == len(ids_criados)


def test_cancelar_serie_sem_serie_retorna_400(api, recepcao, ag_prof_a):
    """SCHED-05/AC5: agendamento sem série → 400."""
    resp = api(recepcao).post(
        reverse("agendamento-cancelar-serie", args=[ag_prof_a.id]),
        {"parecer_status": "Teste."},
        format="json",
    )
    assert resp.status_code == 400
