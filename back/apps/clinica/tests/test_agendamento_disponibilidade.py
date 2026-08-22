"""
Validação de disponibilidade semanal do profissional na criação de agendamento.

Regra de negócio (ver ``AgendamentoSerializer.validate``):
- Sem NENHUMA disponibilidade ativa cadastrada → agenda livre (qualquer horário).
- Com janelas cadastradas → o intervalo do agendamento precisa caber inteiro em
  uma janela ativa do dia da semana correspondente.

As datas usadas caem em dias de semana conhecidos:
- 2026-09-14 é uma segunda-feira (weekday() == 0).
- 2026-09-15 é uma terça-feira (weekday() == 1).
"""
import pytest

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, StatusAgendamento
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

SEGUNDA = "2026-09-14"  # weekday() == 0
TERCA = "2026-09-15"    # weekday() == 1
URL = "/api/agendamentos/"


@pytest.fixture
def paciente(db):
    return Paciente.objects.create(nome_completo="Paciente", data_nascimento="2015-01-01")


@pytest.fixture
def servico(cria_servico):
    return cria_servico(duracao_minutos=50)


@pytest.fixture
def sala(cria_sala):
    return cria_sala()


@pytest.fixture
def payload(paciente, profissional, sala, servico):
    def _f(data, horario_inicio):
        return {
            "paciente": paciente.pk,
            "profissional": profissional.pk,
            "sala": sala.pk,
            "servico": servico.pk,
            "data": data,
            "horario_inicio": horario_inicio,
            "status": StatusAgendamento.AGENDADO,
        }
    return _f


def test_sem_disponibilidade_permite_qualquer_horario(cliente_autenticado, payload):
    """Profissional sem nenhuma janela cadastrada → agenda livre."""
    resp = cliente_autenticado.post(URL, payload(TERCA, "03:00"), format="json")
    assert resp.status_code == 201, resp.data


def test_dentro_da_janela_permite(cliente_autenticado, payload, cria_disponibilidade):
    """Horário dentro da janela do dia da semana → cria."""
    cria_disponibilidade(dia_semana=1, horario_inicio="08:00", horario_fim="12:00")  # terça
    resp = cliente_autenticado.post(URL, payload(TERCA, "09:00"), format="json")
    assert resp.status_code == 201, resp.data


def test_fora_da_janela_bloqueia(cliente_autenticado, payload, cria_disponibilidade):
    """Horário fora da janela (mesmo dia) → 400."""
    cria_disponibilidade(dia_semana=1, horario_inicio="08:00", horario_fim="12:00")  # terça
    resp = cliente_autenticado.post(URL, payload(TERCA, "14:00"), format="json")
    assert resp.status_code == 400
    assert "disponibilidade" in str(resp.data["profissional"]).lower()


def test_extrapola_fim_da_janela_bloqueia(cliente_autenticado, payload, cria_disponibilidade):
    """Início dentro da janela mas fim ultrapassa (11:30 + 50min = 12:20 > 12:00) → 400."""
    cria_disponibilidade(dia_semana=1, horario_inicio="08:00", horario_fim="12:00")  # terça
    resp = cliente_autenticado.post(URL, payload(TERCA, "11:30"), format="json")
    assert resp.status_code == 400
    assert "disponibilidade" in str(resp.data["profissional"]).lower()


def test_dia_sem_janela_bloqueia(cliente_autenticado, payload, cria_disponibilidade):
    """Profissional tem janela na terça, mas agenda na segunda → 400."""
    cria_disponibilidade(dia_semana=1, horario_inicio="08:00", horario_fim="12:00")  # terça
    resp = cliente_autenticado.post(URL, payload(SEGUNDA, "09:00"), format="json")
    assert resp.status_code == 400
    assert "disponibilidade" in str(resp.data["profissional"]).lower()


def test_janela_inativa_nao_conta(cliente_autenticado, payload, cria_disponibilidade):
    """Janela inativa é ignorada: como não há janela ativa, agenda fica livre."""
    cria_disponibilidade(dia_semana=1, horario_inicio="08:00", horario_fim="12:00", ativo=False)
    resp = cliente_autenticado.post(URL, payload(TERCA, "09:00"), format="json")
    assert resp.status_code == 201, resp.data
