"""Testes unitários de T07 — máquina de transições de status (sem DB)."""
import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Papel
from apps.clinica.models import StatusAgendamento
from apps.clinica.transitions import validar_transicao


# ---------------------------------------------------------------------------
# Transições válidas por papel
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("role", [Papel.RECEPCAO, Papel.DIRECAO])
def test_recepcao_direcao_pre_confirma(role):
    """AGENDADO → PRE_CONFIRMADO permitido para RECEPCAO e DIRECAO."""
    validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.PRE_CONFIRMADO, role)


@pytest.mark.parametrize("role", [Papel.PROFISSIONAL, Papel.DIRECAO])
def test_profissional_direcao_confirma(role):
    """PRE_CONFIRMADO → CONFIRMADO permitido para PROFISSIONAL e DIRECAO."""
    validar_transicao(StatusAgendamento.PRE_CONFIRMADO, StatusAgendamento.CONFIRMADO, role)


@pytest.mark.parametrize("role", [Papel.PROFISSIONAL, Papel.DIRECAO])
def test_profissional_direcao_atende(role):
    """CONFIRMADO → ATENDIDO permitido para PROFISSIONAL e DIRECAO."""
    validar_transicao(StatusAgendamento.CONFIRMADO, StatusAgendamento.ATENDIDO, role)


@pytest.mark.parametrize("role", [Papel.PROFISSIONAL, Papel.DIRECAO])
@pytest.mark.parametrize(
    "origem",
    [
        StatusAgendamento.AGENDADO,
        StatusAgendamento.PRE_CONFIRMADO,
        StatusAgendamento.CONFIRMADO,
    ],
)
def test_profissional_direcao_inicia_atendimento(origem, role):
    """Iniciar atendimento (→ EM_ATENDIMENTO) a partir de AGENDADO/PRE/CONFIRMADO."""
    validar_transicao(origem, StatusAgendamento.EM_ATENDIMENTO, role)


@pytest.mark.parametrize("role", [Papel.PROFISSIONAL, Papel.DIRECAO])
def test_profissional_direcao_finaliza_atendimento(role):
    """EM_ATENDIMENTO → ATENDIDO permitido para PROFISSIONAL e DIRECAO."""
    validar_transicao(StatusAgendamento.EM_ATENDIMENTO, StatusAgendamento.ATENDIDO, role)


@pytest.mark.parametrize("role", [Papel.RECEPCAO, Papel.FINANCEIRO])
def test_recepcao_financeiro_nao_inicia_atendimento(role):
    """Apenas PROFISSIONAL/DIRECAO iniciam atendimento — RECEPCAO/FINANCEIRO não."""
    with pytest.raises(PermissionDenied):
        validar_transicao(StatusAgendamento.CONFIRMADO, StatusAgendamento.EM_ATENDIMENTO, role)


@pytest.mark.parametrize("role", list(Papel.values))
def test_qualquer_papel_desmarca_em_atendimento(role):
    """EM_ATENDIMENTO → DESMARCADO permitido para qualquer papel (correção)."""
    validar_transicao(StatusAgendamento.EM_ATENDIMENTO, StatusAgendamento.DESMARCADO, role)


@pytest.mark.parametrize("role", [Papel.PROFISSIONAL, Papel.DIRECAO])
def test_profissional_direcao_registra_falta(role):
    """CONFIRMADO → FALTA permitido para PROFISSIONAL e DIRECAO."""
    validar_transicao(StatusAgendamento.CONFIRMADO, StatusAgendamento.FALTA, role)


@pytest.mark.parametrize("role", list(Papel.values))
def test_qualquer_papel_desmarca_agendado(role):
    """AGENDADO → DESMARCADO permitido para qualquer papel."""
    validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.DESMARCADO, role)


@pytest.mark.parametrize("role", list(Papel.values))
def test_qualquer_papel_desmarca_pre_confirmado(role):
    """PRE_CONFIRMADO → DESMARCADO permitido para qualquer papel."""
    validar_transicao(StatusAgendamento.PRE_CONFIRMADO, StatusAgendamento.DESMARCADO, role)


@pytest.mark.parametrize("role", list(Papel.values))
def test_qualquer_papel_desmarca_confirmado(role):
    """CONFIRMADO → DESMARCADO permitido para qualquer papel."""
    validar_transicao(StatusAgendamento.CONFIRMADO, StatusAgendamento.DESMARCADO, role)


def test_mesmo_status_nao_lanca_excecao():
    """Sem mudança de status — deve passar silenciosamente."""
    validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.AGENDADO, Papel.RECEPCAO)


# ---------------------------------------------------------------------------
# Transições inválidas (ValidationError)
# ---------------------------------------------------------------------------

def test_estado_terminal_atendido_nao_tem_transicao():
    """ATENDIDO é terminal — qualquer tentativa de transição levanta ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        validar_transicao(StatusAgendamento.ATENDIDO, StatusAgendamento.AGENDADO, Papel.DIRECAO)
    assert "terminal" in str(exc_info.value).lower() or "nenhuma" in str(exc_info.value).lower()


def test_estado_terminal_falta_nao_tem_transicao():
    """FALTA é terminal."""
    with pytest.raises(ValidationError):
        validar_transicao(StatusAgendamento.FALTA, StatusAgendamento.AGENDADO, Papel.DIRECAO)


def test_estado_terminal_desmarcado_nao_tem_transicao():
    """DESMARCADO é terminal."""
    with pytest.raises(ValidationError):
        validar_transicao(StatusAgendamento.DESMARCADO, StatusAgendamento.AGENDADO, Papel.DIRECAO)


def test_agendado_nao_pula_para_confirmado():
    """Não é permitido saltar AGENDADO → CONFIRMADO diretamente (qualquer papel)."""
    with pytest.raises(ValidationError):
        validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.CONFIRMADO, Papel.DIRECAO)


# ---------------------------------------------------------------------------
# Papel não autorizado (PermissionDenied)
# ---------------------------------------------------------------------------

def test_profissional_nao_pode_pre_confirmar():
    """PROFISSIONAL não pode mover AGENDADO → PRE_CONFIRMADO."""
    with pytest.raises(PermissionDenied):
        validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.PRE_CONFIRMADO, Papel.PROFISSIONAL)


def test_recepcao_nao_pode_confirmar():
    """RECEPCAO não pode mover PRE_CONFIRMADO → CONFIRMADO."""
    with pytest.raises(PermissionDenied):
        validar_transicao(StatusAgendamento.PRE_CONFIRMADO, StatusAgendamento.CONFIRMADO, Papel.RECEPCAO)
