"""
Testes do cadastro completo de prestador e da gestão de especialidades.

Cobre:
  - CRUD de ``Especialidade`` (restrito a DIREÇÃO/SUPERVISÃO; exclusão lógica).
  - Regra: profissional exige ao menos uma especialidade.
  - Campos do cadastro completo (dados pessoais, contato, endereço, conselho).
  - Normalização/validação de CPF e montagem do ``conselho`` (assinatura).
"""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from apps.accounts.models import Especialidade, Papel
from apps.accounts.tests.conftest import SENHA_PADRAO

Usuario = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def especialidade(db):
    # ``get_or_create``: a migration de seed já cadastra "Psicólogo Clínico".
    return Especialidade.objects.get_or_create(nome="Psicólogo Clínico")[0]


# --- Modelo: conselho montado --------------------------------------------------

class TestConselhoMontado:
    def test_conselho_property_monta_a_partir_dos_campos(self, cria_usuario):
        u = cria_usuario(
            conselho_tipo="CRP", conselho_uf="PA", conselho_numero="1009775"
        )
        assert u.conselho == "CRP PA/1009775"

    def test_conselho_vazio_quando_incompleto(self, cria_usuario):
        u = cria_usuario(conselho_tipo="CRP")  # sem número
        assert u.conselho == ""


# --- Especialidades: CRUD e permissões ----------------------------------------

class TestEspecialidades:
    def test_direcao_cria_especialidade(self, api_client, direcao):
        # Nome fora da lista semeada pela migration, para não colidir (unique).
        api_client.force_authenticate(user=direcao)
        resp = api_client.post(
            reverse("especialidade-list"), {"nome": "Arteterapeuta"}, format="json"
        )
        assert resp.status_code == 201, resp.data
        assert Especialidade.objects.filter(nome="Arteterapeuta").exists()

    def test_profissional_nao_gerencia_especialidades(self, cliente_autenticado):
        resp = cliente_autenticado.get(reverse("especialidade-list"))
        assert resp.status_code == 403

    def test_listagem_traz_apenas_ativas_por_padrao(self, api_client, direcao):
        Especialidade.objects.create(nome="Ativa X")
        Especialidade.objects.create(nome="Inativa Y", ativo=False)
        api_client.force_authenticate(user=direcao)
        resp = api_client.get(reverse("especialidade-list"))
        nomes = [e["nome"] for e in resp.data]
        assert "Ativa X" in nomes
        assert "Inativa Y" not in nomes

    def test_delete_desativa_especialidade(self, api_client, direcao, especialidade):
        api_client.force_authenticate(user=direcao)
        resp = api_client.delete(
            reverse("especialidade-detail", args=[especialidade.id])
        )
        assert resp.status_code == 204
        especialidade.refresh_from_db()
        assert especialidade.ativo is False  # exclusão lógica


# --- Cadastro de prestador -----------------------------------------------------

class TestCadastroPrestador:
    def _payload_base(self, **extra):
        base = {
            "nome": "Dra. Ana Silva",
            "email": "ana@clinica.com",
            "role": Papel.PROFISSIONAL,
            "password": SENHA_PADRAO,
        }
        base.update(extra)
        return base

    def test_profissional_exige_especialidade(self, api_client, direcao):
        api_client.force_authenticate(user=direcao)
        resp = api_client.post(
            reverse("usuario-list"), self._payload_base(), format="json"
        )
        assert resp.status_code == 400
        assert "especialidades" in resp.data

    def test_cria_profissional_com_especialidade_e_dados(
        self, api_client, direcao, especialidade
    ):
        api_client.force_authenticate(user=direcao)
        resp = api_client.post(
            reverse("usuario-list"),
            self._payload_base(
                especialidades=[especialidade.id],
                cpf="606.527.663-40",
                rg="1234567",
                rg_orgao_emissor="SSP/PA",
                data_nascimento="1999-06-30",
                sexo="FEMININO",
                telefone="(91) 98501-1982",
                celular="(91) 3222-0000",
                conselho_tipo="CRP",
                conselho_uf="PA",
                conselho_numero="1009775",
                cep="66000-000",
                logradouro="Av. Central",
                numero="100",
                bairro="Centro",
                cidade="Belém",
                estado="PA",
            ),
            format="json",
        )
        assert resp.status_code == 201, resp.data
        u = Usuario.objects.get(email="ana@clinica.com")
        # CPF/telefone/CEP normalizados para dígitos.
        assert u.cpf == "60652766340"
        assert u.telefone == "91985011982"
        assert u.cep == "66000000"
        assert u.sexo == "FEMININO"
        assert u.conselho == "CRP PA/1009775"
        assert list(u.especialidades.values_list("nome", flat=True)) == [
            "Psicólogo Clínico"
        ]
        # A leitura devolve as especialidades detalhadas.
        assert resp.data["especialidades_detalhe"][0]["nome"] == "Psicólogo Clínico"

    def test_cpf_invalido_recusado(self, api_client, direcao, especialidade):
        api_client.force_authenticate(user=direcao)
        resp = api_client.post(
            reverse("usuario-list"),
            self._payload_base(
                especialidades=[especialidade.id], cpf="111.111.111-11"
            ),
            format="json",
        )
        assert resp.status_code == 400
        assert "cpf" in resp.data

    def test_recepcao_dispensa_especialidade(self, api_client, direcao):
        api_client.force_authenticate(user=direcao)
        resp = api_client.post(
            reverse("usuario-list"),
            {
                "nome": "Recepção",
                "email": "recepcao2@clinica.com",
                "role": Papel.RECEPCAO,
                "password": SENHA_PADRAO,
            },
            format="json",
        )
        assert resp.status_code == 201, resp.data

    def test_edita_outros_campos_de_profissional_sem_especialidade_nao_bloqueia(
        self, api_client, direcao, cria_usuario
    ):
        # Profissional legado sem especialidade: editar o telefone não deve exigir
        # especialidade (só cobramos na criação ou ao alterar especialidades).
        prof = cria_usuario(email="legado@clinica.com", role=Papel.PROFISSIONAL)
        api_client.force_authenticate(user=direcao)
        resp = api_client.patch(
            reverse("usuario-detail", args=[prof.id]),
            {"telefone": "(91) 98888-0000"},
            format="json",
        )
        assert resp.status_code == 200, resp.data
        prof.refresh_from_db()
        assert prof.telefone == "91988880000"
