"""Testes das confirmações por WhatsApp: envio, resposta, webhook, config e comando."""
import pytest
from django.core import management
from django.urls import reverse

from apps.clinica.models import StatusAgendamento
from apps.whatsapp.models import (
    ConfiguracaoConfirmacao,
    MensagemConfirmacao,
    StatusMensagem,
)
from apps.whatsapp.services import enviar_confirmacao, processar_resposta

pytestmark = pytest.mark.django_db


# --- Configuração ------------------------------------------------------------

def test_config_singleton_get_or_create():
    c1 = ConfiguracaoConfirmacao.carregar()
    c2 = ConfiguracaoConfirmacao.carregar()
    assert c1.pk == c2.pk == 1
    assert ConfiguracaoConfirmacao.objects.count() == 1


def test_direcao_edita_config(cliente, direcao):
    api = cliente(direcao)
    resp = api.put(
        reverse("whatsapp-config"),
        {"ativo": True, "antecedencia_dias": 2, "horario_disparo": "08:30",
         "mensagem": "Olá {paciente}", "template_meta_nome": "confirmacao",
         "template_meta_idioma": "pt_BR"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["antecedencia_dias"] == 2
    assert resp.data["simulado"] is True  # sem credenciais


def test_profissional_nao_edita_config(cliente, profissional):
    api = cliente(profissional)
    resp = api.put(reverse("whatsapp-config"), {"antecedencia_dias": 5}, format="json")
    assert resp.status_code == 403


# --- Envio (modo simulado) ---------------------------------------------------

def test_envio_cria_registro_enviado(cria_agendamento):
    ag = cria_agendamento()
    registro = enviar_confirmacao(ag)
    assert registro.status == StatusMensagem.ENVIADO
    assert registro.telefone == "5591999990000"  # responsável principal, E.164
    assert registro.wa_message_id.startswith("SIMULADO-")


def test_envio_idempotente(cria_agendamento):
    ag = cria_agendamento()
    r1 = enviar_confirmacao(ag)
    r2 = enviar_confirmacao(ag)  # não reenvia
    assert r1.id == r2.id
    assert MensagemConfirmacao.objects.filter(agendamento=ag).count() == 1


def test_envio_sem_telefone_gera_erro(cria_agendamento, paciente_com_responsavel):
    paciente_com_responsavel.responsaveis.all().delete()
    paciente_com_responsavel.telefone = ""
    paciente_com_responsavel.save()
    ag = cria_agendamento()
    registro = enviar_confirmacao(ag)
    assert registro.status == StatusMensagem.ERRO
    assert "telefone" in registro.erro.lower()


# --- Resposta do paciente ----------------------------------------------------

def test_resposta_sim_confirma(cria_agendamento):
    ag = cria_agendamento()
    enviar_confirmacao(ag)
    registro = processar_resposta("5591999990000", "SIM")
    assert registro.status == StatusMensagem.RESPONDIDO_SIM
    ag.refresh_from_db()
    assert ag.status == StatusAgendamento.CONFIRMADO


def test_resposta_nao_cancela(cria_agendamento):
    ag = cria_agendamento()
    enviar_confirmacao(ag)
    registro = processar_resposta("91999990000", "não")  # sem 55 e com acento
    assert registro.status == StatusMensagem.RESPONDIDO_NAO
    ag.refresh_from_db()
    assert ag.status == StatusAgendamento.DESMARCADO
    assert "WhatsApp" in ag.parecer_status


def test_resposta_nao_reconhecida_mantem(cria_agendamento):
    ag = cria_agendamento()
    enviar_confirmacao(ag)
    registro = processar_resposta("5591999990000", "talvez")
    assert registro.status == StatusMensagem.ENVIADO  # segue aguardando
    ag.refresh_from_db()
    assert ag.status == StatusAgendamento.AGENDADO


# --- Webhook -----------------------------------------------------------------

def test_webhook_verificacao(api_client, settings):
    settings.WHATSAPP_VERIFY_TOKEN = "meu-token"
    resp = api_client.get(
        reverse("whatsapp-webhook"),
        {"hub.mode": "subscribe", "hub.verify_token": "meu-token", "hub.challenge": "123"},
    )
    assert resp.status_code == 200
    assert resp.content.decode() == "123"


def test_webhook_verificacao_token_errado(api_client, settings):
    settings.WHATSAPP_VERIFY_TOKEN = "meu-token"
    resp = api_client.get(
        reverse("whatsapp-webhook"),
        {"hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "x"},
    )
    assert resp.status_code == 403


def test_webhook_inbound_confirma(api_client, cria_agendamento):
    ag = cria_agendamento()
    enviar_confirmacao(ag)
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": "5591999990000",
                                    "type": "text",
                                    "text": {"body": "Sim"},
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }
    resp = api_client.post(reverse("whatsapp-webhook"), payload, format="json")
    assert resp.status_code == 200
    ag.refresh_from_db()
    assert ag.status == StatusAgendamento.CONFIRMADO


# --- Envio manual e comando --------------------------------------------------

def test_envio_manual_por_recepcao(cliente, recepcao, cria_agendamento):
    ag = cria_agendamento()
    api = cliente(recepcao)
    resp = api.post(reverse("whatsapp-enviar", args=[ag.id]))
    assert resp.status_code == 201, resp.data
    assert resp.data["status"] == StatusMensagem.ENVIADO


def test_comando_envia_para_data_alvo(cria_agendamento):
    ag = cria_agendamento(data="2026-07-20")
    management.call_command("enviar_confirmacoes", "--forcar", "--data", "2026-07-20")
    assert MensagemConfirmacao.objects.filter(
        agendamento=ag, status=StatusMensagem.ENVIADO
    ).exists()
