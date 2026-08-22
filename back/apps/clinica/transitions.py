"""
Máquina de transições de status do Agendamento.

Define quais papéis podem mover um agendamento de um status para outro.
Função pura — sem acesso ao banco — usada pelo serializer de agendamento.
"""
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Papel
from apps.clinica.models import StatusAgendamento

# Mapa: status_atual → { papel → [status_destino, ...] }
# "qualquer" significa que qualquer papel autenticado pode executar a transição.
_QUALQUER = frozenset(Papel.values)

# O profissional (ou a direção) pode iniciar o atendimento — o cronômetro do
# prontuário — mesmo que a recepção ainda não tenha confirmado a chegada. Por
# isso ``EM_ATENDIMENTO`` é alcançável a partir de AGENDADO, PRE_CONFIRMADO e
# CONFIRMADO. O timestamp em si é gravado pela action ``iniciar_atendimento``.
_INICIA_ATENDIMENTO = frozenset([Papel.PROFISSIONAL, Papel.DIRECAO])

TRANSICOES_PERMITIDAS: dict[str, dict[frozenset, list[str]]] = {
    StatusAgendamento.AGENDADO: {
        frozenset([Papel.RECEPCAO, Papel.DIRECAO]): [StatusAgendamento.PRE_CONFIRMADO],
        _INICIA_ATENDIMENTO: [StatusAgendamento.EM_ATENDIMENTO],
        _QUALQUER: [StatusAgendamento.DESMARCADO],
    },
    StatusAgendamento.PRE_CONFIRMADO: {
        frozenset([Papel.PROFISSIONAL, Papel.DIRECAO]): [
            StatusAgendamento.CONFIRMADO,
            StatusAgendamento.EM_ATENDIMENTO,
        ],
        _QUALQUER: [StatusAgendamento.DESMARCADO],
    },
    StatusAgendamento.CONFIRMADO: {
        frozenset([Papel.PROFISSIONAL, Papel.DIRECAO]): [
            StatusAgendamento.EM_ATENDIMENTO,
            StatusAgendamento.ATENDIDO,
            StatusAgendamento.FALTA,
        ],
        _QUALQUER: [StatusAgendamento.DESMARCADO],
    },
    StatusAgendamento.EM_ATENDIMENTO: {
        frozenset([Papel.PROFISSIONAL, Papel.DIRECAO]): [StatusAgendamento.ATENDIDO],
        _QUALQUER: [StatusAgendamento.DESMARCADO],
    },
    # Estados terminais — nenhuma transição de saída
    StatusAgendamento.ATENDIDO:    {},
    StatusAgendamento.FALTA:       {},
    StatusAgendamento.DESMARCADO:  {},
}


def _destinos_para_papel(status_atual: str, role: str) -> list[str]:
    """Retorna todos os status-destino acessíveis para um papel a partir de status_atual."""
    transicoes = TRANSICOES_PERMITIDAS.get(status_atual, {})
    destinos: list[str] = []
    for papeis, alvos in transicoes.items():
        if role in papeis:
            destinos.extend(alvos)
    return destinos


def validar_transicao(status_atual: str, status_novo: str, role: str) -> None:
    """
    Valida se a transição status_atual → status_novo é permitida para o papel.

    Lança ``ValidationError`` se a transição é inválida para qualquer papel.
    Lança ``PermissionDenied`` se a transição é válida mas o papel não tem acesso.

    Não faz nada se status_atual == status_novo (nenhuma transição de fato).
    """
    if status_atual == status_novo:
        return

    transicoes = TRANSICOES_PERMITIDAS.get(status_atual, {})

    # Levanta todos os destinos possíveis (independente de papel) para mensagem de erro
    todos_destinos: set[str] = set()
    for alvos in transicoes.values():
        todos_destinos.update(alvos)

    if status_novo not in todos_destinos:
        raise ValidationError(
            {
                "status": (
                    f"Transição inválida: {status_atual} → {status_novo}. "
                    f"Transições permitidas a partir de '{status_atual}': "
                    f"{sorted(todos_destinos) or 'nenhuma (estado terminal)'}."
                )
            }
        )

    # Destino é válido — checar se o papel tem permissão
    destinos_do_papel = _destinos_para_papel(status_atual, role)
    if status_novo not in destinos_do_papel:
        raise PermissionDenied(
            f"Seu papel ({role}) não pode mover o agendamento de "
            f"'{status_atual}' para '{status_novo}'."
        )
