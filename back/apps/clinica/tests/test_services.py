"""Testes de T08 — RecorrenciaService: gerar_datas (unit) + criar_serie (integration)."""
from datetime import date, time, timedelta

import pytest
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Frequencia, SerieRecorrente, StatusAgendamento, Sala, Servico
from apps.clinica.services import MAX_OCORRENCIAS, criar_serie, gerar_datas
from apps.pacientes.models import Paciente

SENHA = "SenhaForte123!"

# ---------------------------------------------------------------------------
# Testes unitários — gerar_datas (sem DB)
# ---------------------------------------------------------------------------

def test_gerar_datas_semanal():
    """SEMANAL: 4 semanas gera exatamente 4 datas com intervalo de 7 dias."""
    inicio = date(2026, 9, 1)
    fim = date(2026, 9, 22)
    datas = gerar_datas(inicio, Frequencia.SEMANAL, fim)
    assert len(datas) == 4
    assert datas[0] == date(2026, 9, 1)
    assert datas[1] == date(2026, 9, 8)
    assert datas[3] == date(2026, 9, 22)


def test_gerar_datas_quinzenal():
    """QUINZENAL: 2 quinzenas gera 2 datas com intervalo de 14 dias."""
    inicio = date(2026, 9, 1)
    fim = date(2026, 9, 15)
    datas = gerar_datas(inicio, Frequencia.QUINZENAL, fim)
    assert len(datas) == 2
    assert datas[1] == date(2026, 9, 15)


def test_gerar_datas_mensal():
    """MENSAL: 3 meses gera 3 datas."""
    inicio = date(2026, 9, 1)
    fim = date(2026, 11, 30)
    datas = gerar_datas(inicio, Frequencia.MENSAL, fim)
    assert len(datas) == 3
    assert datas[1] == date(2026, 10, 1)
    assert datas[2] == date(2026, 11, 1)


def test_gerar_datas_data_fim_anterior_levanta_erro():
    """data_fim < data_inicio → ValidationError."""
    with pytest.raises(ValidationError):
        gerar_datas(date(2026, 9, 10), Frequencia.SEMANAL, date(2026, 9, 1))


def test_gerar_datas_excede_limite():
    """Mais de MAX_OCORRENCIAS → ValidationError com mensagem sobre limite."""
    inicio = date(2026, 1, 1)
    fim = date(2028, 12, 31)
    with pytest.raises(ValidationError) as exc_info:
        gerar_datas(inicio, Frequencia.SEMANAL, fim)
    assert str(MAX_OCORRENCIAS) in str(exc_info.value)


def test_gerar_datas_exatamente_no_limite():
    """Exatamente MAX_OCORRENCIAS (104 semanais ≈ 2 anos) não levanta erro."""
    inicio = date(2026, 1, 5)
    fim = inicio + timedelta(weeks=MAX_OCORRENCIAS - 1)
    datas = gerar_datas(inicio, Frequencia.SEMANAL, fim)
    assert len(datas) == MAX_OCORRENCIAS


# ---------------------------------------------------------------------------
# Testes de integração — criar_serie (com DB)
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.django_db


@pytest.fixture
def usuario(db, django_user_model):
    return django_user_model.objects.create_user(
        email="prof@test.com", password=SENHA, role=Papel.PROFISSIONAL, nome="Prof"
    )


@pytest.fixture
def direcao(db, django_user_model):
    return django_user_model.objects.create_user(
        email="dir@test.com", password=SENHA, role=Papel.DIRECAO, nome="Dir"
    )


@pytest.fixture
def paciente(db):
    return Paciente.objects.create(nome_completo="Pac", data_nascimento="2015-01-01")


@pytest.fixture
def sala(db):
    return Sala.objects.create(nome="Sala S")


@pytest.fixture
def servico(db, usuario):
    servico = Servico.objects.create(
        nome="Terapia", duracao_minutos=50,
        valor_clinica="150.00", valor_repasse="0.00"
    )
    servico.profissionais.add(usuario)
    return servico


@pytest.fixture
def agendamento_base(db, paciente, usuario, sala, servico):
    return Agendamento.objects.create(
        paciente=paciente, profissional=usuario, sala=sala, servico=servico,
        data=date(2026, 9, 1), horario_inicio=time(10, 0), horario_fim=time(10, 50),
        status=StatusAgendamento.AGENDADO,
    )


def test_criar_serie_semanal_4_semanas(agendamento_base, direcao):
    """criar_serie gera 3 agendamentos futuros (4ª semana = ag_origem + 3)."""
    criados, nao_criados = criar_serie(
        agendamento_base, Frequencia.SEMANAL, date(2026, 9, 22), direcao
    )
    assert len(criados) == 3
    assert len(nao_criados) == 0
    assert Agendamento.objects.count() == 4  # origem + 3 criados
    # Série criada
    assert SerieRecorrente.objects.count() == 1
    # Origem vinculada
    agendamento_base.refresh_from_db()
    assert agendamento_base.serie is not None
    assert agendamento_base.numero_na_serie == 1


def test_criar_serie_com_conflito_parcial(agendamento_base, direcao, sala, servico, paciente, usuario):
    """Conflito em uma data → cria demais e lista a data não criada."""
    # Série começa em 09-02 (dia seguinte ao agendamento_base 09-01), vai: 09-02, 09-09, 09-16
    # Conflito na 2ª data da série (09-09)
    Agendamento.objects.create(
        paciente=paciente, profissional=usuario, sala=sala, servico=servico,
        data=date(2026, 9, 9), horario_inicio=time(10, 0), horario_fim=time(10, 50),
        status=StatusAgendamento.AGENDADO,
    )

    criados, nao_criados = criar_serie(
        agendamento_base, Frequencia.SEMANAL, date(2026, 9, 20), direcao
    )

    assert len(nao_criados) == 1
    assert nao_criados[0]["data"] == "2026-09-09"
    assert len(criados) == 2


def test_criar_serie_data_fim_anterior_retorna_vazio(agendamento_base, direcao):
    """data_fim ≤ agendamento.data → retorna listas vazias sem erro."""
    criados, nao_criados = criar_serie(
        agendamento_base, Frequencia.SEMANAL, agendamento_base.data, direcao
    )
    assert criados == []
    assert nao_criados == []
