"""
Testes dos ViewSets do módulo de clínica: Sala, Serviço, Disponibilidade e Ausência
do profissional.

Para cada recurso é verificado:
- listagem (GET) → 200;
- criação (POST) → 201 e persistência correta dos dados;
- exclusão (DELETE) → 204 e "soft delete" (o registro continua no banco, mas
  com ``ativo``/``ativa`` = ``False``);
- ausência de autenticação → 401 (a API exige JWT).
"""
import pytest
from django.urls import reverse

from apps.clinica.models import AusenciaProfissional, DisponibilidadeProfissional, Sala, Servico

pytestmark = pytest.mark.django_db


class TestSalaViewSet:
    def test_lista_retorna_200(self, cliente_autenticado, cria_sala):
        cria_sala(nome="Sala A")
        cria_sala(nome="Sala B")

        resp = cliente_autenticado.get(reverse("sala-list"))

        assert resp.status_code == 200
        assert len(resp.data) == 2

    def test_cria_sala_com_sucesso(self, cliente_autenticado):
        payload = {
            "nome": "Sala de Avaliação",
            "descricao": "Sala equipada para avaliação neuropsicológica",
        }

        resp = cliente_autenticado.post(reverse("sala-list"), payload, format="json")

        assert resp.status_code == 201, resp.data
        sala = Sala.objects.get(id=resp.data["id"])
        assert sala.nome == payload["nome"]
        assert sala.descricao == payload["descricao"]
        assert sala.ativa is True

    def test_delete_realiza_soft_delete(self, cliente_autenticado, cria_sala):
        sala = cria_sala(nome="Sala a remover")

        resp = cliente_autenticado.delete(reverse("sala-detail", args=[sala.id]))

        assert resp.status_code == 204
        assert Sala.objects.filter(id=sala.id).exists()
        sala.refresh_from_db()
        assert sala.ativa is False

    def test_sem_autenticacao_retorna_401(self, api_client):
        assert api_client.get(reverse("sala-list")).status_code == 401


class TestServicoViewSet:
    def test_lista_retorna_200(self, cliente_autenticado, cria_servico):
        cria_servico(nome="Psicoterapia")
        cria_servico(nome="Avaliação Neuropsicológica")

        resp = cliente_autenticado.get(reverse("servico-list"))

        assert resp.status_code == 200
        assert len(resp.data) == 2

    def test_cria_servico_com_sucesso(self, cliente_autenticado, profissional):
        payload = {
            "nome": "Avaliação Neuropsicológica",
            "descricao": "Bateria completa de testes",
            "duracao_minutos": 90,
            "valor_clinica": "450.00",
            "valor_repasse": "200.00",
            "profissionais": [profissional.id],
        }

        resp = cliente_autenticado.post(reverse("servico-list"), payload, format="json")

        assert resp.status_code == 201, resp.data
        servico = Servico.objects.get(id=resp.data["id"])
        assert servico.nome == payload["nome"]
        assert servico.duracao_minutos == payload["duracao_minutos"]
        assert str(servico.valor_clinica) == payload["valor_clinica"]
        assert str(servico.valor_repasse) == payload["valor_repasse"]
        assert list(servico.profissionais.values_list("id", flat=True)) == [profissional.id]
        assert servico.ativo is True

    def test_repasse_maior_que_clinica_retorna_400(self, cliente_autenticado, profissional):
        payload = {
            "nome": "Serviço Inválido",
            "duracao_minutos": 50,
            "valor_clinica": "100.00",
            "valor_repasse": "150.00",
            "profissionais": [profissional.id],
        }

        resp = cliente_autenticado.post(reverse("servico-list"), payload, format="json")

        assert resp.status_code == 400
        assert "valor_repasse" in resp.data

    def test_listagem_retorna_valor_clinica_e_repasse(self, cliente_autenticado, cria_servico):
        cria_servico(nome="Terapia", valor_clinica="200.00", valor_repasse="120.00")

        resp = cliente_autenticado.get(reverse("servico-list"))

        assert resp.status_code == 200
        item = resp.data[0]
        assert "valor_clinica" in item
        assert "valor_repasse" in item
        assert "margem" in item
        assert item["margem"] == "80.00"

    def test_delete_realiza_soft_delete(self, cliente_autenticado, cria_servico):
        servico = cria_servico(nome="Serviço a remover")

        resp = cliente_autenticado.delete(reverse("servico-detail", args=[servico.id]))

        assert resp.status_code == 204
        assert Servico.objects.filter(id=servico.id).exists()
        servico.refresh_from_db()
        assert servico.ativo is False

    def test_sem_autenticacao_retorna_401(self, api_client):
        assert api_client.get(reverse("servico-list")).status_code == 401


