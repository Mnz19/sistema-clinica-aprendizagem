"""
Utilidades compartilhadas pelos quatro relatórios.

**Rótulo de filtro por FK**: o cabeçalho da planilha mostra o *nome* do
profissional/paciente filtrado, não o id, para a exportação ser legível depois.

(A conversão de fuso dos datetimes vive em ``excel.py``: é uma limitação do
formato da planilha, não uma regra dos relatórios. No JSON o datetime sai com
offset, que é o que o frontend espera.)
"""
from __future__ import annotations

from django.db.models import Model


def rotulo_registro(
    modelo: type[Model], pk: int | None, prefixo: str, campo: str = "nome"
) -> str | None:
    """
    Monta o rótulo ``"Prefixo: Nome"`` de um filtro por chave estrangeira.

    Devolve ``None`` se não houver filtro. Se o id não existir mais, cai para
    ``"Prefixo: #id"`` em vez de estourar — o filtro em si já não casa com nada
    e a planilha sai vazia, que é a resposta correta.
    """
    if not pk:
        return None
    nome = (
        modelo._default_manager.filter(pk=pk)
        .values_list(campo, flat=True)
        .first()
    )
    return f"{prefixo}: {nome}" if nome else f"{prefixo}: #{pk}"


def formatar_conselho(tipo: str, uf: str, numero: str) -> str:
    """
    Monta o registro no conselho (ex.: ``CRP PA/1009775``).

    Replica ``Usuario.conselho`` para a visão consolidada do repasse, que agrega
    por ``values()`` e portanto não tem a instância do usuário para ler a
    property. Mantém o mesmo formato para os dois modos não divergirem.
    """
    if not (tipo and numero):
        return ""
    sufixo_uf = f" {uf}" if uf else ""
    return f"{tipo}{sufixo_uf}/{numero}"
