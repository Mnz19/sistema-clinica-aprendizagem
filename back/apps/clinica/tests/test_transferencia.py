"""
Transferência de agendamento para outro profissional
(``POST /api/agendamentos/{id}/transferir/``).

Regra de produto:
- Estar FORA da disponibilidade semanal do profissional de destino é apenas um
  AVISO: a primeira chamada retorna ``requer_confirmacao=True`` sem salvar;
  reenviar com ``confirmar=true`` efetiva.
- Ausência/férias na data, serviço não oferecido pelo destino e choque de
  horário (agenda dupla) continuam BLOQUEANDO (400).
- Ação restrita a RECEPCAO/DIRECAO.

Datas usadas caem em dias de semana conhecidos:
- 2026-09-15 é terça-feira (weekday() == 1).
"""
from datetime import time

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, StatusAgendamento
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

TERCA = "2026-09-15"  # weekday() == 1


def url_transferir(agendamento_id: int) -> str:
    return f"/api/agendamentos/{agendamento_id}/transferir/"


@pytest.fixture
def prof2(cria_usuario):
    """Segundo profissional — destino das transferências."""
    return cria_usuario(email="prof2@clinica.com", role=Papel.PROFISSIONAL, nome="Dr. Dois")


@pytest.fixture
def paciente(db):
    return Paciente.objects.create(nome_completo="Paciente", data_nascimento="2015-01-01")


@pytest.fixture
def sala(cria_sala):
    return cria_sala()


@pytest.fixture
def servico_compartilhado(cria_servico, profissional, prof2):
    """Serviço (50 min) oferecido por ambos os profissionais."""
    return cria_servico(duracao_minutos=50, profissionais=[profissional, prof2])


@pytest.fixture
def cria_agendamento(db, paciente, profissional, sala):
    """Fábrica do agendamento base (dono: fixture ``profissional``)."""

    def _cria(servico, data=TERCA, inicio="09:00", fim="09:50", status=StatusAgendamento.AGENDADO):
        return Agendamento.objects.create(
            paciente=paciente,
            profissional=profissional,
            sala=sala,
            servico=servico,
            data=data,
            horario_inicio=time.fromisoformat(inicio),
            horario_fim=time.fromisoformat(fim),
            status=status,
        )

    return _cria


# ---------------------------------------------------------------------------
# Caminho feliz
# ---------------------------------------------------------------------------

def test_transferencia_sem_disponibilidade_efetiva(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2
):
    """Destino sem nenhuma janela cadastrada → agenda livre, sem aviso, efetiva."""
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk}, format="json"
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["requer_confirmacao"] is False
    assert resp.data["avisos"] == []
    ag.refresh_from_db()
    assert ag.profissional_id == prof2.pk


def test_transferencia_dentro_disponibilidade_efetiva(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2, cria_disponibilidade
):
    """Destino disponível na janela → efetiva sem aviso."""
    cria_disponibilidade(dia_semana=1, horario_inicio="08:00", horario_fim="18:00", profissional=prof2)
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk}, format="json"
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["requer_confirmacao"] is False
    assert resp.data["avisos"] == []
    ag.refresh_from_db()
    assert ag.profissional_id == prof2.pk


# ---------------------------------------------------------------------------
# Fora da disponibilidade → apenas alerta, não trava
# ---------------------------------------------------------------------------

def test_fora_disponibilidade_pede_confirmacao_e_nao_salva(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2, cria_disponibilidade
):
    """Fora da janela + sem confirmar → requer_confirmacao=True e NADA é salvo."""
    # Janela às tardes; agendamento é 09:00 → fora da janela.
    cria_disponibilidade(dia_semana=1, horario_inicio="14:00", horario_fim="18:00", profissional=prof2)
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk, "confirmar": False}, format="json"
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["requer_confirmacao"] is True
    assert len(resp.data["avisos"]) == 1
    assert "disponibilidade" in resp.data["avisos"][0].lower()
    ag.refresh_from_db()
    assert ag.profissional_id != prof2.pk  # não salvou


def test_fora_disponibilidade_confirmar_efetiva(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2, cria_disponibilidade
):
    """Fora da janela + confirmar=True → efetiva mantendo o aviso na resposta."""
    cria_disponibilidade(dia_semana=1, horario_inicio="14:00", horario_fim="18:00", profissional=prof2)
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk, "confirmar": True}, format="json"
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["requer_confirmacao"] is False
    assert len(resp.data["avisos"]) == 1
    ag.refresh_from_db()
    assert ag.profissional_id == prof2.pk


