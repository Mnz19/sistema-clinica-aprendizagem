"""
Testes do cronômetro de atendimento (iniciar/finalizar) e da ocupação por sala.

- ``iniciar-atendimento`` marca ``atendimento_iniciado_em`` e move para EM_ATENDIMENTO.
- ``finalizar-atendimento`` marca ``atendimento_finalizado_em``, move para ATENDIDO
  e gera Produção (via signal).
- ``/api/salas/ocupacao/`` reflete as salas em uso.
"""
from datetime import date, time

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, Producao, Sala, Servico, StatusAgendamento
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

SENHA = "SenhaForte123!"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def cria_usuario(db, django_user_model):
    def _f(email, role=Papel.DIRECAO, nome="Usuário"):
        return django_user_model.objects.create_user(email=email, password=SENHA, role=role, nome=nome)
    return _f


@pytest.fixture
def direcao(cria_usuario):
    return cria_usuario("dir@c.com", Papel.DIRECAO, "Dir")


@pytest.fixture
def recepcao(cria_usuario):
    return cria_usuario("rec@c.com", Papel.RECEPCAO, "Rec")


@pytest.fixture
def prof_a(cria_usuario):
    return cria_usuario("prof_a@c.com", Papel.PROFISSIONAL, "ProfA")


@pytest.fixture
def prof_b(cria_usuario):
    return cria_usuario("prof_b@c.com", Papel.PROFISSIONAL, "ProfB")


@pytest.fixture
def paciente(db):
    return Paciente.objects.create(nome_completo="Pac", data_nascimento="2015-01-01")


@pytest.fixture
def sala(db):
    return Sala.objects.create(nome="S1")


@pytest.fixture
def servico_a(db, prof_a):
    servico = Servico.objects.create(
        nome="Terapia A", duracao_minutos=50, valor_clinica="150.00", valor_repasse="0.00"
    )
    servico.profissionais.add(prof_a)
    return servico


@pytest.fixture
def api(db):
    def _login(user):
        c = APIClient()
        c.force_authenticate(user=user)
        return c
    return _login


@pytest.fixture
def ag_confirmado(db, paciente, prof_a, sala, servico_a):
    return Agendamento.objects.create(
        paciente=paciente, profissional=prof_a, sala=sala, servico=servico_a,
        data=date(2026, 10, 1), horario_inicio=time(10, 0), horario_fim=time(10, 50),
        status=StatusAgendamento.CONFIRMADO,
    )


def _url(agendamento, sufixo):
    return reverse(f"agendamento-{sufixo}", args=[agendamento.id])


# ---------------------------------------------------------------------------
# Iniciar atendimento
# ---------------------------------------------------------------------------

def test_profissional_inicia_atendimento(api, prof_a, ag_confirmado):
    """Iniciar marca o timestamp, muda status e deixa a sala em uso."""
    resp = api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == StatusAgendamento.EM_ATENDIMENTO
    assert resp.data["atendimento_iniciado_em"] is not None
    assert resp.data["atendimento_finalizado_em"] is None
    assert resp.data["duracao_atendimento_segundos"] is not None

    ag_confirmado.refresh_from_db()
    assert ag_confirmado.status == StatusAgendamento.EM_ATENDIMENTO
    assert ag_confirmado.atendimento_iniciado_em is not None
    assert ag_confirmado.atendimento_em_andamento is True


def test_iniciar_a_partir_de_agendado(api, prof_a, ag_confirmado):
    """Pode iniciar mesmo sem confirmação prévia (a partir de AGENDADO)."""
    ag_confirmado.status = StatusAgendamento.AGENDADO
    ag_confirmado.save(update_fields=["status"])
    resp = api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == StatusAgendamento.EM_ATENDIMENTO


def test_iniciar_duas_vezes_retorna_400(api, prof_a, ag_confirmado):
    """Não é possível iniciar um atendimento já em andamento."""
    api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    resp = api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    assert resp.status_code == 400
    assert "já foi iniciado" in resp.data["detail"]


def test_recepcao_nao_pode_iniciar(api, recepcao, ag_confirmado):
    """RECEPCAO não tem papel para iniciar atendimento (PermissionDenied → 403)."""
    resp = api(recepcao).post(_url(ag_confirmado, "iniciar-atendimento"))
    assert resp.status_code == 403


def test_profissional_nao_inicia_de_outro(api, prof_b, ag_confirmado):
    """PROFISSIONAL não pode iniciar atendimento de agendamento alheio."""
    resp = api(prof_b).post(_url(ag_confirmado, "iniciar-atendimento"))
    assert resp.status_code == 403


