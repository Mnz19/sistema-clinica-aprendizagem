"""
Testes da integração com o Google Agenda.

As chamadas de rede à Calendar API são substituídas por *mocks* nas funções
``_criar_remoto`` / ``_atualizar_ou_recriar_remoto`` / ``_apagar_remoto``, então
os testes exercitam a orquestração (criar/atualizar/mover/remover evento) sem
tocar o Google. O ``sincronizar_agendamento`` é chamado diretamente (os signals
usam ``transaction.on_commit``, que não dispara dentro do teste transacional).
"""
from datetime import date, time

import pytest

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, StatusAgendamento
from apps.google_agenda import crypto, services
from apps.google_agenda.models import ContaGoogle, EventoGoogle
from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db

SENHA = "SenhaForte123!"


# --- Fixtures ---------------------------------------------------------------
@pytest.fixture
def profissional(django_user_model):
    return django_user_model.objects.create_user(
        email="prof1@clinica.com", password=SENHA, nome="Dr. Um", role=Papel.PROFISSIONAL
    )


@pytest.fixture
def prof2(django_user_model):
    return django_user_model.objects.create_user(
        email="prof2@clinica.com", password=SENHA, nome="Dr. Dois", role=Papel.PROFISSIONAL
    )


@pytest.fixture
def paciente():
    return Paciente.objects.create(nome_completo="Paciente X", data_nascimento="2015-01-01")


@pytest.fixture
def sala():
    from apps.clinica.models import Sala

    return Sala.objects.create(nome="Sala 1")


@pytest.fixture
def servico(profissional, prof2):
    from apps.clinica.models import Servico

    s = Servico.objects.create(
        nome="Psicoterapia", duracao_minutos=50, valor_clinica="150.00", valor_repasse="0.00"
    )
    s.profissionais.set([profissional, prof2])
    return s


@pytest.fixture
def conta(profissional):
    c = ContaGoogle(usuario=profissional, ativa=True, email_google="prof1@gmail.com")
    c.definir_refresh_token("1//refresh-fake")
    c.save()
    return c


@pytest.fixture
def agendamento(paciente, profissional, sala, servico):
    return Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data=date(2026, 9, 1),
        horario_inicio=time(9, 0),
        horario_fim=time(9, 50),
        status=StatusAgendamento.AGENDADO,
    )


@pytest.fixture
def mock_google(monkeypatch):
    """Substitui as operações remotas e registra as chamadas feitas."""
    chamadas = {"criar": [], "atualizar": [], "apagar": []}
    contador = {"seq": 0}

    def _criar(conta, payload):
        contador["seq"] += 1
        event_id = f"evt-{contador['seq']}"
        chamadas["criar"].append((conta.id, event_id, payload))
        return event_id

    def _atualizar(conta, event_id, payload):
        chamadas["atualizar"].append((conta.id, event_id, payload))
        return event_id

    def _apagar(conta, event_id):
        chamadas["apagar"].append((conta.id, event_id))

    monkeypatch.setattr(services, "_criar_remoto", _criar)
    monkeypatch.setattr(services, "_atualizar_ou_recriar_remoto", _atualizar)
    monkeypatch.setattr(services, "_apagar_remoto", _apagar)
    return chamadas


# --- Criptografia -----------------------------------------------------------
def test_crypto_round_trip():
    cifrado = crypto.criptografar("segredo-123")
    assert cifrado != "segredo-123"
    assert crypto.descriptografar(cifrado) == "segredo-123"


def test_crypto_detecta_adulteracao():
    with pytest.raises(ValueError):
        crypto.descriptografar("valor-invalido-nao-fernet")


def test_conta_guarda_refresh_criptografado(conta):
    assert conta.refresh_token_cifrado != "1//refresh-fake"
    assert conta.refresh_token == "1//refresh-fake"


# --- Orquestração da sincronização -----------------------------------------
def test_cria_evento_quando_conta_ativa(agendamento, conta, mock_google):
    services.sincronizar_agendamento(agendamento)

    vinculo = EventoGoogle.objects.get(agendamento=agendamento)
    assert vinculo.conta_id == conta.id
    assert len(mock_google["criar"]) == 1
    # payload sempre privado (sigilo do paciente)
    _, _, payload = mock_google["criar"][0]
    assert payload["visibility"] == "private"


def test_sem_conta_nao_cria_evento(agendamento, mock_google):
    services.sincronizar_agendamento(agendamento)
    assert not EventoGoogle.objects.filter(agendamento=agendamento).exists()
    assert mock_google["criar"] == []


def test_conta_inativa_nao_cria_evento(agendamento, conta, mock_google):
    conta.ativa = False
    conta.save(update_fields=["ativa"])
    services.sincronizar_agendamento(agendamento)
    assert not EventoGoogle.objects.filter(agendamento=agendamento).exists()


def test_atualiza_evento_existente(agendamento, conta, mock_google):
    services.sincronizar_agendamento(agendamento)  # cria
    agendamento.observacoes = "Trazer relatório"
    agendamento.save()
    services.sincronizar_agendamento(agendamento)  # atualiza

    assert len(mock_google["criar"]) == 1
    assert len(mock_google["atualizar"]) == 1
    assert EventoGoogle.objects.filter(agendamento=agendamento).count() == 1


def test_desmarcado_remove_evento(agendamento, conta, mock_google):
    services.sincronizar_agendamento(agendamento)  # cria
    agendamento.status = StatusAgendamento.DESMARCADO
    agendamento.parecer_status = "Paciente cancelou"
    agendamento.save()
    services.sincronizar_agendamento(agendamento)  # deve remover

    assert len(mock_google["apagar"]) == 1
    assert not EventoGoogle.objects.filter(agendamento=agendamento).exists()


def test_transferencia_move_evento_para_nova_conta(
    agendamento, conta, prof2, mock_google
):
    services.sincronizar_agendamento(agendamento)  # cria na conta do prof1
    id_evento_antigo = EventoGoogle.objects.get(agendamento=agendamento).google_event_id

    conta2 = ContaGoogle(usuario=prof2, ativa=True)
    conta2.definir_refresh_token("1//refresh-prof2")
    conta2.save()

    agendamento.profissional = prof2
    agendamento.save()
    services.sincronizar_agendamento(agendamento)

    # Apagou na conta antiga e recriou na nova.
    assert mock_google["apagar"] == [(conta.id, id_evento_antigo)]
    vinculo = EventoGoogle.objects.get(agendamento=agendamento)
    assert vinculo.conta_id == conta2.id
    assert len(mock_google["criar"]) == 2


# --- Status e desconexão ----------------------------------------------------
def test_status_para(profissional, conta):
    status = services.status_para(profissional)
    assert status["conectado"] is True
    assert status["ativa"] is True
    assert status["email_google"] == "prof1@gmail.com"


def test_desconectar_remove_conta_e_vinculos(
    agendamento, conta, profissional, mock_google, monkeypatch
):
    services.sincronizar_agendamento(agendamento)
    assert EventoGoogle.objects.filter(agendamento=agendamento).exists()

    # Evita a chamada de revogação real (rede).
    monkeypatch.setattr(services.requests, "post", lambda *a, **k: None)
    assert services.desconectar(profissional) is True

    assert not ContaGoogle.objects.filter(usuario=profissional).exists()
    # EventoGoogle é removido em cascata junto da conta.
    assert not EventoGoogle.objects.filter(agendamento=agendamento).exists()
