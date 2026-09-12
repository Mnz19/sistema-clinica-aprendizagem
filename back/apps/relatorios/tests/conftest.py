"""
Fixtures compartilhadas pelos testes da aba de Relatórios.

Monta um cenário pequeno mas completo — paciente com responsável, serviço com
repasse, agendamentos em vários status (o signal gera a produção) e uma baixa
de pagamento — para que os quatro relatórios tenham o que reportar.
"""
from datetime import date, time
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento
from apps.financeiro.models import FormaPagamento, PagamentoAgendamento
from apps.pacientes.models import Paciente, Parentesco, Responsavel

SENHA = "SenhaForte123!"


@pytest.fixture
def cria_usuario(db, django_user_model):
    """Cria um usuário com o papel informado."""

    def _cria(email, papel, nome="Usuário"):
        return django_user_model.objects.create_user(
            email=email, password=SENHA, role=papel, nome=nome
        )

    return _cria


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario("direcao@clinica.com", Papel.DIRECAO, "Direção")


@pytest.fixture
def financeiro(cria_usuario):
    return cria_usuario("financeiro@clinica.com", Papel.FINANCEIRO, "Financeiro")


@pytest.fixture
def recepcao(cria_usuario):
    return cria_usuario("recepcao@clinica.com", Papel.RECEPCAO, "Recepção")


@pytest.fixture
def supervisao(cria_usuario):
    return cria_usuario("supervisao@clinica.com", Papel.SUPERVISAO, "Supervisão")


@pytest.fixture
def profissional(cria_usuario):
    usuario = cria_usuario("prof@clinica.com", Papel.PROFISSIONAL, "Ana Terapeuta")
    usuario.conselho_tipo = "CRP"
    usuario.conselho_uf = "PA"
    usuario.conselho_numero = "1009775"
    usuario.save()
    return usuario


@pytest.fixture
def api(db):
    """Cliente autenticado como o usuário informado."""

    def _cliente(usuario):
        cliente = APIClient()
        cliente.force_authenticate(user=usuario)
        return cliente

    return _cliente


@pytest.fixture
def paciente(db, profissional):
    """Paciente completo, com responsável principal e profissional vinculado."""
    paciente = Paciente.objects.create(
        nome_completo="João da Silva",
        data_nascimento=date(2015, 3, 10),
        telefone="91988887777",
        cidade="Belém",
        estado="PA",
        escola="Escola Modelo",
        diagnostico="TDAH",
        cid="F90.0",
    )
    paciente.profissionais.add(profissional)
    Responsavel.objects.create(
        paciente=paciente,
        nome="Maria da Silva",
        parentesco=Parentesco.MAE,
        telefone="91999998888",
        principal=True,
    )
    return paciente


@pytest.fixture
def servico(db, profissional):
    servico = Servico.objects.create(
        nome="Psicoterapia",
        duracao_minutos=50,
        valor_clinica=Decimal("200.00"),
        valor_repasse=Decimal("120.00"),
    )
    servico.profissionais.add(profissional)
    return servico


@pytest.fixture
def sala(db):
    return Sala.objects.create(nome="Sala 1")


@pytest.fixture
def agendamentos(db, paciente, profissional, sala, servico):
    """
    Três agendamentos: ATENDIDO, FALTA e AGENDADO.

    O signal de ``Agendamento`` gera produção para os dois primeiros; o terceiro
    não gera nada (serve para provar que o relatório de produção não o inclui).
    """

    def _cria(dia, hora, status):
        return Agendamento.objects.create(
            paciente=paciente,
            profissional=profissional,
            sala=sala,
            servico=servico,
            data=dia,
            horario_inicio=hora,
            horario_fim=time(hora.hour, hora.minute + 50),
            status=status,
            parecer_status="Paciente não compareceu"
            if status == StatusAgendamento.FALTA
            else "",
        )

    return {
        "atendido": _cria(date(2026, 11, 2), time(9, 0), StatusAgendamento.ATENDIDO),
        "falta": _cria(date(2026, 11, 5), time(10, 0), StatusAgendamento.FALTA),
        "agendado": _cria(date(2026, 11, 20), time(14, 0), StatusAgendamento.AGENDADO),
    }


@pytest.fixture
def pagamento(db, agendamentos, financeiro):
    """Baixa de pagamento do agendamento ATENDIDO — base do repasse."""
    return PagamentoAgendamento.objects.create(
        agendamento=agendamentos["atendido"],
        valor_pago=Decimal("200.00"),
        forma_pagamento=FormaPagamento.PIX,
        valor_repasse_calculado=Decimal("120.00"),
        registrado_por=financeiro,
    )
