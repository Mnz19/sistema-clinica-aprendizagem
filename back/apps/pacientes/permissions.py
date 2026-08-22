"""
Permissões do módulo de pacientes.

Regras (baseadas na fundação de ``apps.accounts.permissions``):

- DIREÇÃO e SUPERVISÃO: acesso a todos os pacientes.
- RECEPÇÃO: acesso ao cadastro de todos os pacientes (a restrição de prontuário
  virá no módulo de prontuário; o cadastro/anexos são parte da recepção).
- PROFISSIONAL: acesso apenas aos pacientes aos quais está vinculado.
- FINANCEIRO: sem acesso ao cadastro de pacientes nesta fase.

O filtro por vínculo do profissional é aplicado no ``get_queryset`` das views;
aqui garantimos apenas que o papel pode usar o módulo.
"""
from apps.accounts.models import Papel
from apps.accounts.permissions import tem_papel

# Papéis autorizados a acessar o módulo de pacientes.
PodeAcessarPacientes = tem_papel(
    Papel.DIRECAO,
    Papel.SUPERVISAO,
    Papel.RECEPCAO,
    Papel.PROFISSIONAL,
)
