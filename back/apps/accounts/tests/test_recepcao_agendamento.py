"""
Teste para verificar se RECEPCAO consegue listar profissionais e serviços para agendamento.
Este teste reproduz o cenário do bug relatado.
"""
import pytest
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Papel, Usuario
from apps.clinica.models import Servico


pytestmark = pytest.mark.django_db


@pytest.fixture
def recepcao(django_user_model):
    """Usuário com papel RECEPCAO."""
    return django_user_model.objects.create_user(
        email="recepcao@clinica.com",
        password="SenhaForte123!",
        nome="Recepcão",
        role=Papel.RECEPCAO,
    )


@pytest.fixture
def profissional(django_user_model):
    """Usuário com papel PROFISSIONAL."""
    user = django_user_model.objects.create_user(
        email="prof@clinica.com",
        password="SenhaForte123!",
        nome="Profissional",
        role=Papel.PROFISSIONAL,
    )
    user.papeis.add(*user.papeis.filter(codigo=Papel.PROFISSIONAL))
    return user


@pytest.fixture
def api_client_recepcao(recepcao):
    """Cliente autenticado como RECEPCAO."""
    from rest_framework.test import APIClient
    
    client = APIClient()
    refresh = RefreshToken.for_user(recepcao)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


@pytest.fixture
def servico_com_profissional(profissional):
    """Serviço vinculado ao profissional."""
    servico = Servico.objects.create(
        nome="Psicoterapia Individual",
        duracao_minutos=50,
        valor_clinica="150.00",
        valor_repasse="100.00",
        ativo=True,
    )
    servico.profissionais.add(profissional)
    return servico


def test_recepcao_pode_listar_profissionais(api_client_recepcao, profissional):
    """
    RECEPCAO deve conseguir listar profissionais (necessário para dropdown de agendamento).
    Antes do fix: 403 Forbidden
    Depois do fix: 200 OK com a lista de profissionais
    """
    # Listar profissionais com filtro papel=PROFISSIONAL
    response = api_client_recepcao.get(
        reverse("usuario-list"),
        {"papel": Papel.PROFISSIONAL, "is_active": True}
    )
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.data}"
    assert len(response.data) >= 1, "Should have at least 1 professional"
    
    # Verificar que o profissional está na lista
    profissional_ids = [u["id"] for u in response.data]
    assert profissional.id in profissional_ids


def test_recepcao_pode_listar_servicos(api_client_recepcao, servico_com_profissional):
    """
    RECEPCAO deve conseguir listar serviços (necessário para o formulário de agendamento).
    """
    response = api_client_recepcao.get(reverse("servico-list"))
    
    assert response.status_code == 200
    assert len(response.data) >= 1
    
    # Verificar que o serviço está na lista
    servico_ids = [s["id"] for s in response.data]
    assert servico_com_profissional.id in servico_ids
    
    # Verificar que o serviço contém o profissional
    servico = next(s for s in response.data if s["id"] == servico_com_profissional.id)
    assert servico_com_profissional.profissionais.first().id in servico["profissionais"]


def test_recepcao_nao_pode_criar_usuario(api_client_recepcao):
    """RECEPCAO não deve conseguir criar usuários."""
    payload = {
        "nome": "Novo Profissional",
        "email": "novo@clinica.com",
        "role": Papel.PROFISSIONAL,
        "papeis": [Papel.PROFISSIONAL],
    }
    
    response = api_client_recepcao.post(
        reverse("usuario-list"),
        payload,
        format="json"
    )
    
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"


def test_recepcao_nao_pode_atualizar_usuario(api_client_recepcao, profissional):
    """RECEPCAO não deve conseguir atualizar usuários."""
    payload = {"nome": "Nome Modificado"}
    
    response = api_client_recepcao.patch(
        reverse("usuario-detail", args=[profissional.id]),
        payload,
        format="json"
    )
    
    assert response.status_code == 403


def test_recepcao_nao_pode_deletar_usuario(api_client_recepcao, profissional):
    """RECEPCAO não deve conseguir deletar usuários."""
    response = api_client_recepcao.delete(
        reverse("usuario-detail", args=[profissional.id])
    )
    
    assert response.status_code == 403


if __name__ == "__main__":
    import subprocess
    subprocess.run([
        "python", "-m", "pytest",
        __file__,
        "-v", "-s",
        "--tb=short"
    ])
