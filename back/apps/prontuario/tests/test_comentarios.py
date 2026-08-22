"""Testes das anotações colaborativas (observações e comentários) das entradas."""
import pytest

from apps.prontuario.models import (
    ComentarioEntrada,
    EntradaProntuario,
    ItemProntuario,
    TipoComentario,
    TipoItem,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def item_texto(prof_a):
    return ItemProntuario.objects.create(
        profissional=prof_a, nome="Evolução", tipo_item=TipoItem.TEXTO_LIVRE
    )


@pytest.fixture
def entrada(prof_a, cria_paciente, item_texto):
    pac = cria_paciente(profissionais=[prof_a])
    return EntradaProntuario.objects.create(
        paciente=pac, item=item_texto, autor=prof_a, profissional=prof_a, conteudo="x"
    )


class TestComentarios:
    def test_criar_observacao_no_registro_de_outro_autor(self, cliente, direcao, entrada):
        """Colaborativo: quem não é autor do registro pode anotar (aqui, a Direção)."""
        api = cliente(direcao)
        resp = api.post(
            "/api/prontuario/comentarios/",
            {"entrada": entrada.id, "tipo": TipoComentario.OBSERVACAO, "texto": "Atenção"},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        anot = ComentarioEntrada.objects.get(id=resp.data["id"])
        assert anot.autor == direcao
        assert anot.tipo == TipoComentario.OBSERVACAO

    def test_criar_comentario(self, cliente, prof_a, entrada):
        api = cliente(prof_a)
        resp = api.post(
            "/api/prontuario/comentarios/",
            {"entrada": entrada.id, "tipo": TipoComentario.COMENTARIO, "texto": "ok"},
            format="json",
        )
        assert resp.status_code == 201, resp.data
        assert resp.data["pode_editar"] is True

    def test_texto_em_branco_invalido(self, cliente, prof_a, entrada):
        api = cliente(prof_a)
        resp = api.post(
            "/api/prontuario/comentarios/",
            {"entrada": entrada.id, "tipo": TipoComentario.COMENTARIO, "texto": "   "},
            format="json",
        )
        assert resp.status_code == 400

    def test_edicao_e_exclusao_apenas_autor(self, cliente, prof_a, direcao, entrada):
        anot = ComentarioEntrada.objects.create(
            entrada=entrada, tipo=TipoComentario.COMENTARIO, texto="orig", autor=prof_a
        )
        # Direção vê o paciente, mas não é autora da anotação.
        api = cliente(direcao)
        assert api.patch(
            f"/api/prontuario/comentarios/{anot.id}/", {"texto": "hack"}, format="json"
        ).status_code == 403
        assert api.delete(f"/api/prontuario/comentarios/{anot.id}/").status_code == 403
        # O autor consegue.
        api = cliente(prof_a)
        assert api.patch(
            f"/api/prontuario/comentarios/{anot.id}/", {"texto": "nova"}, format="json"
        ).status_code == 200
        assert api.delete(f"/api/prontuario/comentarios/{anot.id}/").status_code == 204

    def test_recorte_por_paciente_visivel(self, cliente, prof_a, prof_b, entrada):
        ComentarioEntrada.objects.create(
            entrada=entrada, tipo=TipoComentario.COMENTARIO, texto="secreto", autor=prof_a
        )
        # prof_b não está vinculado ao paciente -> não enxerga a anotação.
        api = cliente(prof_b)
        resp = api.get(f"/api/prontuario/comentarios/?entrada__paciente={entrada.paciente_id}")
        assert resp.status_code == 200
        dados = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        assert len(dados) == 0

    def test_filtro_por_tipo(self, cliente, prof_a, entrada):
        ComentarioEntrada.objects.create(
            entrada=entrada, tipo=TipoComentario.OBSERVACAO, texto="obs", autor=prof_a
        )
        ComentarioEntrada.objects.create(
            entrada=entrada, tipo=TipoComentario.COMENTARIO, texto="com", autor=prof_a
        )
        api = cliente(prof_a)
        resp = api.get(f"/api/prontuario/comentarios/?entrada={entrada.id}&tipo=OBSERVACAO")
        dados = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        assert len(dados) == 1
        assert dados[0]["tipo"] == "OBSERVACAO"

    def test_recepcao_sem_acesso(self, cliente, recepcao, entrada):
        api = cliente(recepcao)
        resp = api.post(
            "/api/prontuario/comentarios/",
            {"entrada": entrada.id, "tipo": TipoComentario.COMENTARIO, "texto": "x"},
            format="json",
        )
        assert resp.status_code == 403
