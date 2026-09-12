"""
Permissões da aba de Relatórios.

Cada relatório tem um conjunto próprio de papéis, porque a aba mistura dado
operacional (pacientes, agenda) com dado financeiro (produção, repasse):

- **Pacientes** e **Agendamentos** → DIREÇÃO, SUPERVISÃO e RECEPÇÃO. A recepção
  precisa dos dois para o dia a dia do atendimento.
- **Produção** e **Repasse** → DIREÇÃO e FINANCEIRO. Expõem valor cobrado e
  repasse de toda a clínica, então ficam fora do alcance da recepção, da
  supervisão e do profissional.

``PAPEIS_*`` é a fonte da verdade: as classes de permissão, o filtro de papéis
por relatório e o espelho no frontend (``front/src/types/relatorio.ts``) derivam
todos dessas tuplas.
"""
from apps.accounts.models import Papel
from apps.accounts.permissions import TemPapel

#: Papéis que enxergam os relatórios operacionais (pacientes e agendamentos).
PAPEIS_RELATORIO_OPERACIONAL = (Papel.DIRECAO, Papel.SUPERVISAO, Papel.RECEPCAO)

#: Papéis que enxergam os relatórios financeiros (produção e repasse).
PAPEIS_RELATORIO_FINANCEIRO = (Papel.DIRECAO, Papel.FINANCEIRO)


class PodeVerRelatorioOperacional(TemPapel):
    """Relatórios de pacientes e agendamentos (DIREÇÃO, SUPERVISÃO, RECEPÇÃO)."""

    papeis_permitidos = PAPEIS_RELATORIO_OPERACIONAL


class PodeVerRelatorioFinanceiro(TemPapel):
    """Relatórios de produção e repasse (DIREÇÃO, FINANCEIRO)."""

    papeis_permitidos = PAPEIS_RELATORIO_FINANCEIRO