def test_iniciar_com_sala_ocupada_retorna_409(
    api, prof_a, prof_b, paciente, sala, servico_a, ag_confirmado
):
    """Sala já ocupada por outro atendimento em andamento → 409."""
    # prof_a inicia o atendimento na sala.
    api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))

    # Outro agendamento (prof_b), mesma sala, tenta iniciar.
    servico_b = Servico.objects.create(
        nome="Terapia B", duracao_minutos=50, valor_clinica="150.00", valor_repasse="0.00"
    )
    servico_b.profissionais.add(prof_b)
    outro = Agendamento.objects.create(
        paciente=paciente, profissional=prof_b, sala=sala, servico=servico_b,
        data=date(2026, 10, 1), horario_inicio=time(11, 0), horario_fim=time(11, 50),
        status=StatusAgendamento.CONFIRMADO,
    )
    resp = api(prof_b).post(_url(outro, "iniciar-atendimento"))
    assert resp.status_code == 409
    assert "em uso" in resp.data["detail"]


def test_iniciar_estado_terminal_retorna_400(api, prof_a, ag_confirmado):
    """Não dá para iniciar um agendamento já ATENDIDO (estado terminal)."""
    ag_confirmado.status = StatusAgendamento.ATENDIDO
    ag_confirmado.save(update_fields=["status"])
    resp = api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Finalizar atendimento
# ---------------------------------------------------------------------------

def test_finalizar_atendimento_gera_producao(api, prof_a, ag_confirmado):
    """Finalizar marca o fim, vira ATENDIDO e gera Produção via signal."""
    api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    resp = api(prof_a).post(_url(ag_confirmado, "finalizar-atendimento"))
    assert resp.status_code == 200, resp.data
    assert resp.data["status"] == StatusAgendamento.ATENDIDO
    assert resp.data["atendimento_finalizado_em"] is not None

    ag_confirmado.refresh_from_db()
    assert ag_confirmado.status == StatusAgendamento.ATENDIDO
    assert ag_confirmado.atendimento_em_andamento is False
    assert Producao.objects.filter(agendamento=ag_confirmado).exists()


def test_finalizar_sem_iniciar_retorna_400(api, prof_a, ag_confirmado):
    """Finalizar sem ter iniciado é inválido."""
    resp = api(prof_a).post(_url(ag_confirmado, "finalizar-atendimento"))
    assert resp.status_code == 400
    assert "não foi iniciado" in resp.data["detail"]


def test_finalizar_duas_vezes_retorna_400(api, prof_a, ag_confirmado):
    """Finalizar duas vezes é inválido (já finalizado)."""
    api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    api(prof_a).post(_url(ag_confirmado, "finalizar-atendimento"))
    resp = api(prof_a).post(_url(ag_confirmado, "finalizar-atendimento"))
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Ocupação por sala
# ---------------------------------------------------------------------------

def test_ocupacao_lista_salas_e_uso(api, direcao, prof_a, ag_confirmado, sala):
    """Ocupação reflete a sala livre antes e em uso após iniciar o atendimento."""
    # Outra sala ativa, para garantir que salas livres também aparecem.
    Sala.objects.create(nome="S2")

    url = reverse("sala-ocupacao")

    resp = api(direcao).get(url)
    assert resp.status_code == 200
    por_nome = {s["sala_nome"]: s for s in resp.data}
    assert por_nome["S1"]["em_uso"] is False
    assert por_nome["S1"]["atendimento"] is None
    assert por_nome["S2"]["em_uso"] is False

    api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))

    resp = api(direcao).get(url)
    por_nome = {s["sala_nome"]: s for s in resp.data}
    assert por_nome["S1"]["em_uso"] is True
    atendimento = por_nome["S1"]["atendimento"]
    assert atendimento is not None
    assert atendimento["agendamento_id"] == ag_confirmado.id
    assert atendimento["paciente_nome"] == "Pac"
    assert atendimento["profissional_nome"] == "ProfA"


def test_ocupacao_libera_sala_apos_finalizar(api, direcao, prof_a, ag_confirmado):
    """Após finalizar, a sala volta a ficar livre na ocupação."""
    api(prof_a).post(_url(ag_confirmado, "iniciar-atendimento"))
    api(prof_a).post(_url(ag_confirmado, "finalizar-atendimento"))

    resp = api(direcao).get(reverse("sala-ocupacao"))
    por_nome = {s["sala_nome"]: s for s in resp.data}
    assert por_nome["S1"]["em_uso"] is False
