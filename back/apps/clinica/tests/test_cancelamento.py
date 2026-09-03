"""
Testes para validar o comportamento de cancelamento (soft-delete) de agendamentos.

Quando um agendamento é desmarcado (status DESMARCADO), deve:
1. Continuar no banco de dados (não é deletado)
2. Desaparecer da visualização padrão (soft-delete visual)
3. Poder ser recuperado filtrando por status DESMARCADO
4. Exigir um parecer/justificativa para o cancelamento
"""
import pytest
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Papel
from apps.clinica.models import Agendamento, StatusAgendamento as SA


pytestmark = pytest.mark.django_db


def test_desmarcar_agendamento_requer_parecer(api_client, profissional, paciente, sala, cria_servico):
    """SCHED-CANCEL-01: Desmarcar requer parecer/justificativa."""
    from apps.clinica.tests.conftest import SENHA_PADRAO
    
    # Criar agendamento
    servico = cria_servico()
    agendamento = Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data="2026-12-15",
        horario_inicio="14:00:00",
        horario_fim="14:50:00",
        status=SA.AGENDADO,
    )
    
    # Autenticar como profissional
    refresh = RefreshToken.for_user(profissional)
    client = api_client
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    
    # Tentar desmarcar sem parecer → 400
    resp = client.patch(
        reverse("agendamento-detail", args=[agendamento.id]),
        {"status": SA.DESMARCADO},
        format="json"
    )
    assert resp.status_code == 400
    assert "parecer_status" in resp.data


def test_desmarcar_agendamento_com_parecer(api_client, profissional, paciente, sala, cria_servico):
    """SCHED-CANCEL-02: Desmarcar com parecer sucede."""
    from apps.clinica.tests.conftest import SENHA_PADRAO
    
    servico = cria_servico()
    agendamento = Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data="2026-12-15",
        horario_inicio="14:00:00",
        horario_fim="14:50:00",
        status=SA.AGENDADO,
    )
    
    refresh = RefreshToken.for_user(profissional)
    client = api_client
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    
    # Desmarcar com parecer → 200
    resp = client.patch(
        reverse("agendamento-detail", args=[agendamento.id]),
        {
            "status": SA.DESMARCADO,
            "parecer_status": "Paciente solicitou cancelamento da sessão."
        },
        format="json"
    )
    assert resp.status_code == 200
    
    # Verificar que o banco foi atualizado
    agendamento.refresh_from_db()
    assert agendamento.status == SA.DESMARCADO
    assert agendamento.parecer_status == "Paciente solicitou cancelamento da sessão."


def test_agendamento_desmarcado_permanece_no_banco(api_client, profissional, paciente, sala, cria_servico):
    """SCHED-CANCEL-03: Agendamento desmarcado não é deletado (soft-delete)."""
    servico = cria_servico()
    agendamento = Agendamento.objects.create(
        paciente=paciente,
        profissional=profissional,
        sala=sala,
        servico=servico,
        data="2026-12-15",
        horario_inicio="14:00:00",
        horario_fim="14:50:00",
        status=SA.AGENDADO,
    )
    
    refresh = RefreshToken.for_user(profissional)
    client = api_client
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    
    # Desmarcar
    client.patch(
        reverse("agendamento-detail", args=[agendamento.id]),
        {
            "status": SA.DESMARCADO,
            "parecer_status": "Cancelamento solicitado."
        },
        format="json"
    )
    
    # Verificar que o registro ainda existe no banco
    assert Agendamento.objects.filter(id=agendamento.id).exists()


def test_desmarcar_qualquer_status(api_client, profissional, paciente, sala, cria_servico):
    """SCHED-CANCEL-04: Pode desmarcar de qualquer status (AGENDADO, CONFIRMADO, etc)."""
    servico = cria_servico()
    
    for status_inicial in [SA.AGENDADO, SA.PRE_CONFIRMADO, SA.CONFIRMADO]:
        agendamento = Agendamento.objects.create(
            paciente=paciente,
            profissional=profissional,
            sala=sala,
            servico=servico,
            data="2026-12-15",
            horario_inicio="14:00:00",
            horario_fim="14:50:00",
            status=status_inicial,
        )
        
        refresh = RefreshToken.for_user(profissional)
        client = api_client
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
        
        resp = client.patch(
            reverse("agendamento-detail", args=[agendamento.id]),
            {
                "status": SA.DESMARCADO,
                "parecer_status": f"Cancelado de {status_inicial}."
            },
            format="json"
        )
        assert resp.status_code == 200, f"Falha ao desmarcar de {status_inicial}"


if __name__ == "__main__":
    import subprocess
    subprocess.run([
        "python", "-m", "pytest",
        __file__,
        "-v", "-s",
        "--tb=short"
    ])
