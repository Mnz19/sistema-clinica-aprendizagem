"""
Fixtures dos testes do módulo de clínica.

Diferente de outros módulos (que autenticam via ``force_authenticate``), aqui o
cliente é autenticado com um token JWT real (``RefreshToken.for_user``),
injetado no header ``Authorization`` — exercitando o mesmo caminho de
autenticação usado em produção (``JWTAuthentication``).

Serviços, disponibilidades e ausências são sempre vinculados a um profissional
(papel ``PROFISSIONAL``); as fábricas abaixo já cuidam desse vínculo por padrão,
mas permitem sobrescrever o ``profissional`` quando o teste precisar de mais de um.
"""
import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Papel
from apps.clinica.models import AusenciaProfissional, DisponibilidadeProfissional, Sala, Servico

SENHA_PADRAO = "SenhaForte123!"


@pytest.fixture
def api_client():
    """Cliente do DRF sem autenticação."""
    return APIClient()


@pytest.fixture
def cria_usuario(db, django_user_model):
    """Fábrica de usuários para os testes."""

    def _cria(email="direcao@clinica.com", senha=SENHA_PADRAO, **extra):
        extra.setdefault("nome", "Usuário de Teste")
        extra.setdefault("role", Papel.DIRECAO)
        return django_user_model.objects.create_user(email=email, password=senha, **extra)

    return _cria


@pytest.fixture
def usuario(cria_usuario):
    """Usuário padrão (papel DIREÇÃO) usado para autenticar as requisições."""
    return cria_usuario()


@pytest.fixture
def profissional(cria_usuario):
    """Usuário com papel PROFISSIONAL, dono dos serviços/disponibilidades/ausências de teste."""
    return cria_usuario(email="profissional@clinica.com", role=Papel.PROFISSIONAL)


@pytest.fixture
def cliente_autenticado(api_client, usuario):
    """
    Cliente autenticado via JWT: gera o par de tokens com ``RefreshToken.for_user``
    e injeta o ``access`` token no header ``Authorization`` de toda requisição
    subsequente feita por este cliente.
    """
    refresh = RefreshToken.for_user(usuario)
    access_token = str(refresh.access_token)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    return api_client


@pytest.fixture
def cria_sala(db):
    """Fábrica de salas."""

    def _cria(nome="Sala 1", **extra):
        return Sala.objects.create(nome=nome, **extra)

    return _cria


@pytest.fixture
def cria_servico(db, profissional):
    """Fábrica de serviços, sempre vinculados a um profissional (padrão: fixture ``profissional``)."""
    profissional_padrao = profissional

    def _cria(nome="Psicoterapia", duracao_minutos=50, valor_clinica="150.00", valor_repasse="0.00", profissional=None, profissionais=None, **extra):
        servico = Servico.objects.create(
            nome=nome,
            duracao_minutos=duracao_minutos,
            valor_clinica=valor_clinica,
            valor_repasse=valor_repasse,
            **extra,
        )
        if profissionais is not None:
            servico.profissionais.set(profissionais)
        else:
            servico.profissionais.add(profissional or profissional_padrao)
        return servico

    return _cria


@pytest.fixture
def cria_disponibilidade(db, profissional):
    """Fábrica de disponibilidades recorrentes do profissional."""
    profissional_padrao = profissional

    def _cria(
        dia_semana=0,
        horario_inicio="08:00",
        horario_fim="18:00",
        profissional=None,
        **extra,
    ):
        return DisponibilidadeProfissional.objects.create(
            dia_semana=dia_semana,
            horario_inicio=horario_inicio,
            horario_fim=horario_fim,
            profissional=profissional or profissional_padrao,
            **extra,
        )

    return _cria


@pytest.fixture
def cria_ausencia(db, profissional):
    """Fábrica de ausências do profissional."""
    profissional_padrao = profissional

    def _cria(
        data_inicio="2026-01-05",
        data_fim="2026-01-10",
        motivo="Férias",
        profissional=None,
        **extra,
    ):
        return AusenciaProfissional.objects.create(
            data_inicio=data_inicio,
            data_fim=data_fim,
            motivo=motivo,
            profissional=profissional or profissional_padrao,
            **extra,
        )

    return _cria
