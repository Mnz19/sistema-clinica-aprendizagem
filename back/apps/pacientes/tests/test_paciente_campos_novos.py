"""
Testes de T04 — novos campos do Paciente: foto, nome_mae, nome_pai, cadastro_incompleto.
"""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.pacientes.models import Paciente

pytestmark = pytest.mark.django_db


def _imagem_fake(nome="foto.jpg", tamanho_bytes=1024, conteudo=None):
    """Gera um arquivo de imagem mínimo válido (JPEG 1x1 px)."""
    if conteudo is None:
        # JPEG mínimo válido (1×1 pixel branco)
        conteudo = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
            b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
            b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\x1e"
            b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
            b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
            b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd4\xff\xd9"
        )
    buf = io.BytesIO(conteudo)
    buf.seek(0)
    return SimpleUploadedFile(nome, buf.read(), content_type="image/jpeg")


# ---------------------------------------------------------------------------
# Testes de campos nome_mae / nome_pai
# ---------------------------------------------------------------------------

def test_cria_paciente_com_nome_mae_e_pai(cliente, direcao, prof_a):
    """AC PAC-02/Done-when AC3: nome_mae e nome_pai são opcionais e salvos."""
    api = cliente(direcao)
    payload = {
        "nome_completo": "Lucas Oliveira",
        "data_nascimento": "2017-03-10",
        "profissionais": [prof_a.id],
        "nome_mae": "Ana Oliveira",
        "nome_pai": "Carlos Oliveira",
        "responsaveis": [],
    }

    resp = api.post(reverse("paciente-list"), payload, format="json")

    assert resp.status_code == 201, resp.data
    paciente = Paciente.objects.get(id=resp.data["id"])
    assert paciente.nome_mae == "Ana Oliveira"
    assert paciente.nome_pai == "Carlos Oliveira"


def test_get_paciente_retorna_nome_mae_pai_e_foto_url(cliente, direcao, prof_a):
    """AC PAC-02/Done-when AC4: GET retorna nome_mae, nome_pai e foto."""
    paciente = Paciente.objects.create(
        nome_completo="Teste GET",
        data_nascimento="2016-01-01",
        nome_mae="Mãe",
        nome_pai="Pai",
    )

    resp = cliente(direcao).get(reverse("paciente-detail", args=[paciente.id]))

    assert resp.status_code == 200
    assert resp.data["nome_mae"] == "Mãe"
    assert resp.data["nome_pai"] == "Pai"
    assert "foto" in resp.data


# ---------------------------------------------------------------------------
# Testes de cadastro_incompleto
# ---------------------------------------------------------------------------

def test_post_minimo_cria_com_cadastro_incompleto(cliente, direcao):
    """AC SCHED-01/Done-when AC2: nome + data_nascimento → cadastro_incompleto=True."""
    api = cliente(direcao)
    payload = {
        "nome_completo": "Paciente Mínimo",
        "data_nascimento": "2018-06-15",
        "cadastro_incompleto": True,
        "responsaveis": [],
    }

    resp = api.post(reverse("paciente-list"), payload, format="json")

    assert resp.status_code == 201, resp.data
    paciente = Paciente.objects.get(id=resp.data["id"])
    assert paciente.cadastro_incompleto is True


def test_cadastro_incompleto_aparece_no_get(cliente, direcao):
    """AC PAC-02/Done-when AC4: campo cadastro_incompleto presente na resposta."""
    paciente = Paciente.objects.create(
        nome_completo="Incompleto",
        data_nascimento="2019-01-01",
        cadastro_incompleto=True,
    )

    resp = cliente(direcao).get(reverse("paciente-detail", args=[paciente.id]))

    assert resp.status_code == 200
    assert resp.data["cadastro_incompleto"] is True


# ---------------------------------------------------------------------------
# Testes de upload de foto
# ---------------------------------------------------------------------------

def test_upload_foto_valida_retorna_url(cliente, direcao, prof_a):
    """AC PAC-01/Done-when AC1: upload de JPG válido → foto_url não-nula."""
    paciente = Paciente.objects.create(
        nome_completo="Com Foto",
        data_nascimento="2015-05-01",
    )
    foto = _imagem_fake("foto.jpg")

    resp = cliente(direcao).patch(
        reverse("paciente-detail", args=[paciente.id]),
        {"foto": foto},
        format="multipart",
    )

    assert resp.status_code == 200, resp.data
    assert resp.data["foto"] is not None
    assert "pacientes" in resp.data["foto"]


def test_upload_foto_formato_invalido_retorna_400(cliente, direcao):
    """AC PAC-01/Done-when AC2: formato inválido → 400."""
    paciente = Paciente.objects.create(
        nome_completo="Formato Inválido",
        data_nascimento="2015-05-01",
    )
    arquivo_pdf = SimpleUploadedFile("documento.pdf", b"%PDF-content", content_type="application/pdf")

    resp = cliente(direcao).patch(
        reverse("paciente-detail", args=[paciente.id]),
        {"foto": arquivo_pdf},
        format="multipart",
    )

    assert resp.status_code == 400
    assert "foto" in resp.data


def test_upload_foto_tamanho_excedido_retorna_400(cliente, direcao):
    """AC PAC-01/Done-when AC2: arquivo > 5 MB → 400."""
    paciente = Paciente.objects.create(
        nome_completo="Foto Grande",
        data_nascimento="2015-05-01",
    )
    conteudo_grande = b"\xff\xd8" + b"\x00" * (6 * 1024 * 1024)
    foto_grande = SimpleUploadedFile("grande.jpg", conteudo_grande, content_type="image/jpeg")

    resp = cliente(direcao).patch(
        reverse("paciente-detail", args=[paciente.id]),
        {"foto": foto_grande},
        format="multipart",
    )

    assert resp.status_code == 400
    assert "foto" in resp.data
