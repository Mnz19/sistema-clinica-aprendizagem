"""
Sincronização automática ``Agendamento`` → ``Producao`` (signal post_save).

O signal ``sincronizar_producao_com_agendamento`` mantém o ledger de produção
alinhado ao status do agendamento. Estes testes cobrem cada status do enum
``StatusAgendamento`` — a regressão que motivou o arquivo foi o signal referenciar
nomes de status (``REALIZADO``/``CANCELADO``) e campo (``servico.valor``) que não
existem mais no modelo, derrubando qualquer POST de agendamento com erro 500.
"""
from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.clinica.models import Agendamento, Producao, StatusAgendamento
from apps.clinica.signals import (
    MOTIVO_CANCELAMENTO_TARDIO,
    MOTIVO_FALTA,
    MOTIVO_REALIZADO,
)
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

VALOR_CLINICA = "150.00"
VALOR_REPASSE = "90.00"


@pytest.fixture
def paciente(db):
    return Paciente.objects.create(nome_completo="Paciente Teste", data_nascimento="2015-01-01")


@pytest.fixture
def servico(cria_servico):
    return cria_servico(valor_clinica=VALOR_CLINICA, valor_repasse=VALOR_REPASSE)


@pytest.fixture
def cria_agendamento(db, paciente, profissional, cria_sala, servico):
    """
    Fábrica de agendamentos. ``inicio`` controla data/horário (default: daqui a
    2 dias), útil para exercitar a regra de cancelamento tardio (< 8h) vs. com
    antecedência. O signal roda automaticamente no ``save``.
    """
    sala = cria_sala()

    def _cria(status, inicio: datetime | None = None):
        if inicio is None:
            inicio = timezone.localtime() + timedelta(days=2)
        fim = inicio + timedelta(minutes=50)
        return Agendamento.objects.create(
            paciente=paciente,
            profissional=profissional,
            sala=sala,
            servico=servico,
            data=inicio.date(),
            horario_inicio=inicio.time(),
            horario_fim=fim.time(),
            status=status,
            parecer_status="Justificativa" if status in (StatusAgendamento.FALTA, StatusAgendamento.DESMARCADO) else "",
        )

    return _cria


def test_atendido_cria_producao(cria_agendamento):
    """ATENDIDO → snapshot com motivo 'realizado' e valor = valor_clinica do serviço."""
    ag = cria_agendamento(StatusAgendamento.ATENDIDO)
    prod = Producao.objects.get(agendamento=ag)
    assert prod.motivo == MOTIVO_REALIZADO
    assert str(prod.valor) == VALOR_CLINICA
    assert prod.servico_nome == ag.servico.nome
    assert prod.paciente == ag.paciente
    assert prod.profissional == ag.profissional


def test_falta_cria_producao(cria_agendamento):
    """FALTA → snapshot com motivo 'falta'."""
    ag = cria_agendamento(StatusAgendamento.FALTA)
    prod = Producao.objects.get(agendamento=ag)
    assert prod.motivo == MOTIVO_FALTA
    assert str(prod.valor) == VALOR_CLINICA


def test_desmarcado_tardio_cria_producao(cria_agendamento):
    """DESMARCADO a menos de 8h do início → cobra (cancelamento tardio)."""
    inicio = timezone.localtime() + timedelta(hours=2)
    ag = cria_agendamento(StatusAgendamento.DESMARCADO, inicio=inicio)
    prod = Producao.objects.get(agendamento=ag)
    assert prod.motivo == MOTIVO_CANCELAMENTO_TARDIO


def test_desmarcado_com_antecedencia_nao_cria_producao(cria_agendamento):
    """DESMARCADO com mais de 8h de antecedência → não cobra."""
    inicio = timezone.localtime() + timedelta(days=3)
    ag = cria_agendamento(StatusAgendamento.DESMARCADO, inicio=inicio)
    assert not Producao.objects.filter(agendamento=ag).exists()


@pytest.mark.parametrize(
    "status",
    [StatusAgendamento.AGENDADO, StatusAgendamento.PRE_CONFIRMADO, StatusAgendamento.CONFIRMADO],
)
def test_status_sem_cobranca_nao_cria_producao(cria_agendamento, status):
    """AGENDADO / PRE_CONFIRMADO / CONFIRMADO não geram produção."""
    ag = cria_agendamento(status)
    assert not Producao.objects.filter(agendamento=ag).exists()


def test_transicao_atendido_para_agendado_remove_producao(cria_agendamento):
    """Voltar de ATENDIDO para AGENDADO limpa o ledger (correção da recepção)."""
    ag = cria_agendamento(StatusAgendamento.ATENDIDO)
    assert Producao.objects.filter(agendamento=ag).exists()

    ag.status = StatusAgendamento.AGENDADO
    ag.save()
    assert not Producao.objects.filter(agendamento=ag).exists()
