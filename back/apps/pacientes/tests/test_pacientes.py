"""Testes de CRUD, acesso por papel, responsáveis e anexos de pacientes."""
import io

import pytest
from django.urls import reverse

from apps.pacientes.models import DocumentoPaciente, Paciente

pytestmark = pytest.mark.django_db


# --- CRUD e cadastro ---------------------------------------------------------

def test_direcao_cria_paciente_com_responsaveis(cliente, direcao, prof_a):
    api = cliente(direcao)
    payload = {
        "nome_completo": "Maria Souza",
        "data_nascimento": "2016-03-01",
        "cpf": "529.982.247-25",  # CPF válido, com máscara
        "profissionais": [prof_a.id],
        "responsaveis": [
            {"nome": "Ana Souza", "parentesco": "MAE", "telefone": "91999990000", "principal": True},
            {"nome": "Carlos Souza", "parentesco": "PAI"},
        ],
    }
    resp = api.post(reverse("paciente-list"), payload, format="json")
    assert resp.status_code == 201, resp.data
    paciente = Paciente.objects.get(nome_completo="Maria Souza")
    assert paciente.cpf == "52998224725"  # normalizado para dígitos
    assert paciente.criado_por == direcao
    assert paciente.responsaveis.count() == 2
    assert list(paciente.profissionais.all()) == [prof_a]


def test_telefone_e_cep_sao_salvos_sem_mascara(cliente, direcao, prof_a):
    """Telefone e CEP enviados com máscara devem ser gravados só com dígitos."""
    api = cliente(direcao)
    payload = {
        "nome_completo": "Com Máscara",
        "data_nascimento": "2016-03-01",
        "telefone": "(91) 90000-0000",
        "cep": "66000-000",
        "profissionais": [prof_a.id],
        "responsaveis": [
            {"nome": "Ana", "parentesco": "MAE", "telefone": "(91) 98888-7777"},
        ],
    }
    resp = api.post(reverse("paciente-list"), payload, format="json")
    assert resp.status_code == 201, resp.data
    paciente = Paciente.objects.get(nome_completo="Com Máscara")
    assert paciente.telefone == "91900000000"
    assert paciente.cep == "66000000"
    assert paciente.responsaveis.get().telefone == "91988887777"
    # A resposta também devolve os valores já normalizados (front reaplica a máscara).
    assert resp.data["telefone"] == "91900000000"
    assert resp.data["cep"] == "66000000"


def test_cpf_invalido_e_rejeitado(cliente, direcao):
    api = cliente(direcao)
    payload = {
        "nome_completo": "Teste CPF",
        "data_nascimento": "2016-03-01",
        "cpf": "111.111.111-11",
    }
    resp = api.post(reverse("paciente-list"), payload, format="json")
    assert resp.status_code == 400
    assert "cpf" in resp.data


def test_cpf_duplicado_e_rejeitado(cliente, direcao):
    """CPF já cadastrado deve retornar 400 (validação), não 500 (erro de banco)."""
    api = cliente(direcao)
    base = {"nome_completo": "Primeiro", "data_nascimento": "2016-03-01", "cpf": "529.982.247-25"}
    assert api.post(reverse("paciente-list"), base, format="json").status_code == 201
    resp = api.post(
        reverse("paciente-list"),
        {**base, "nome_completo": "Segundo"},
        format="json",
    )
    assert resp.status_code == 400
    assert "cpf" in resp.data


