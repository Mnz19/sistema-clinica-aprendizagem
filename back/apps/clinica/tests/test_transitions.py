"""
Testes unitários da máquina de transições de status (sem DB).

Política vigente: o status é editável manualmente — entre os estados abertos não
há trava de papel nem de ordem. Só os estados finais (ATENDIDO, FALTA,
DESMARCADO) seguem terminais.
"""
import itertools

import pytest
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Papel
from apps.clinica.models import StatusAgendamento
from apps.clinica.transitions import STATUS_ABERTOS, STATUS_TERMINAIS, validar_transicao


# ---------------------------------------------------------------------------
# Sem trava: qualquer papel move entre os estados abertos, em qualquer ordem
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("role", list(Papel.values))
def test_agendado_para_confirmado_direto(role):
    """AGENDADO → CONFIRMADO direto, sem passar por PRE_CONFIRMADO."""
    validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.CONFIRMADO, role)


@pytest.mark.parametrize("role", list(Papel.values))
def test_agendado_para_em_atendimento_direto(role):
    """AGENDADO → EM_ATENDIMENTO direto, para qualquer papel."""
    validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.EM_ATENDIMENTO, role)


@pytest.mark.parametrize("role", list(Papel.values))
@pytest.mark.parametrize("origem,destino", [
    par for par in itertools.product(STATUS_ABERTOS, StatusAgendamento.values)
    if par[0] != par[1]
])
def test_estados_abertos_aceitam_qualquer_destino(origem, destino, role):
    """De um estado aberto, qualquer papel alcança qualquer outro status."""
    validar_transicao(origem, destino, role)


@pytest.mark.parametrize("role", list(Papel.values))
def test_volta_atras_de_confirmado_para_agendado(role):
    """Correção manual: CONFIRMADO → AGENDADO é permitido."""
    validar_transicao(StatusAgendamento.CONFIRMADO, StatusAgendamento.AGENDADO, role)


def test_mesmo_status_nao_lanca_excecao():
    """Sem mudança de status — deve passar silenciosamente."""
    validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.AGENDADO, Papel.RECEPCAO)


def test_multi_papel_usa_qualquer_papel_do_usuario():
    """Usuário com vários papéis passa pela validação normalmente."""
    validar_transicao(
        StatusAgendamento.AGENDADO,
        StatusAgendamento.CONFIRMADO,
        [Papel.RECEPCAO, Papel.FINANCEIRO],
    )


# ---------------------------------------------------------------------------
# Estados terminais continuam fechados (ValidationError)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("terminal", list(STATUS_TERMINAIS))
def test_estado_terminal_nao_tem_transicao_de_saida(terminal):
    """ATENDIDO/FALTA/DESMARCADO alimentam o financeiro — não saem do lugar."""
    with pytest.raises(ValidationError) as exc_info:
        validar_transicao(terminal, StatusAgendamento.AGENDADO, Papel.DIRECAO)
    mensagem = str(exc_info.value).lower()
    assert "terminal" in mensagem or "nenhuma" in mensagem


def test_usuario_sem_papel_nao_transiciona():
    """Sem nenhum papel não há permissão para mover o agendamento."""
    from rest_framework.exceptions import PermissionDenied

    with pytest.raises(PermissionDenied):
        validar_transicao(StatusAgendamento.AGENDADO, StatusAgendamento.CONFIRMADO, [])
