"""
Testes do suporte a múltiplos papéis por usuário.

Cobrem: derivação do papel principal, helpers (eh_profissional/somente_profissional),
compat do ``create_user(role=...)``, criação/edição via API com ``papeis``, filtro
``?papel=`` do endpoint e o fato de um DIREÇÃO+PROFISSIONAL poder ser agendado.
"""
from datetime import date, time

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Especialidade, Papel
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento
from apps.clinica.serializers import AgendamentoSerializer
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

SENHA = "SenhaForte123!"


def _cliente(usuario):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(usuario).access_token}")
    return c


# --- Modelo -----------------------------------------------------------------
def test_create_user_role_popula_papeis(django_user_model):
    u = django_user_model.objects.create_user(
        email="rec@c.com", password=SENHA, nome="Rec", role=Papel.RECEPCAO
    )
    assert u.papeis_codigos == {Papel.RECEPCAO}
    assert u.role == Papel.RECEPCAO
    assert u.somente_profissional is False
    assert u.eh_profissional is False


def test_papel_principal_derivado_por_precedencia(django_user_model):
    u = django_user_model.objects.create_user(
        email="dir@c.com", password=SENHA, nome="Dir", role=Papel.PROFISSIONAL
    )
    from apps.accounts.models import PapelUsuario

    u.papeis.add(PapelUsuario.objects.get(codigo=Papel.DIRECAO))
    u.refresh_from_db()
    # Precedência: DIREÇÃO > PROFISSIONAL → papel principal vira DIREÇÃO.
    assert u.role == Papel.DIRECAO
    assert u.tem_papel(Papel.PROFISSIONAL) and u.tem_papel(Papel.DIRECAO)
    assert u.eh_profissional is True
    assert u.eh_gestor is True
    # Tem outro papel além de PROFISSIONAL → não é "profissional puro".
    assert u.somente_profissional is False


def test_remover_papel_recalcula_principal(django_user_model):
    u = django_user_model.objects.create_user(
        email="x@c.com", password=SENHA, nome="X", role=Papel.PROFISSIONAL, papeis=[Papel.DIRECAO, Papel.PROFISSIONAL]
    )
    assert u.role == Papel.DIRECAO
    from apps.accounts.models import PapelUsuario

    u.papeis.remove(PapelUsuario.objects.get(codigo=Papel.DIRECAO))
    u.refresh_from_db()
    assert u.role == Papel.PROFISSIONAL
    assert u.somente_profissional is True


# --- API de gestão de usuários ----------------------------------------------
@pytest.fixture
def direcao(django_user_model):
    return django_user_model.objects.create_user(
        email="chefe@c.com", password=SENHA, nome="Chefe", role=Papel.DIRECAO
    )


def test_cria_usuario_multipapel_via_api(direcao):
    esp = Especialidade.objects.create(nome="Psicologia")
    resp = _cliente(direcao).post(
        "/api/usuarios/",
        {
            "nome": "Dra. Dupla",
            "email": "dupla@c.com",
            "papeis": [Papel.DIRECAO, Papel.PROFISSIONAL],
            "especialidades": [esp.id],
            "password": SENHA,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    assert sorted(resp.data["papeis"]) == sorted([Papel.DIRECAO, Papel.PROFISSIONAL])
    assert resp.data["role"] == Papel.DIRECAO  # principal derivado


def test_endpoint_filtra_por_papel_pega_multipapel(direcao, django_user_model):
    # Usuário DIREÇÃO que também atende deve aparecer em ?papel=PROFISSIONAL.
    dupla = django_user_model.objects.create_user(
        email="atende@c.com", password=SENHA, nome="Atende",
        role=Papel.DIRECAO, papeis=[Papel.DIRECAO, Papel.PROFISSIONAL],
    )
    resp = _cliente(direcao).get("/api/usuarios/", {"papel": Papel.PROFISSIONAL})
    ids = [u["id"] for u in resp.data]
    assert dupla.id in ids
    assert direcao.id not in ids  # DIREÇÃO pura não atende


# --- Agenda: multi-papel pode ser agendado ----------------------------------
def test_direcao_profissional_pode_ser_agendado(django_user_model):
    prof_dir = django_user_model.objects.create_user(
        email="pd@c.com", password=SENHA, nome="PD",
        role=Papel.DIRECAO, papeis=[Papel.DIRECAO, Papel.PROFISSIONAL],
    )
    sala = Sala.objects.create(nome="Sala 1")
    servico = Servico.objects.create(
        nome="Aval", duracao_minutos=50, valor_clinica="100.00", valor_repasse="0.00"
    )
    servico.profissionais.add(prof_dir)
    paciente = Paciente.objects.create(nome_completo="Pac", data_nascimento="2015-01-01")

    serializer = AgendamentoSerializer(
        data={
            "paciente": paciente.id,
            "profissional": prof_dir.id,
            "sala": sala.id,
            "servico": servico.id,
            "data": date(2026, 9, 1),
            "horario_inicio": time(9, 0),
        }
    )
    # Não deve acusar "não possui o papel de profissional".
    assert serializer.is_valid(), serializer.errors