def test_cpf_opcional(cliente, direcao):
    api = cliente(direcao)
    resp = api.post(
        reverse("paciente-list"),
        {"nome_completo": "Sem CPF", "data_nascimento": "2018-01-01"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["cpf"] is None
    assert resp.data["idade"] is not None


def test_update_substitui_responsaveis(cliente, direcao, cria_paciente):
    paciente = cria_paciente()
    paciente.responsaveis.create(nome="Antigo", parentesco="OUTRO")
    api = cliente(direcao)
    resp = api.patch(
        reverse("paciente-detail", args=[paciente.id]),
        {"responsaveis": [{"nome": "Novo", "parentesco": "MAE"}]},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    nomes = list(paciente.responsaveis.values_list("nome", flat=True))
    assert nomes == ["Novo"]


def test_delete_e_logico(cliente, direcao, cria_paciente):
    paciente = cria_paciente()
    api = cliente(direcao)
    resp = api.delete(reverse("paciente-detail", args=[paciente.id]))
    assert resp.status_code == 204
    paciente.refresh_from_db()
    assert paciente.ativo is False
    # Some da listagem padrão (só ativos).
    lista = api.get(reverse("paciente-list"))
    ids = [p["id"] for p in lista.data]
    assert paciente.id not in ids


# --- Controle de acesso por papel -------------------------------------------

def test_profissional_ve_apenas_seus_pacientes(cliente, prof_a, prof_b, cria_paciente):
    meu = cria_paciente(nome="Meu Paciente", profissionais=[prof_a])
    outro = cria_paciente(nome="Outro Paciente", profissionais=[prof_b])
    api = cliente(prof_a)
    lista = api.get(reverse("paciente-list"))
    ids = [p["id"] for p in lista.data]
    assert meu.id in ids
    assert outro.id not in ids
    # E não consegue abrir o detalhe de um paciente que não é seu.
    assert api.get(reverse("paciente-detail", args=[outro.id])).status_code == 404


def test_recepcao_ve_todos(cliente, recepcao, prof_a, cria_paciente):
    cria_paciente(nome="P1", profissionais=[prof_a])
    cria_paciente(nome="P2")
    api = cliente(recepcao)
    lista = api.get(reverse("paciente-list"))
    assert len(lista.data) == 2


def test_financeiro_sem_acesso(cliente, financeiro):
    api = cliente(financeiro)
    assert api.get(reverse("paciente-list")).status_code == 403


def test_anonimo_sem_acesso(api_client):
    assert api_client.get(reverse("paciente-list")).status_code == 401


def test_profissional_que_cria_e_vinculado(cliente, prof_a):
    api = cliente(prof_a)
    resp = api.post(
        reverse("paciente-list"),
        {"nome_completo": "Auto Vínculo", "data_nascimento": "2017-07-07"},
        format="json",
    )
    assert resp.status_code == 201, resp.data
    paciente = Paciente.objects.get(id=resp.data["id"])
    assert prof_a in paciente.profissionais.all()


# --- Documentos / anexos -----------------------------------------------------

def _arquivo_falso(nome="laudo.pdf", conteudo=b"%PDF-1.4 conteudo"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(nome, conteudo, content_type="application/pdf")


def test_upload_documento(cliente, direcao, cria_paciente):
    paciente = cria_paciente()
    api = cliente(direcao)
    resp = api.post(
        reverse("documento-paciente-list"),
        {
            "paciente": paciente.id,
            "arquivo": _arquivo_falso(),
            "tipo": "LAUDO",
            "descricao": "Laudo neuropsicológico",
        },
        format="multipart",
    )
    assert resp.status_code == 201, resp.data
    doc = DocumentoPaciente.objects.get(id=resp.data["id"])
    assert doc.enviado_por == direcao
    assert doc.nome_original == "laudo.pdf"
    assert resp.data["arquivo_url"]


def test_upload_documento_registra_autor_na_auditoria(api_client, direcao, cria_paciente):
    """Anexo criado via API (JWT) deve registrar o autor na trilha, não 'Sistema'."""
    from auditlog.models import LogEntry
    from rest_framework_simplejwt.tokens import AccessToken

    paciente = cria_paciente()
    # Autentica por Bearer token (como o front), exercitando o AuditlogUserMiddleware.
    token = str(AccessToken.for_user(direcao))
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    resp = api_client.post(
        reverse("documento-paciente-list"),
        {"paciente": paciente.id, "arquivo": _arquivo_falso(), "tipo": "LAUDO"},
        format="multipart",
    )
    assert resp.status_code == 201, resp.data

    log = LogEntry.objects.filter(
        content_type__model="documentopaciente",
        object_pk=str(resp.data["id"]),
        action=0,
    ).first()
    assert log is not None
    assert log.actor_id == direcao.id  # e não None ("Sistema")


def test_upload_extensao_invalida(cliente, direcao, cria_paciente):
    paciente = cria_paciente()
    api = cliente(direcao)
    resp = api.post(
        reverse("documento-paciente-list"),
        {"paciente": paciente.id, "arquivo": _arquivo_falso("virus.exe", b"MZ")},
        format="multipart",
    )
    assert resp.status_code == 400


def test_profissional_nao_anexa_em_paciente_alheio(cliente, prof_a, prof_b, cria_paciente):
    alheio = cria_paciente(profissionais=[prof_b])
    api = cliente(prof_a)
    resp = api.post(
        reverse("documento-paciente-list"),
        {"paciente": alheio.id, "arquivo": _arquivo_falso()},
        format="multipart",
    )
    assert resp.status_code == 400  # paciente fora do queryset visível
