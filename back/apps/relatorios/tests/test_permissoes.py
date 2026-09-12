"""
Testes de acesso por papel na aba de Relatórios.

Esta é a regra central do módulo: a recepção enxerga o operacional (pacientes e
agendamentos) e **nunca** o financeiro (produção e repasse). Qualquer mudança
que afrouxe isso deve quebrar aqui.
"""
import pytest

pytestmark = pytest.mark.django_db

URL_PACIENTES = "/api/relatorios/pacientes/"
URL_AGENDAMENTOS = "/api/relatorios/agendamentos/"
URL_PRODUCAO = "/api/relatorios/producao/"
URL_REPASSE = "/api/relatorios/repasse/"

OPERACIONAIS = (URL_PACIENTES, URL_AGENDAMENTOS)
FINANCEIROS = (URL_PRODUCAO, URL_REPASSE)


@pytest.mark.parametrize("url", OPERACIONAIS + FINANCEIROS)
def test_direcao_acessa_todos_os_relatorios(api, direcao, url):
    """DIREÇÃO tem acesso aos quatro relatórios."""
    assert api(direcao).get(url).status_code == 200


@pytest.mark.parametrize("papel_fixture", ["recepcao", "supervisao"])
@pytest.mark.parametrize("url", OPERACIONAIS)
def test_recepcao_e_supervisao_acessam_o_operacional(api, request, papel_fixture, url):
    """RECEPÇÃO e SUPERVISÃO veem pacientes e agendamentos."""
    usuario = request.getfixturevalue(papel_fixture)
    assert api(usuario).get(url).status_code == 200


@pytest.mark.parametrize("papel_fixture", ["recepcao", "supervisao", "profissional"])
@pytest.mark.parametrize("url", FINANCEIROS)
def test_relatorios_financeiros_bloqueados_fora_do_financeiro(
    api, request, papel_fixture, url
):
    """
    Produção e repasse expõem valores da clínica inteira.

    RECEPÇÃO, SUPERVISÃO e PROFISSIONAL recebem 403 — inclusive o profissional,
    que não tem acesso nem ao próprio repasse por esta aba (ele o consulta no
    dashboard do terapeuta).
    """
    usuario = request.getfixturevalue(papel_fixture)
    assert api(usuario).get(url).status_code == 403


@pytest.mark.parametrize("url", FINANCEIROS)
def test_financeiro_acessa_producao_e_repasse(api, financeiro, url):
    """FINANCEIRO vê os dois relatórios financeiros."""
    assert api(financeiro).get(url).status_code == 200


@pytest.mark.parametrize("url", OPERACIONAIS)
def test_financeiro_nao_acessa_o_operacional(api, financeiro, url):
    """FINANCEIRO não foi liberado para dados cadastrais nem agenda."""
    assert api(financeiro).get(url).status_code == 403


@pytest.mark.parametrize("url", OPERACIONAIS + FINANCEIROS)
def test_profissional_nao_acessa_a_aba(api, profissional, url):
    """O papel PROFISSIONAL não participa desta aba."""
    assert api(profissional).get(url).status_code == 403


@pytest.mark.parametrize("url", OPERACIONAIS + FINANCEIROS)
def test_anonimo_bloqueado(client, url):
    """Sem autenticação, nenhum relatório responde."""
    assert client.get(url).status_code == 401
