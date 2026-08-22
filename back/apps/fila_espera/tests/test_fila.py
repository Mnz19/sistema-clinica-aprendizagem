"""Testes de T14 — FilaEsperaViewSet + action converter/."""
from datetime import date, time

import pytest
from django.urls import reverse

from apps.accounts.models import Especialidade, Papel
from apps.clinica.models import Agendamento, Sala, Servico, StatusAgendamento
from apps.fila_espera.models import FilaEspera, StatusFila
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db
SENHA = "SenhaForte123!"


@pytest.fixture
def cria_u(db, django_user_model):
    def _f(email, role, nome="U"):
        return django_user_model.objects.create_user(email=email, password=SENHA, role=role, nome=nome)
    return _f


@pytest.fixture
def recepcao(cria_u): return cria_u("rec@c.com", Papel.RECEPCAO)
@pytest.fixture
def prof(cria_u): return cria_u("prof@c.com", Papel.PROFISSIONAL)
@pytest.fixture
def paciente(db): return Paciente.objects.create(nome_completo="P", data_nascimento="2015-01-01")
@pytest.fixture
def sala(db): return Sala.objects.create(nome="S")
@pytest.fixture
def servico(db, prof):
    s = Servico.objects.create(nome="T", duracao_minutos=50, valor_clinica="150.00", valor_repasse="0.00")
    s.profissionais.add(prof)
    return s


@pytest.fixture
def api(db):
    from rest_framework.test import APIClient
    def _f(u):
        c = APIClient(); c.force_authenticate(user=u); return c
    return _f


def test_cria_entrada_na_fila(api, recepcao, paciente, prof):
    """QUEUE-01/AC1: POST cria entrada com status AGUARDANDO."""
    resp = api(recepcao).post(reverse("fila-espera-list"), {
        "paciente": paciente.id, "profissional": prof.id, "preferencia_horario": "Manhã",
    }, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["status"] == StatusFila.AGUARDANDO


def test_listagem_fifo(api, recepcao, paciente):
    """QUEUE-01/AC2: GET lista em ordem FIFO (criado_em)."""
    e1 = FilaEspera.objects.create(paciente=paciente)
    e2 = FilaEspera.objects.create(paciente=paciente)
    resp = api(recepcao).get(reverse("fila-espera-list"))
    assert resp.status_code == 200
    ids = [e["id"] for e in resp.data]
    assert ids.index(e1.id) < ids.index(e2.id)


def test_converter_em_agendamento(api, recepcao, paciente, prof, sala, servico):
    """QUEUE-02/AC3: converter/ cria agendamento e marca CONVERTIDO."""
    entrada = FilaEspera.objects.create(paciente=paciente, profissional=prof)
    resp = api(recepcao).post(
        reverse("fila-espera-converter", args=[entrada.id]),
        {
            "paciente": paciente.id, "profissional": prof.id,
            "sala": sala.id, "servico": servico.id,
            "data": "2026-11-01", "horario_inicio": "10:00:00",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    entrada.refresh_from_db()
    assert entrada.status == StatusFila.CONVERTIDO
    assert entrada.agendamento_resultado is not None


def test_converter_ja_convertida_retorna_400(api, recepcao, paciente):
    """QUEUE-02: converter entrada já CONVERTIDA → 400."""
    entrada = FilaEspera.objects.create(paciente=paciente, status=StatusFila.CONVERTIDO)
    resp = api(recepcao).post(reverse("fila-espera-converter", args=[entrada.id]), {}, format="json")
    assert resp.status_code == 400


def test_patch_recusa_entrada(api, recepcao, paciente):
    """QUEUE-01/AC4: PATCH para RECUSADO funciona."""
    entrada = FilaEspera.objects.create(paciente=paciente)
    resp = api(recepcao).patch(
        reverse("fila-espera-detail", args=[entrada.id]),
        {"status": StatusFila.RECUSADO}, format="json",
    )
    assert resp.status_code == 200
    entrada.refresh_from_db()
    assert entrada.status == StatusFila.RECUSADO


def test_cria_entrada_com_especialidade_e_observacoes(api, recepcao, paciente, prof):
    """Enriquecimento: entrada aceita especialidade preferida + observações."""
    esp = Especialidade.objects.create(nome="Aux. Desenvolvimento Infantil (teste)")
    resp = api(recepcao).post(reverse("fila-espera-list"), {
        "paciente": paciente.id, "profissional": prof.id,
        "especialidade": esp.id, "observacoes": "Grupo de habilidades sociais",
    }, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["especialidade"] == esp.id
    assert resp.data["especialidade_nome"] == esp.nome
    assert resp.data["observacoes"] == "Grupo de habilidades sociais"
    assert "paciente_telefone" in resp.data


def test_recusar_marca_status_recusado(api, recepcao, paciente):
    """AC4: action recusar/ marca a entrada como RECUSADO."""
    entrada = FilaEspera.objects.create(paciente=paciente)
    resp = api(recepcao).post(reverse("fila-espera-recusar", args=[entrada.id]))
    assert resp.status_code == 200, resp.data
    entrada.refresh_from_db()
    assert entrada.status == StatusFila.RECUSADO


def test_recusar_entrada_convertida_retorna_400(api, recepcao, paciente):
    entrada = FilaEspera.objects.create(paciente=paciente, status=StatusFila.CONVERTIDO)
    resp = api(recepcao).post(reverse("fila-espera-recusar", args=[entrada.id]))
    assert resp.status_code == 400


def test_candidatos_casa_profissional_ou_sem_preferencia(api, recepcao, paciente, prof, cria_u):
    """P2-QUEUE-02/AC2: candidatos/ retorna FIFO quem casa o profissional ou não tem preferência."""
    outro = cria_u("outro@c.com", Papel.PROFISSIONAL, nome="Outro")
    casa = FilaEspera.objects.create(paciente=paciente, profissional=prof)
    qualquer = FilaEspera.objects.create(paciente=paciente, profissional=None)
    nao_casa = FilaEspera.objects.create(paciente=paciente, profissional=outro)

    resp = api(recepcao).get(reverse("fila-espera-candidatos"), {"profissional": prof.id})
    assert resp.status_code == 200, resp.data
    ids = [e["id"] for e in resp.data]
    assert casa.id in ids and qualquer.id in ids
    assert nao_casa.id not in ids
    assert ids.index(casa.id) < ids.index(qualquer.id)  # FIFO


def test_candidatos_ignora_nao_aguardando(api, recepcao, paciente, prof):
    FilaEspera.objects.create(paciente=paciente, profissional=prof, status=StatusFila.CONVERTIDO)
    resp = api(recepcao).get(reverse("fila-espera-candidatos"), {"profissional": prof.id})
    assert resp.status_code == 200
    assert resp.data == []


def test_sem_autenticacao_retorna_401(api, db):
    from rest_framework.test import APIClient
    resp = APIClient().get(reverse("fila-espera-list"))
    assert resp.status_code == 401
