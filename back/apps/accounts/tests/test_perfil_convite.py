"""Testes de foto de perfil, convite por e-mail e troca obrigatória de senha."""
import io

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.accounts.models import Especialidade, Papel
from apps.accounts.tests.conftest import SENHA_PADRAO

pytestmark = pytest.mark.django_db


def _imagem_png():
    """Gera um PNG mínimo válido em memória (via Pillow)."""
    from PIL import Image
    from django.core.files.uploadedfile import SimpleUploadedFile

    buffer = io.BytesIO()
    Image.new("RGB", (10, 10), "blue").save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile("avatar.png", buffer.read(), content_type="image/png")


# --- Troca obrigatória de senha ---------------------------------------------

def test_senha_inicial_forca_troca(api_client, direcao):
    api_client.force_authenticate(user=direcao)
    resp = api_client.post(
        reverse("usuario-list"),
        {
            "nome": "Nova Recep",
            "email": "nova@clinica.com",
            "role": Papel.RECEPCAO,
            "password": SENHA_PADRAO,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert resp.data["precisa_trocar_senha"] is True


def test_login_retorna_flag_de_troca(api_client, cria_usuario):
    usuario = cria_usuario(email="troca@clinica.com")
    usuario.precisa_trocar_senha = True
    usuario.save(update_fields=["precisa_trocar_senha"])
    resp = api_client.post(
        reverse("auth-login"),
        {"email": "troca@clinica.com", "password": SENHA_PADRAO},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["user"]["precisa_trocar_senha"] is True


def test_trocar_senha_limpa_flag(api_client, cria_usuario):
    usuario = cria_usuario(email="troca2@clinica.com")
    usuario.precisa_trocar_senha = True
    usuario.save(update_fields=["precisa_trocar_senha"])
    api_client.force_authenticate(user=usuario)
    resp = api_client.post(
        reverse("auth-change-password"),
        {"senha_atual": SENHA_PADRAO, "nova_senha": "OutraSenha456!"},
        format="json",
    )
    assert resp.status_code == 200
    usuario.refresh_from_db()
    assert usuario.precisa_trocar_senha is False


def test_reset_de_senha_pela_gestao_forca_troca(api_client, direcao, cria_usuario):
    alvo = cria_usuario(email="alvo@clinica.com")
    api_client.force_authenticate(user=direcao)
    resp = api_client.patch(
        reverse("usuario-detail", args=[alvo.id]),
        {"password": "SenhaNova789!"},
        format="json",
    )
    assert resp.status_code == 200
    alvo.refresh_from_db()
    assert alvo.precisa_trocar_senha is True


# --- Foto de perfil ----------------------------------------------------------

def test_upload_foto_de_perfil(api_client, cria_usuario):
    usuario = cria_usuario(email="foto@clinica.com")
    api_client.force_authenticate(user=usuario)
    resp = api_client.patch(
        reverse("auth-me"), {"foto": _imagem_png()}, format="multipart"
    )
    assert resp.status_code == 200, resp.data
    assert resp.data["foto"]  # URL retornada
    usuario.refresh_from_db()
    assert bool(usuario.foto) is True


def test_upload_arquivo_invalido_como_foto(api_client, cria_usuario):
    from django.core.files.uploadedfile import SimpleUploadedFile

    usuario = cria_usuario(email="foto2@clinica.com")
    api_client.force_authenticate(user=usuario)
    arquivo = SimpleUploadedFile("doc.txt", b"nao sou imagem", content_type="text/plain")
    resp = api_client.patch(reverse("auth-me"), {"foto": arquivo}, format="multipart")
    assert resp.status_code == 400


# --- Convite por e-mail ------------------------------------------------------

def test_criar_com_convite_envia_email(api_client, direcao):
    api_client.force_authenticate(user=direcao)
    esp = Especialidade.objects.get_or_create(nome="Psicólogo Clínico")[0]
    resp = api_client.post(
        reverse("usuario-list"),
        {
            "nome": "Convidado",
            "email": "convidado@clinica.com",
            "role": Papel.PROFISSIONAL,
            "especialidades": [esp.id],
            "enviar_convite": True,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    assert len(mail.outbox) == 1
    assert "convidado@clinica.com" in mail.outbox[0].to


def test_convite_sem_senha_nao_permite_login_ate_confirmar(api_client, direcao):
    api_client.force_authenticate(user=direcao)
    esp = Especialidade.objects.get_or_create(nome="Psicólogo Clínico")[0]
    api_client.post(
        reverse("usuario-list"),
        {
            "nome": "Convidado2",
            "email": "conv2@clinica.com",
            "role": Papel.PROFISSIONAL,
            "especialidades": [esp.id],
            "enviar_convite": True,
        },
        format="json",
    )
    from django.contrib.auth import get_user_model

    Usuario = get_user_model()
    usuario = Usuario.objects.get(email="conv2@clinica.com")
    assert usuario.has_usable_password() is False

    # Confirma o convite (define a senha).
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    api_client.force_authenticate(user=None)
    resp = api_client.post(
        reverse("auth-convite-confirmar"),
        {"uid": uid, "token": token, "nova_senha": "SenhaConvite123!"},
        format="json",
    )
    assert resp.status_code == 200, resp.data

    # Agora consegue logar.
    login = api_client.post(
        reverse("auth-login"),
        {"email": "conv2@clinica.com", "password": "SenhaConvite123!"},
        format="json",
    )
    assert login.status_code == 200


def test_criar_sem_senha_e_sem_convite_falha(api_client, direcao):
    api_client.force_authenticate(user=direcao)
    resp = api_client.post(
        reverse("usuario-list"),
        {"nome": "Sem nada", "email": "semnada@clinica.com", "role": Papel.RECEPCAO},
        format="json",
    )
    assert resp.status_code == 400


def test_convite_token_invalido(api_client):
    resp = api_client.post(
        reverse("auth-convite-confirmar"),
        {"uid": "abc", "token": "xyz", "nova_senha": "SenhaConvite123!"},
        format="json",
    )
    assert resp.status_code == 400


def test_reenviar_convite_action(api_client, direcao, cria_usuario):
    alvo = cria_usuario(email="reenvio@clinica.com")
    api_client.force_authenticate(user=direcao)
    resp = api_client.post(reverse("usuario-enviar-convite", args=[alvo.id]))
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
