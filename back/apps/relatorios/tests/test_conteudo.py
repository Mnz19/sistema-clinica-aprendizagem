"""
Testes do conteúdo e dos filtros dos quatro relatórios (resposta JSON).

Valida o que cada relatório inclui/exclui, os filtros de período e enum, os
totais agregados e as duas visões do repasse.
"""
from decimal import Decimal

import pytest

pytestmark = pytest.mark.django_db

URL_PACIENTES = "/api/relatorios/pacientes/"
URL_AGENDAMENTOS = "/api/relatorios/agendamentos/"
URL_PRODUCAO = "/api/relatorios/producao/"
URL_REPASSE = "/api/relatorios/repasse/"


def linhas(resposta):
    return resposta.data["linhas"]


# --- Pacientes ---------------------------------------------------------------

def test_pacientes_traz_responsavel_e_profissional_vinculado(api, direcao, paciente):
    """O cadastro consolidado inclui o responsável principal e os vínculos."""
    resposta = api(direcao).get(URL_PACIENTES)
    assert resposta.status_code == 200

    linha = linhas(resposta)[0]
    assert linha["nome_completo"] == "João da Silva"
    assert linha["responsavel_nome"] == "Maria da Silva"
    assert linha["responsavel_parentesco"] == "Mãe"
    assert linha["profissionais"] == "Ana Terapeuta"
    assert linha["situacao"] == "Ativo"


def test_pacientes_filtra_por_busca_de_nome(api, direcao, paciente):
    """?busca faz match parcial no nome do paciente."""
    assert len(linhas(api(direcao).get(URL_PACIENTES, {"busca": "João"}))) == 1
    assert len(linhas(api(direcao).get(URL_PACIENTES, {"busca": "Inexistente"}))) == 0


def test_pacientes_filtra_por_uf_e_rejeita_uf_invalida(api, direcao, paciente):
    """?estado filtra pela UF do endereço e valida o valor."""
    assert len(linhas(api(direcao).get(URL_PACIENTES, {"estado": "PA"}))) == 1
    assert len(linhas(api(direcao).get(URL_PACIENTES, {"estado": "SP"}))) == 0

    resposta = api(direcao).get(URL_PACIENTES, {"estado": "XX"})
    assert resposta.status_code == 400
    assert "estado" in resposta.data


def test_pacientes_sem_duplicata_com_varios_profissionais(
    api, direcao, paciente, cria_usuario
):
    """
    Regressão: o filtro por profissional é um join M2M.

    Sem o ``distinct()``, um paciente com dois profissionais vinculados
    apareceria duas vezes na listagem sem filtro.
    """
    from apps.accounts.models import Papel

    outro = cria_usuario("prof2@clinica.com", Papel.PROFISSIONAL, "Bruno")
    paciente.profissionais.add(outro)

    assert len(linhas(api(direcao).get(URL_PACIENTES))) == 1


# --- Agendamentos ------------------------------------------------------------

def test_agendamentos_lista_todos_os_status(api, direcao, agendamentos):
    """Sem filtro, o relatório traz a agenda inteira do período."""
    resposta = api(direcao).get(URL_AGENDAMENTOS)
    assert resposta.data["total_registros"] == 3


def test_agendamentos_filtra_por_multiplos_status(api, direcao, agendamentos):
    """?status aceita múltiplos valores (?status=A&status=B)."""
    resposta = api(direcao).get(URL_AGENDAMENTOS, {"status": ["ATENDIDO", "FALTA"]})
    assert resposta.data["total_registros"] == 2
    assert {linha["status"] for linha in linhas(resposta)} == {"Atendido", "Falta"}


def test_agendamentos_aceita_status_separado_por_virgula(api, direcao, agendamentos):
    """?status=A,B é o formato que o axios produz ao serializar um array."""
    resposta = api(direcao).get(URL_AGENDAMENTOS, {"status": "ATENDIDO,FALTA"})
    assert resposta.data["total_registros"] == 2