# ---------------------------------------------------------------------------
# Bloqueios (regra dura) — 400
# ---------------------------------------------------------------------------

def test_servico_nao_oferecido_bloqueia(
    cliente_autenticado, cria_agendamento, cria_servico, profissional, prof2
):
    """Serviço não oferecido pelo destino → 400 mesmo com confirmar=True."""
    servico = cria_servico(duracao_minutos=50, profissionais=[profissional])  # só o dono
    ag = cria_agendamento(servico)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk, "confirmar": True}, format="json"
    )

    assert resp.status_code == 400
    assert "servico" in resp.data
    ag.refresh_from_db()
    assert ag.profissional_id == profissional.pk


def test_ausencia_do_destino_bloqueia(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2, cria_ausencia
):
    """Ausência do destino na data → 400."""
    cria_ausencia(data_inicio=TERCA, data_fim=TERCA, profissional=prof2)
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk, "confirmar": True}, format="json"
    )

    assert resp.status_code == 400
    assert "profissional" in resp.data


def test_choque_de_horario_bloqueia(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2, sala, paciente
):
    """Destino já tem consulta sobreposta → 400 (agenda dupla continua travando)."""
    Agendamento.objects.create(
        paciente=paciente,
        profissional=prof2,
        sala=sala,
        servico=servico_compartilhado,
        data=TERCA,
        horario_inicio=time(9, 0),
        horario_fim=time(9, 50),
        status=StatusAgendamento.AGENDADO,
    )
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk, "confirmar": True}, format="json"
    )

    assert resp.status_code == 400
    assert "profissional" in resp.data


def test_status_terminal_bloqueia(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2
):
    """Agendamento já atendido não pode ser transferido → 400."""
    ag = cria_agendamento(servico_compartilhado, status=StatusAgendamento.ATENDIDO)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": prof2.pk, "confirmar": True}, format="json"
    )

    assert resp.status_code == 400
    assert "status" in resp.data


def test_mesmo_profissional_bloqueia(
    cliente_autenticado, cria_agendamento, servico_compartilhado, profissional
):
    """Transferir para o mesmo profissional é um no-op inválido → 400."""
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(
        url_transferir(ag.id), {"profissional": profissional.pk}, format="json"
    )

    assert resp.status_code == 400
    assert "profissional" in resp.data


def test_profissional_de_destino_ausente_no_payload(
    cliente_autenticado, cria_agendamento, servico_compartilhado
):
    """Sem informar o profissional de destino → 400."""
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.post(url_transferir(ag.id), {}, format="json")

    assert resp.status_code == 400
    assert "profissional" in resp.data


# ---------------------------------------------------------------------------
# Permissão
# ---------------------------------------------------------------------------

def test_update_comum_nao_troca_profissional(
    cliente_autenticado, cria_agendamento, servico_compartilhado, prof2
):
    """PATCH comum tentando trocar o profissional → 400 (use a transferência)."""
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.patch(
        f"/api/agendamentos/{ag.id}/",
        {"profissional": prof2.pk},
        format="json",
    )

    assert resp.status_code == 400
    assert "profissional" in resp.data
    ag.refresh_from_db()
    assert ag.profissional_id != prof2.pk


def test_update_comum_reenviando_mesmo_profissional_ok(
    cliente_autenticado, cria_agendamento, servico_compartilhado, profissional
):
    """PATCH reenviando o profissional atual (como faz o form) → 200."""
    ag = cria_agendamento(servico_compartilhado)

    resp = cliente_autenticado.patch(
        f"/api/agendamentos/{ag.id}/",
        {"profissional": profissional.pk, "observacoes": "obs"},
        format="json",
    )

    assert resp.status_code == 200, resp.data


def test_profissional_nao_pode_transferir(
    cria_agendamento, servico_compartilhado, profissional, prof2
):
    """PROFISSIONAL não tem permissão para transferir → 403."""
    ag = cria_agendamento(servico_compartilhado)

    client = APIClient()
    client.force_authenticate(user=profissional)
    resp = client.post(
        url_transferir(ag.id), {"profissional": prof2.pk}, format="json"
    )

    assert resp.status_code == 403
    ag.refresh_from_db()
    assert ag.profissional_id == profissional.pk
