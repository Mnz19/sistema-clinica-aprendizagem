"""Testes de preenchimento (entradas), visibilidade, macros e atestados."""
import pytest

from apps.prontuario.macros import resolver_macros
from apps.prontuario.models import (
    EntradaProntuario,
    ItemProntuario,
    ModeloAtestado,
    TipoItem,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def item_texto(prof_a):
    return ItemProntuario.objects.create(
        profissional=prof_a, nome="Evolução", tipo_item=TipoItem.TEXTO_LIVRE
    )


@pytest.fixture
def item_form(prof_a):
    return ItemProntuario.objects.create(
        profissional=prof_a,
        nome="Sessão",
        tipo_item=TipoItem.FORMULARIO,
        formulario_schema=[
            {"id": "temas", "tipo": "TEXTO_LONGO", "rotulo": "Temas", "ordem": 0, "obrigatorio": True},
        ],
    )


class TestEntradas:
    def test_criar_entrada_texto(self, cliente, prof_a, cria_paciente, item_texto):
        pac = cria_paciente(profissionais=[prof_a])
        api = cliente(prof_a)
        resp = api.post(
            "/api/prontuario/entradas/",
            {"paciente": pac.id, "item": item_texto.id, "conteudo": "<p>Sessão ok</p>"},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        entrada = EntradaProntuario.objects.get(id=resp.data["id"])
        assert entrada.autor == prof_a
        assert entrada.profissional == prof_a

    def test_form_congela_schema_snapshot(self, cliente, prof_a, cria_paciente, item_form):
        pac = cria_paciente(profissionais=[prof_a])
        api = cliente(prof_a)
        resp = api.post(
            "/api/prontuario/entradas/",
            {"paciente": pac.id, "item": item_form.id, "respostas": {"temas": "ansiedade"}},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        entrada = EntradaProntuario.objects.get(id=resp.data["id"])
        assert entrada.schema_snapshot == item_form.formulario_schema
        # Alterar o item depois não muda o snapshot da entrada.
        item_form.formulario_schema = []
        item_form.save()
        entrada.refresh_from_db()
        assert entrada.schema_snapshot != []

    def test_form_campo_obrigatorio(self, cliente, prof_a, cria_paciente, item_form):
        pac = cria_paciente(profissionais=[prof_a])
        api = cliente(prof_a)
        resp = api.post(
            "/api/prontuario/entradas/",
            {"paciente": pac.id, "item": item_form.id, "respostas": {}},
            format="json",
        )
        assert resp.status_code == 400

    def test_visibilidade_por_profissional(self, cliente, prof_a, prof_b, cria_paciente, item_texto):
        pac = cria_paciente(profissionais=[prof_a])
        EntradaProntuario.objects.create(paciente=pac, item=item_texto, autor=prof_a, profissional=prof_a)
        # prof_b não vê o paciente
        api = cliente(prof_b)
        resp = api.get(f"/api/prontuario/entradas/?paciente={pac.id}")
        assert resp.status_code == 200
        assert resp.data["count"] == 0 if isinstance(resp.data, dict) else len(resp.data) == 0

    def test_edicao_apenas_autor(self, cliente, prof_a, direcao, cria_paciente, item_texto):
        pac = cria_paciente(profissionais=[prof_a])
        entrada = EntradaProntuario.objects.create(
            paciente=pac, item=item_texto, autor=prof_a, profissional=prof_a, conteudo="x"
        )
        api = cliente(direcao)  # direção vê, mas não é autora
        resp = api.patch(f"/api/prontuario/entradas/{entrada.id}/", {"conteudo": "y"}, format="json")
        assert resp.status_code == 403

    def test_itens_do_paciente(self, cliente, prof_a, cria_paciente, item_texto, item_form):
        # item oculto não deve aparecer
        ItemProntuario.objects.create(
            profissional=prof_a, nome="Oculto", tipo_item=TipoItem.TEXTO_LIVRE, visivel=False
        )
        pac = cria_paciente(profissionais=[prof_a])
        api = cliente(prof_a)
        resp = api.get(f"/api/prontuario/entradas/itens-do-paciente/?paciente={pac.id}")
        assert resp.status_code == 200
        nomes = {i["nome"] for i in resp.data}
        assert nomes == {"Evolução", "Sessão"}

    def test_itens_do_paciente_sempre_os_meus(
        self, cliente, prof_a, prof_b, cria_paciente, item_texto
    ):
        """Cada profissional vê SEMPRE os próprios itens (sem filtro por profissional)."""
        ItemProntuario.objects.create(
            profissional=prof_b, nome="Item do B", tipo_item=TipoItem.TEXTO_LIVRE
        )
        pac = cria_paciente(profissionais=[prof_a, prof_b])

        # prof_a vê só os próprios itens.
        resp = cliente(prof_a).get(
            f"/api/prontuario/entradas/itens-do-paciente/?paciente={pac.id}"
        )
        assert {i["nome"] for i in resp.data} == {"Evolução"}

        # prof_b vê só os próprios itens.
        resp = cliente(prof_b).get(
            f"/api/prontuario/entradas/itens-do-paciente/?paciente={pac.id}"
        )
        assert {i["nome"] for i in resp.data} == {"Item do B"}

    def test_timeline_reune_registros_de_todos(
        self, cliente, prof_a, prof_b, cria_paciente, item_texto
    ):
        """A listagem de entradas do paciente reúne registros de todos os profissionais."""
        item_b = ItemProntuario.objects.create(
            profissional=prof_b, nome="Item do B", tipo_item=TipoItem.TEXTO_LIVRE
        )
        pac = cria_paciente(profissionais=[prof_a, prof_b])
        EntradaProntuario.objects.create(
            paciente=pac, item=item_texto, autor=prof_a, profissional=prof_a, conteudo="A"
        )
        EntradaProntuario.objects.create(
            paciente=pac, item=item_b, autor=prof_b, profissional=prof_b, conteudo="B"
        )

        resp = cliente(prof_a).get(f"/api/prontuario/entradas/?paciente={pac.id}")
        dados = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        autores = {e["autor"] for e in dados}
        assert autores == {prof_a.id, prof_b.id}


def _recarrega(pac):
    """Recarrega do banco para ter ``data_nascimento`` como date (não string)."""
    pac.refresh_from_db()
    return pac


class TestMacros:
    def test_resolve_macros_basicas(self, cria_paciente):
        pac = _recarrega(cria_paciente(
            nome="João Silva", cpf="52998224725", rg="123456", nome_pai="Pai", nome_mae="Mãe"
        ))
        texto = "Paciente [NOME_PACIENTE], RG [RG_PACIENTE], CPF [CPF_PACIENTE], pai [NOME_PAI]."
        out = resolver_macros(texto, paciente=pac)
        assert "João Silva" in out
        assert "123456" in out
        assert "529.982.247-25" in out
        assert "Pai" in out

    def test_lista_cid(self, cria_paciente):
        pac = _recarrega(cria_paciente())
        texto = "CID: [LISTA_CID] / Cod: [LISTA_CODIGO_CID]"
        out = resolver_macros(
            texto, paciente=pac, cids=[{"codigo": "F90.0", "descricao": "TDAH"}]
        )
        assert "F90.0 — TDAH" in out
        assert "Cod: F90.0" in out

    def test_token_desconhecido_preservado(self, cria_paciente):
        pac = _recarrega(cria_paciente())
        out = resolver_macros("[MACRO_INVENTADA] fim", paciente=pac)
        assert "[MACRO_INVENTADA]" in out

    def test_unidade_default(self, cria_paciente, settings):
        settings.CLINICA_NOME = "Clínica Teste"
        pac = _recarrega(cria_paciente())
        out = resolver_macros("[NOME_UNIDADE]", paciente=pac)
        assert out == "Clínica Teste"


class TestAtestados:
    def test_gerar_resolve_macros(self, cliente, prof_a, cria_paciente):
        pac = cria_paciente(nome="Maria", profissionais=[prof_a], cpf="52998224725")
        modelo = ModeloAtestado.objects.create(
            profissional=prof_a,
            nome="Comparecimento",
            titulo="Atestado de [NOME_PACIENTE]",
            corpo="Atesto que [NOME_PACIENTE] compareceu em [DATA_ATUAL].",
        )
        api = cliente(prof_a)
        resp = api.post(
            "/api/prontuario/atestados/gerar/",
            {"paciente": pac.id, "modelo": modelo.id},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        assert "Maria" in resp.data["titulo"]
        assert "Maria" in resp.data["corpo_resolvido"]
        assert "[NOME_PACIENTE]" not in resp.data["corpo_resolvido"]

    def test_gerar_paciente_inacessivel(self, cliente, prof_a, prof_b, cria_paciente):
        pac = cria_paciente(profissionais=[prof_a])
        modelo = ModeloAtestado.objects.create(profissional=prof_b, nome="X", corpo="y")
        api = cliente(prof_b)  # prof_b não atende o paciente
        resp = api.post(
            "/api/prontuario/atestados/gerar/",
            {"paciente": pac.id, "modelo": modelo.id},
            format="json",
        )
        assert resp.status_code == 403