def test_agendamentos_rejeita_status_invalido(api, direcao, agendamentos):
    """Status fora do enum devolve 400 em vez de ignorar o filtro."""
    resposta = api(direcao).get(URL_AGENDAMENTOS, {"status": "INVENTADO"})
    assert resposta.status_code == 400
    assert "status" in resposta.data


def test_agendamentos_traz_parecer_e_duracao(api, direcao, agendamentos):
    """A falta carrega o parecer, e a duração vem calculada dos horários."""
    resposta = api(direcao).get(URL_AGENDAMENTOS, {"status": "FALTA"})
    linha = linhas(resposta)[0]
    assert linha["parecer_status"] == "Paciente não compareceu"
    assert linha["duracao_minutos"] == 50
    assert linha["recorrencia"] == "Avulso"


def test_agendamentos_filtra_por_periodo(api, direcao, agendamentos):
    """O período recorta pela data da consulta."""
    resposta = api(direcao).get(
        URL_AGENDAMENTOS, {"data_inicio": "2026-11-01", "data_fim": "2026-11-06"}
    )
    assert resposta.data["total_registros"] == 2


def test_periodo_invertido_devolve_400(api, direcao, agendamentos):
    """Data inicial depois da final é erro de entrada, não resultado vazio."""
    resposta = api(direcao).get(
        URL_AGENDAMENTOS, {"data_inicio": "2026-12-01", "data_fim": "2026-11-01"}
    )
    assert resposta.status_code == 400
    assert "data_inicio" in resposta.data


def test_data_malformada_devolve_400(api, direcao, agendamentos):
    """Data fora do formato ISO devolve 400 com mensagem clara."""
    resposta = api(direcao).get(URL_AGENDAMENTOS, {"data_inicio": "01/11/2026"})
    assert resposta.status_code == 400


# --- Produção ----------------------------------------------------------------

def test_producao_inclui_apenas_atendimentos_com_cobranca(
    api, direcao, agendamentos
):
    """AGENDADO não gera produção; ATENDIDO e FALTA sim."""
    resposta = api(direcao).get(URL_PRODUCAO)
    assert resposta.data["total_registros"] == 2
    assert {linha["motivo"] for linha in linhas(resposta)} == {
        "Atendimento Realizado",
        "Falta do Paciente",
    }


def test_producao_soma_o_valor_produzido(api, direcao, agendamentos):
    """O total agregado soma o valor da clínica dos dois lançamentos."""
    resposta = api(direcao).get(URL_PRODUCAO)
    assert Decimal(str(resposta.data["totais"]["valor"])) == Decimal("400.00")


def test_producao_marca_situacao_do_pagamento(api, direcao, agendamentos, pagamento):
    """A produção informa se a baixa de pagamento já foi registrada."""
    resposta = api(direcao).get(URL_PRODUCAO, {"motivo": "Atendimento Realizado"})
    linha = linhas(resposta)[0]
    assert linha["pagamento_situacao"] == "Pago"
    assert Decimal(str(linha["valor_pago"])) == Decimal("200.00")
    assert linha["forma_pagamento"] == "Pix"


def test_producao_sem_pagamento_fica_em_aberto(api, direcao, agendamentos):
    """Sem baixa registrada, a linha aparece como em aberto."""
    resposta = api(direcao).get(URL_PRODUCAO, {"motivo": "Falta do Paciente"})
    linha = linhas(resposta)[0]
    assert linha["pagamento_situacao"] == "Em aberto"
    assert linha["valor_pago"] is None


def test_producao_rejeita_motivo_invalido(api, direcao, agendamentos):
    """Motivo fora dos gravados pelo ledger devolve 400."""
    resposta = api(direcao).get(URL_PRODUCAO, {"motivo": "Qualquer Coisa"})
    assert resposta.status_code == 400


# --- Repasse -----------------------------------------------------------------