class TestDisponibilidadeProfissionalViewSet:
    def test_lista_retorna_200(self, cliente_autenticado, cria_disponibilidade):
        cria_disponibilidade(dia_semana=0)
        cria_disponibilidade(dia_semana=1)

        resp = cliente_autenticado.get(reverse("disponibilidade-list"))

        assert resp.status_code == 200
        assert len(resp.data) == 2

    def test_cria_disponibilidade_com_sucesso(self, cliente_autenticado, profissional):
        payload = {
            "profissional": profissional.id,
            "dia_semana": 2,
            "horario_inicio": "08:00:00",
            "horario_fim": "12:00:00",
        }

        resp = cliente_autenticado.post(
            reverse("disponibilidade-list"), payload, format="json"
        )

        assert resp.status_code == 201, resp.data
        disponibilidade = DisponibilidadeProfissional.objects.get(id=resp.data["id"])
        assert disponibilidade.profissional_id == profissional.id
        assert disponibilidade.dia_semana == payload["dia_semana"]
        assert str(disponibilidade.horario_inicio) == payload["horario_inicio"]
        assert str(disponibilidade.horario_fim) == payload["horario_fim"]
        assert disponibilidade.ativo is True

    def test_delete_realiza_soft_delete(self, cliente_autenticado, cria_disponibilidade):
        disponibilidade = cria_disponibilidade(dia_semana=3)

        resp = cliente_autenticado.delete(
            reverse("disponibilidade-detail", args=[disponibilidade.id])
        )

        assert resp.status_code == 204
        assert DisponibilidadeProfissional.objects.filter(id=disponibilidade.id).exists()
        disponibilidade.refresh_from_db()
        assert disponibilidade.ativo is False

    def test_sem_autenticacao_retorna_401(self, api_client):
        assert api_client.get(reverse("disponibilidade-list")).status_code == 401


class TestAusenciaProfissionalViewSet:
    def test_lista_retorna_200(self, cliente_autenticado, cria_ausencia):
        cria_ausencia(data_inicio="2026-02-01", data_fim="2026-02-05")
        cria_ausencia(data_inicio="2026-03-01", data_fim="2026-03-05")

        resp = cliente_autenticado.get(reverse("ausencia-list"))

        assert resp.status_code == 200
        assert len(resp.data) == 2

    def test_cria_ausencia_com_sucesso(self, cliente_autenticado, profissional):
        payload = {
            "profissional": profissional.id,
            "data_inicio": "2026-04-01",
            "data_fim": "2026-04-10",
            "motivo": "Congresso",
        }

        resp = cliente_autenticado.post(reverse("ausencia-list"), payload, format="json")

        assert resp.status_code == 201, resp.data
        ausencia = AusenciaProfissional.objects.get(id=resp.data["id"])
        assert ausencia.profissional_id == profissional.id
        assert str(ausencia.data_inicio) == payload["data_inicio"]
        assert str(ausencia.data_fim) == payload["data_fim"]
        assert ausencia.motivo == payload["motivo"]
        assert ausencia.ativo is True

    def test_delete_realiza_soft_delete(self, cliente_autenticado, cria_ausencia):
        ausencia = cria_ausencia()

        resp = cliente_autenticado.delete(reverse("ausencia-detail", args=[ausencia.id]))

        assert resp.status_code == 204
        assert AusenciaProfissional.objects.filter(id=ausencia.id).exists()
        ausencia.refresh_from_db()
        assert ausencia.ativo is False

    def test_sem_autenticacao_retorna_401(self, api_client):
        assert api_client.get(reverse("ausencia-list")).status_code == 401
