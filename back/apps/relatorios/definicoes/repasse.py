"""
Relatório de Repasse ao profissional.

Base de cálculo: os **atendimentos efetivamente pagos**
(``financeiro.PagamentoAgendamento``), somando o campo
``valor_repasse_calculado`` — o snapshot do repasse do serviço gravado no momento
da baixa. Essa é a mesma regra do dashboard do terapeuta
(``DashboardTerapeutaView``), então os valores batem entre as duas telas mesmo que
o ``Servico`` seja reajustado depois.

A planilha traz duas abas de leitura em uma: cada linha é um atendimento pago, e
a coluna ``valor_repasse`` é somada no total — é o extrato que acompanha o
pagamento do profissional. O agrupamento por profissional vem no ``resumo``,
usado pelos cartões da tela.

Acesso restrito a DIREÇÃO e FINANCEIRO.
"""
from collections import defaultdict
from decimal import Decimal

from apps.financeiro.models import FormaPagamento, PagamentoAgendamento
from apps.relatorios.definicoes.base import Coluna, Formato, RelatorioBase, rotulos
from apps.relatorios.filtros import Filtros, validar_escolhas

_FORMAS = rotulos(FormaPagamento)


class RelatorioRepasse(RelatorioBase):
    slug = "repasse"
    titulo = "Relatório de Repasse por Profissional"
    nome_aba = "Repasse"
    prefixo_arquivo = "relatorio_repasse"
    campos_filtro = (
        "data_inicio",
        "data_fim",
        "profissional",
        "paciente",
        "forma_pagamento",
    )
    colunas = [
        Coluna("profissional", "Profissional", largura=28),
        Coluna("conselho", "Registro no conselho", largura=20),
        Coluna("data", "Data do atendimento", Formato.DATA, largura=18),
        Coluna("paciente", "Paciente", largura=32),
        Coluna("servico", "Serviço", largura=30),
        Coluna("valor_cobrado", "Valor cobrado", Formato.MOEDA, largura=16, somar=True),
        Coluna("valor_pago", "Valor pago", Formato.MOEDA, largura=14, somar=True),
        Coluna("forma_pagamento", "Forma de pagamento", largura=20),
        Coluna("valor_repasse", "Repasse ao profissional", Formato.MOEDA, largura=22, somar=True),
        Coluna("retencao_clinica", "Retenção da clínica", Formato.MOEDA, largura=20, somar=True),
        Coluna("baixa_em", "Baixa registrada em", Formato.DATA_HORA, largura=20),
        Coluna("registrado_por", "Baixa registrada por", largura=26),
    ]

    def queryset(self, usuario, filtros: Filtros):
        qs = PagamentoAgendamento.objects.select_related(
            "agendamento",
            "agendamento__paciente",
            "agendamento__profissional",
            "agendamento__servico",
            "registrado_por",
        )

        # O recorte de data é a **data do atendimento**, não a data da baixa: é
        # assim que o fechamento do repasse é conferido com a agenda do mês.
        if filtros.data_inicio:
            qs = qs.filter(agendamento__data__gte=filtros.data_inicio)
        if filtros.data_fim:
            qs = qs.filter(agendamento__data__lte=filtros.data_fim)
        if filtros.profissional:
            qs = qs.filter(agendamento__profissional_id=filtros.profissional)
        if filtros.paciente:
            qs = qs.filter(agendamento__paciente_id=filtros.paciente)
        if filtros.forma_pagamento:
            validar_escolhas(
                (filtros.forma_pagamento,), FormaPagamento.values, "forma_pagamento"
            )
            qs = qs.filter(forma_pagamento=filtros.forma_pagamento)

        return qs.order_by(
            "agendamento__profissional__nome", "agendamento__data"
        )

    def linha(self, pagamento: PagamentoAgendamento) -> dict:
        agendamento = pagamento.agendamento
        profissional = agendamento.profissional
        repasse = pagamento.valor_repasse_calculado or Decimal("0")
        return {
            "profissional": profissional.nome,
            "conselho": profissional.conselho or "",
            "data": agendamento.data,
            "paciente": agendamento.paciente.nome_completo,
            "servico": agendamento.servico.nome,
            "valor_cobrado": agendamento.servico.valor_clinica,
            "valor_pago": pagamento.valor_pago,
            "forma_pagamento": _FORMAS.get(
                pagamento.forma_pagamento, pagamento.forma_pagamento
            ),
            "valor_repasse": repasse,
            "retencao_clinica": (pagamento.valor_pago or Decimal("0")) - repasse,
            "baixa_em": pagamento.criado_em,
            "registrado_por": pagamento.registrado_por.nome,
        }

    def resumo(self, linhas: list[dict]) -> dict:
        """
        Acrescenta ao resumo padrão o consolidado **por profissional** — é o
        número que a direção efetivamente usa para pagar cada um.
        """
        base = super().resumo(linhas)

        acumulado: dict[str, dict] = defaultdict(
            lambda: {"atendimentos": 0, "valor_pago": 0.0, "valor_repasse": 0.0}
        )
        for linha in linhas:
            item = acumulado[linha["profissional"]]
            item["atendimentos"] += 1
            item["valor_pago"] += float(linha.get("valor_pago") or 0)
            item["valor_repasse"] += float(linha.get("valor_repasse") or 0)

        base["por_profissional"] = [
            {"profissional": nome, **valores}
            for nome, valores in sorted(acumulado.items())
        ]
        return base

    def descrever_filtros_especificos(self, filtros: Filtros) -> list[str]:
        if not filtros.forma_pagamento:
            return []
        rotulo = _FORMAS.get(filtros.forma_pagamento, filtros.forma_pagamento)
        return [f"Forma de pagamento: {rotulo}"]
