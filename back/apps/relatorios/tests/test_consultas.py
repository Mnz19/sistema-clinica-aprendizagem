"""
Testes de eficiência de consulta (N+1).

Os relatórios varrem centenas a milhares de registros e tocam vários vínculos
por linha (responsável principal, profissionais, pagamento). Sem o
``select_related``/``Prefetch`` correto, o custo cresce com o número de linhas e
a exportação trava. Estes testes fixam o número de queries como **constante**
em relação à quantidade de registros.
"""
from datetime import date, time
from decimal import Decimal

import pytest

from apps.clinica.models import Agendamento, StatusAgendamento
from apps.financeiro.models import FormaPagamento, PagamentoAgendamento
from apps.pacientes.models import Paciente, Parentesco, Responsavel

pytestmark = pytest.mark.django_db

URL_PACIENTES = "/api/relatorios/pacientes/"
URL_AGENDAMENTOS = "/api/relatorios/agendamentos/"
URL_PRODUCAO = "/api/relatorios/producao/"
URL_REPASSE = "/api/relatorios/repasse/"

#: Teto de queries por requisição, independente do volume de linhas.
#: Cobre auth + a consulta do relatório + os prefetches (nunca por linha).
TETO_QUERIES = 12


@pytest.fixture
def muitos_pacientes(db, profissional):
    """10 pacientes, cada um com responsável principal e profissional vinculado."""
    for indice in range(10):
        paciente = Paciente.objects.create(
            nome_completo=f"Paciente {indice:02d}",
            data_nascimento=date(2015, 1, 1),
            cidade="Belém",
            estado="PA",
        )
        paciente.profissionais.add(profissional)
        Responsavel.objects.create(
            paciente=paciente,
            nome=f"Responsável {indice:02d}",
            parentesco=Parentesco.MAE,
            principal=True,
        )


@pytest.fixture
def muitos_atendimentos(db, paciente, profissional, sala, servico, financeiro):
    """10 atendimentos, todos com baixa de pagamento (alimenta produção e repasse)."""
    for indice in range(10):
        agendamento = Agendamento.objects.create(
            paciente=paciente,
            profissional=profissional,
            sala=sala,
            servico=servico,
            data=date(2026, 11, 2),
            horario_inicio=time(8 + indice, 0),
            horario_fim=time(8 + indice, 50),
            status=StatusAgendamento.ATENDIDO,
        )
        PagamentoAgendamento.objects.create(
            agendamento=agendamento,
            valor_pago=Decimal("200.00"),
            forma_pagamento=FormaPagamento.PIX,
            valor_repasse_calculado=Decimal("120.00"),
            registrado_por=financeiro,
        )


def test_pacientes_nao_faz_n_mais_um(
    api, direcao, muitos_pacientes, django_assert_max_num_queries
):
    """Responsável principal e profissionais vêm por prefetch, não por linha."""
    with django_assert_max_num_queries(TETO_QUERIES):
        resposta = api(direcao).get(URL_PACIENTES)

    assert resposta.data["total_registros"] == 10


def test_agendamentos_nao_faz_n_mais_um(
    api, direcao, muitos_atendimentos, django_assert_max_num_queries
):
    """Paciente, profissional, sala, serviço e série vêm por select_related."""
    with django_assert_max_num_queries(TETO_QUERIES):
        resposta = api(direcao).get(URL_AGENDAMENTOS)

    assert resposta.data["total_registros"] == 10


def test_producao_nao_faz_n_mais_um(
    api, direcao, muitos_atendimentos, django_assert_max_num_queries
):
    """A baixa de pagamento (OneToOne reverso) entra no select_related."""
    with django_assert_max_num_queries(TETO_QUERIES):
        resposta = api(direcao).get(URL_PRODUCAO)

    assert resposta.data["total_registros"] == 10


def test_repasse_nao_faz_n_mais_um(
    api, direcao, muitos_atendimentos, django_assert_max_num_queries
):
    """Agendamento, paciente, profissional e serviço vêm por select_related."""
    with django_assert_max_num_queries(TETO_QUERIES):
        resposta = api(direcao).get(URL_REPASSE)

    assert resposta.data["total_registros"] == 10


def test_repasse_consolidado_agrega_no_banco(
    api, direcao, muitos_atendimentos, django_assert_max_num_queries
):
    """A visão consolidada soma via ``annotate``, sem trazer linha por linha."""
    with django_assert_max_num_queries(TETO_QUERIES):
        resposta = api(direcao).get(URL_REPASSE, {"agrupar": "true"})

    # 10 atendimentos do mesmo profissional colapsam em uma linha.
    assert resposta.data["total_registros"] == 1
    assert resposta.data["linhas"][0]["atendimentos"] == 10
