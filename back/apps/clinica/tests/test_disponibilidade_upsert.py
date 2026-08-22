"""
POST idempotente de disponibilidade (upsert pela chave natural).

A grade semanal é salva reenviando as janelas do profissional; janelas que já
existem (mesma chave ``profissional + dia_semana + horario_inicio``) não podem
derrubar a requisição com 400 — devem ser atualizadas. Updates (PUT/PATCH)
continuam validando unicidade normalmente.
"""
import pytest

from apps.clinica.models import DisponibilidadeProfissional

pytestmark = pytest.mark.django_db

URL = "/api/disponibilidades/"


@pytest.fixture
def janela(profissional):
    def _f(**over):
        base = {
            "profissional": profissional.pk,
            "dia_semana": 1,
            "horario_inicio": "08:00",
            "horario_fim": "12:00",
        }
        base.update(over)
        return base
    return _f


def test_repost_mesma_janela_nao_da_400(cliente_autenticado, janela):
    """Reenviar a mesma janela retorna 2xx (idempotente), não 400."""
    r1 = cliente_autenticado.post(URL, janela(), format="json")
    assert r1.status_code == 201, r1.data

    r2 = cliente_autenticado.post(URL, janela(), format="json")
    assert r2.status_code in (200, 201), r2.data
    assert DisponibilidadeProfissional.objects.count() == 1
    assert r2.data["id"] == r1.data["id"]


def test_repost_atualiza_horario_fim(cliente_autenticado, janela):
    """Reenviar com horario_fim diferente atualiza a janela existente."""
    cliente_autenticado.post(URL, janela(), format="json")
    r = cliente_autenticado.post(URL, janela(horario_fim="18:00"), format="json")
    assert r.status_code in (200, 201), r.data
    assert DisponibilidadeProfissional.objects.count() == 1
    disp = DisponibilidadeProfissional.objects.get()
    assert str(disp.horario_fim) == "18:00:00"


def test_repost_reativa_janela_inativa(cliente_autenticado, janela, profissional):
    """Janela inativa é reativada ao ser reenviada com ativo=True."""
    DisponibilidadeProfissional.objects.create(
        profissional_id=profissional.pk, dia_semana=1,
        horario_inicio="08:00", horario_fim="12:00", ativo=False,
    )
    r = cliente_autenticado.post(URL, janela(ativo=True), format="json")
    assert r.status_code in (200, 201), r.data
    disp = DisponibilidadeProfissional.objects.get()
    assert disp.ativo is True


def test_recriar_apos_soft_delete_reativa(cliente_autenticado, janela):
    """
    Fluxo real da grade semanal: DELETE (soft delete → ativo=False) seguido de
    POST sem ``ativo`` deve reativar a janela, não deixá-la inativa.
    """
    r1 = cliente_autenticado.post(URL, janela(), format="json")
    disp_id = r1.data["id"]

    r_del = cliente_autenticado.delete(f"{URL}{disp_id}/")
    assert r_del.status_code == 204
    assert DisponibilidadeProfissional.objects.get(pk=disp_id).ativo is False

    # POST sem ``ativo`` (exatamente o que o frontend envia ao recriar a grade).
    r2 = cliente_autenticado.post(URL, janela(), format="json")
    assert r2.status_code in (200, 201), r2.data
    assert DisponibilidadeProfissional.objects.count() == 1
    assert DisponibilidadeProfissional.objects.get(pk=disp_id).ativo is True


def test_horario_invalido_continua_400(cliente_autenticado, janela):
    """A validação de horário (início < fim) continua ativa."""
    r = cliente_autenticado.post(URL, janela(horario_fim="07:00"), format="json")
    assert r.status_code == 400


def test_dia_diferente_cria_nova(cliente_autenticado, janela):
    """Chave natural diferente (outro dia) cria registro novo, não faz upsert."""
    cliente_autenticado.post(URL, janela(dia_semana=1), format="json")
    cliente_autenticado.post(URL, janela(dia_semana=2), format="json")
    assert DisponibilidadeProfissional.objects.count() == 2
