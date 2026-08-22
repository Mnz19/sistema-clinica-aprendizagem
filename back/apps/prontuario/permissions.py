"""
Permissões do prontuário eletrônico.

- ``PodeAcessarProntuario``    : acesso ao módulo (preenchimento/leitura) — DIREÇÃO,
  SUPERVISÃO e PROFISSIONAL. Recepção e Financeiro **não** acessam o prontuário.
- ``PodeConfigurarProntuario`` : configuração dos itens/atestados/replicar/protocolos
  — exclusiva da DIREÇÃO.

O recorte por paciente (profissional só vê os seus) é feito no ``get_queryset``.
"""
from apps.accounts.models import Papel
from apps.accounts.permissions import tem_papel

PodeAcessarProntuario = tem_papel(
    Papel.DIRECAO,
    Papel.SUPERVISAO,
    Papel.PROFISSIONAL,
)

PodeConfigurarProntuario = tem_papel(Papel.DIRECAO)
