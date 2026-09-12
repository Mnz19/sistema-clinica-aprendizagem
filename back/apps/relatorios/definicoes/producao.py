"""
Relatório de Produção.

Exporta o ledger de faturamento (``clinica.Producao``): o snapshot do valor
cobrado pela clínica em cada atendimento que gerou cobrança — realizado, falta
ou cancelamento tardio. É a base da conciliação contábil.

Acesso restrito a DIREÇÃO e FINANCEIRO: expõe o valor cobrado de toda a clínica.
"""
from apps.clinica.models import Producao
from apps.clinica.signals import (
    MOTIVO_CANCELAMENTO_TARDIO,
    MOTIVO_FALTA,
    MOTIVO_REALIZADO,
)
from apps.relatorios.definicoes.base import Coluna, Formato, RelatorioBase
from apps.relatorios.filtros import Filtros, validar_escolhas

#: Motivos gravados pelo signal que alimenta o ledger (``clinica.signals``).
MOTIVOS = (MOTIVO_REALIZADO, MOTIVO_FALTA, MOTIVO_CANCELAMENTO_TARDIO)


class RelatorioProducao(RelatorioBase):
    slug = "producao"
    titulo = "Relatório de Produção"
    nome_aba = "Produção"
    prefixo_arquivo = "relatorio_producao"
    campos_filtro = (
        "data_inicio",
        "data_fim",
        "profissional",
        "paciente",
        "motivo",
    )
    colunas = [
        Coluna("data", "Data", Formato.DATA, largura=12),
        Coluna("paciente", "Paciente", largura=32),
        Coluna("profissional", "Profissional", largura=28),
        Coluna("servico_nome", "Serviço", largura=30),
        Coluna("motivo", "Motivo da cobrança", largura=26),
        Coluna("status_agendamento", "Status do agendamento", largura=20),
        Coluna("valor", "Valor produzido", Formato.MOEDA, largura=16, somar=True),
        Coluna("pagamento_situacao", "Pagamento", largura=14),
        Coluna("valor_pago", "Valor pago", Formato.MOEDA, largura=14, somar=True),
        Coluna("forma_pagamento", "Forma de pagamento", largura=20),
        Coluna("lancado_em", "Lançado em", Formato.DATA_HORA, largura=18),
    ]

    def queryset(self, usuario, filtros: Filtros):
        qs = Producao.objects.select_related(
            "paciente", "profissional", "agendamento", "agendamento__pagamento"
        )

        if filtros.data_inicio:
            qs = qs.filter(data__gte=filtros.data_inicio)
        if filtros.data_fim:
            qs = qs.filter(data__lte=filtros.data_fim)
        if filtros.profissional:
            qs = qs.filter(profissional_id=filtros.profissional)
        if filtros.paciente:
            qs = qs.filter(paciente_id=filtros.paciente)
        if filtros.motivo:
            validar_escolhas((filtros.motivo,), MOTIVOS, "motivo")
            qs = qs.filter(motivo=filtros.motivo)

        return qs.order_by("data", "paciente__nome_completo")

    def linha(self, producao: Producao) -> dict:
        from apps.clinica.models import StatusAgendamento
        from apps.financeiro.models import FormaPagamento

        agendamento = producao.agendamento
        pagamento = getattr(agendamento, "pagamento", None)
        return {
            "data": producao.data,
            "paciente": producao.paciente.nome_completo,
            "profissional": producao.profissional.nome,
            "servico_nome": producao.servico_nome,
            "motivo": producao.motivo,
            "status_agendamento": dict(StatusAgendamento.choices).get(
                agendamento.status, agendamento.status
            ),
            "valor": producao.valor,
            "pagamento_situacao": "Pago" if pagamento else "Em aberto",
            "valor_pago": pagamento.valor_pago if pagamento else None,
            "forma_pagamento": (
                dict(FormaPagamento.choices).get(
                    pagamento.forma_pagamento, pagamento.forma_pagamento
                )
                if pagamento
                else ""
            ),
            "lancado_em": producao.criado_em,
        }

    def descrever_filtros_especificos(self, filtros: Filtros) -> list[str]:
        return [f"Motivo: {filtros.motivo}"] if filtros.motivo else []
