"""
Máquina de transições de status do Agendamento.

Define quais papéis podem mover um agendamento de um status para outro.
Função pura — sem acesso ao banco — usada pelo serializer de agendamento.

Política atual (decisão da clínica): **o status é editável manualmente**. Entre
os estados abertos (AGENDADO, PRE_CONFIRMADO, CONFIRMADO, EM_ATENDIMENTO) não há
trava de papel nem de ordem — qualquer papel autenticado pode, por exemplo,
mover AGENDADO → CONFIRMADO ou AGENDADO → EM_ATENDIMENTO direto. A única regra
que permanece é que os estados finais (ATENDIDO, FALTA, DESMARCADO) são
terminais: não têm transição de saída, porque são eles que alimentam o ledger de
produção e o financeiro.
"""
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Papel
from apps.clinica.models import StatusAgendamento

# Mapa: status_atual → { papel → [status_destino, ...] }
# "qualquer" significa que qualquer papel autenticado pode executar a transição.
_QUALQUER = frozenset(Papel.values)

# Estados abertos: o agendamento ainda está em andamento e pode ir para qualquer
# outro status (inclusive voltar atrás) sem restrição de papel.
STATUS_ABERTOS: tuple[str, ...] = (
    StatusAgendamento.AGENDADO,
    StatusAgendamento.PRE_CONFIRMADO,
    StatusAgendamento.CONFIRMADO,
    StatusAgendamento.EM_ATENDIMENTO,
)

# Estados finais: alimentam produção/financeiro e não têm transição de saída.
STATUS_TERMINAIS: tuple[str, ...] = (
    StatusAgendamento.ATENDIDO,
    StatusAgendamento.FALTA,
    StatusAgendamento.DESMARCADO,
)

TRANSICOES_PERMITIDAS: dict[str, dict[frozenset, list[str]]] = {
    **{
        origem: {
            _QUALQUER: [destino for destino in StatusAgendamento.values if destino != origem]
        }
        for origem in STATUS_ABERTOS
    },
    **{terminal: {} for terminal in STATUS_TERMINAIS},
}


def _normalizar_papeis(papeis) -> frozenset:
    """Aceita um único papel (str) ou um conjunto/iterável de papéis."""
    if isinstance(papeis, str):
        return frozenset([papeis])
    return frozenset(papeis)


def _destinos_para_papeis(status_atual: str, papeis) -> list[str]:
    """Todos os status-destino acessíveis para o conjunto de papéis do usuário."""
    papeis = _normalizar_papeis(papeis)
    transicoes = TRANSICOES_PERMITIDAS.get(status_atual, {})
    destinos: list[str] = []
    for grupo, alvos in transicoes.items():
        if papeis & grupo:  # o usuário tem algum papel do grupo
            destinos.extend(alvos)
    return destinos


def validar_transicao(status_atual: str, status_novo: str, papeis) -> None:
    """
    Valida se a transição status_atual → status_novo é permitida.

    ``papeis`` pode ser um único papel (str) ou o conjunto de papéis do usuário
    (multi-papel): basta ter **algum** papel autorizado para a transição.

    Lança ``ValidationError`` se a transição é inválida para qualquer papel
    (hoje, apenas saídas de estado terminal).
    Lança ``PermissionDenied`` se a transição é válida mas nenhum papel tem acesso.
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

    # Destino é válido — checar se algum papel do usuário tem permissão
    destinos_do_papel = _destinos_para_papeis(status_atual, papeis)
    if status_novo not in destinos_do_papel:
        papeis_txt = ", ".join(sorted(_normalizar_papeis(papeis))) or "sem papel"
        raise PermissionDenied(
            f"Seu papel ({papeis_txt}) não pode mover o agendamento de "
            f"'{status_atual}' para '{status_novo}'."
        )
