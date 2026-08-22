"""Testes da configuração do prontuário (itens, permissões, schema, replicar, protocolos)."""
import pytest

from apps.prontuario.models import (
    GrupoExames,
    ItemProntuario,
    ModeloAtestado,
    ProtocoloProntuario,
    TextoPadrao,
    TipoItem,
)

pytestmark = pytest.mark.django_db


def _schema_valido():
    return [
        {"id": "f1", "tipo": "TEXTO_CURTO", "rotulo": "Peso", "ordem": 0, "obrigatorio": False, "opcoes": []},
        {"id": "f2", "tipo": "SELECAO_UNICA", "rotulo": "Humor", "ordem": 1, "obrigatorio": True, "opcoes": ["Bom", "Ruim"]},
    ]


class TestPermissoesConfig:
    def test_direcao_cria_item(self, cliente, direcao, prof_a):
        api = cliente(direcao)
        resp = api.post(
            "/api/prontuario/itens/",
            {"profissional": prof_a.id, "nome": "Evolução", "tipo_item": TipoItem.TEXTO_LIVRE},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        assert ItemProntuario.objects.filter(profissional=prof_a).exists()

    def test_profissional_nao_configura(self, cliente, prof_a):
        api = cliente(prof_a)
        resp = api.post(
            "/api/prontuario/itens/",
            {"profissional": prof_a.id, "nome": "Evolução", "tipo_item": TipoItem.TEXTO_LIVRE},
            format="json",
        )
        assert resp.status_code == 403

    def test_recepcao_nao_configura(self, cliente, recepcao, prof_a):
        api = cliente(recepcao)
        resp = api.get(f"/api/prontuario/itens/?profissional={prof_a.id}")
        assert resp.status_code == 403


class TestSchemaFormulario:
    def test_formulario_valido(self, cliente, direcao, prof_a):
        api = cliente(direcao)
        resp = api.post(
            "/api/prontuario/itens/",
            {
                "profissional": prof_a.id,
                "nome": "Sessão",
                "tipo_item": TipoItem.FORMULARIO,
                "formulario_schema": _schema_valido(),
            },
            format="json",
        )
        assert resp.status_code == 201, resp.data

    def test_escolha_sem_opcoes_falha(self, cliente, direcao, prof_a):
        api = cliente(direcao)
        schema = [{"id": "f1", "tipo": "SELECAO_UNICA", "rotulo": "X", "ordem": 0, "opcoes": []}]
        resp = api.post(
            "/api/prontuario/itens/",
            {"profissional": prof_a.id, "nome": "S", "tipo_item": TipoItem.FORMULARIO, "formulario_schema": schema},
            format="json",
        )
        assert resp.status_code == 400

    def test_ids_duplicados_falham(self, cliente, direcao, prof_a):
        api = cliente(direcao)
        schema = [
            {"id": "f1", "tipo": "TEXTO_CURTO", "rotulo": "A", "ordem": 0},
            {"id": "f1", "tipo": "TEXTO_CURTO", "rotulo": "B", "ordem": 1},
        ]
        resp = api.post(
            "/api/prontuario/itens/",
            {"profissional": prof_a.id, "nome": "S", "tipo_item": TipoItem.FORMULARIO, "formulario_schema": schema},
            format="json",
        )
        assert resp.status_code == 400

    def test_formulario_vazio_falha(self, cliente, direcao, prof_a):
        api = cliente(direcao)
        resp = api.post(
            "/api/prontuario/itens/",
            {"profissional": prof_a.id, "nome": "S", "tipo_item": TipoItem.FORMULARIO, "formulario_schema": []},
            format="json",
        )
        assert resp.status_code == 400


class TestReplicar:
    def test_replicar_copia_sem_alterar_origem(self, cliente, direcao, prof_a, prof_b):
        ItemProntuario.objects.create(profissional=prof_a, nome="Evolução", tipo_item=TipoItem.TEXTO_LIVRE)
        ItemProntuario.objects.create(
            profissional=prof_a, nome="Sessão", tipo_item=TipoItem.FORMULARIO,
            formulario_schema=_schema_valido(),
        )
        TextoPadrao.objects.create(profissional=prof_a, titulo="Padrão", conteudo="oi")
        ModeloAtestado.objects.create(profissional=prof_a, nome="Comparecimento", corpo="x")
        GrupoExames.objects.create(profissional=prof_a, nome="Sangue", exames=[{"nome": "Hemograma"}])

        api = cliente(direcao)
        resp = api.post(
            "/api/prontuario/config/replicar/",
            {"origem": prof_a.id, "destino": prof_b.id, "incluir": ["itens", "textos", "atestados", "grupos"]},
            format="json",
        )
        assert resp.status_code == 200, resp.data
        assert ItemProntuario.objects.filter(profissional=prof_b).count() == 2
        assert TextoPadrao.objects.filter(profissional=prof_b).count() == 1
        assert ModeloAtestado.objects.filter(profissional=prof_b).count() == 1
        assert GrupoExames.objects.filter(profissional=prof_b).count() == 1
        # origem intacta
        assert ItemProntuario.objects.filter(profissional=prof_a).count() == 2

    def test_replicar_origem_igual_destino_falha(self, cliente, direcao, prof_a):
        api = cliente(direcao)
        resp = api.post(
            "/api/prontuario/config/replicar/",
            {"origem": prof_a.id, "destino": prof_a.id, "incluir": ["itens"]},
            format="json",
        )
        assert resp.status_code == 400


class TestProtocolos:
    def test_importar_cria_item(self, cliente, direcao, prof_a):
        proto = ProtocoloProntuario.objects.create(
            nome="Anamnese", tipo_item=TipoItem.FORMULARIO, formulario_schema=_schema_valido()
        )
        api = cliente(direcao)
        resp = api.post(
            f"/api/prontuario/protocolos/{proto.id}/importar/",
            {"profissional": prof_a.id},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        item = ItemProntuario.objects.get(profissional=prof_a, nome="Anamnese")
        assert item.tipo_item == TipoItem.FORMULARIO
        assert len(item.formulario_schema) == 2