def test_repasse_considera_apenas_atendimentos_pagos(
    api, direcao, agendamentos, pagamento
):
    """
    Regra de negócio: o repasse acompanha o recebimento.

    Há dois lançamentos de produção, mas só um tem baixa de pagamento — então o
    repasse tem uma única linha.
    """
    resposta = api(direcao).get(URL_REPASSE)
    assert resposta.data["total_registros"] == 1

    linha = linhas(resposta)[0]
    assert linha["profissional"] == "Ana Terapeuta"
    assert Decimal(str(linha["valor_repasse"])) == Decimal("120.00")
    # Retido pela clínica = pago (200) − repasse (120).
    assert Decimal(str(linha["valor_clinica"])) == Decimal("80.00")


def test_repasse_vazio_sem_baixa_de_pagamento(api, direcao, agendamentos):
    """Sem pagamento registrado não há repasse a pagar."""
    resposta = api(direcao).get(URL_REPASSE)
    assert resposta.data["total_registros"] == 0
    assert Decimal(str(resposta.data["totais"]["valor_repasse"])) == Decimal("0.00")


def test_repasse_usa_o_snapshot_e_ignora_servico_editado(
    api, direcao, agendamentos, pagamento, servico
):
    """
    O repasse vem do snapshot da baixa, não do ``Servico`` atual.

    Editar o valor de repasse do serviço depois do fechamento não pode reescrever
    o histórico já apurado.
    """
    servico.valor_repasse = Decimal("999.00")
    servico.save()

    resposta = api(direcao).get(URL_REPASSE)
    assert Decimal(str(linhas(resposta)[0]["valor_repasse"])) == Decimal("120.00")


def test_repasse_consolidado_agrupa_por_profissional(
    api, direcao, agendamentos, pagamento
):
    """?agrupar=true devolve uma linha por profissional, com contagem."""
    resposta = api(direcao).get(URL_REPASSE, {"agrupar": "true"})
    assert resposta.data["total_registros"] == 1

    linha = linhas(resposta)[0]
    assert linha["profissional"] == "Ana Terapeuta"
    assert linha["conselho"] == "CRP PA/1009775"
    assert linha["atendimentos"] == 1
    assert Decimal(str(linha["valor_repasse"])) == Decimal("120.00")


def test_repasse_filtra_por_forma_de_pagamento(api, direcao, agendamentos, pagamento):
    """?forma_pagamento recorta pela forma registrada na baixa."""
    assert (
        api(direcao).get(URL_REPASSE, {"forma_pagamento": "PIX"}).data[
            "total_registros"
        ]
        == 1
    )
    assert (
        api(direcao).get(URL_REPASSE, {"forma_pagamento": "DINHEIRO"}).data[
            "total_registros"
        ]
        == 0
    )


def test_repasse_rejeita_forma_de_pagamento_invalida(api, direcao, pagamento):
    """Forma de pagamento fora do enum devolve 400."""
    resposta = api(direcao).get(URL_REPASSE, {"forma_pagamento": "BITCOIN"})
    assert resposta.status_code == 400


# --- Proteção contra recorte gigante ----------------------------------------

def test_recorte_acima_do_teto_devolve_400(api, direcao, paciente, monkeypatch):
    """
    Um recorte maior que o teto é recusado, não truncado.

    Truncar em silêncio entregaria uma planilha incompleta que iria para o
    fechamento como se estivesse inteira. Aqui o teto é baixado para 0 para
    provar a regra sem precisar criar 20 mil registros.
    """
    monkeypatch.setattr("apps.relatorios.views.MAX_LINHAS_RELATORIO", 0)

    resposta = api(direcao).get(URL_PACIENTES)
    assert resposta.status_code == 400
    assert "limite" in str(resposta.data).lower()


def test_exportacao_tambem_respeita_o_teto(api, direcao, paciente, monkeypatch):
    """O ?formato=xlsx passa pela mesma verificação antes de montar a planilha."""
    monkeypatch.setattr("apps.relatorios.views.MAX_LINHAS_RELATORIO", 0)

    resposta = api(direcao).get(URL_PACIENTES, {"formato": "xlsx"})
    assert resposta.status_code == 400
