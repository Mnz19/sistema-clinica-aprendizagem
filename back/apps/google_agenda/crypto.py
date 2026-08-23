"""
Criptografia dos refresh tokens do Google guardados no banco.

O refresh token é uma credencial de longa duração: com ele é possível gerar
access tokens e acessar o Google Agenda do profissional indefinidamente. Por
isso nunca o guardamos em texto puro — usamos Fernet (AES-128 em modo CBC +
HMAC) com a chave ``GOOGLE_TOKEN_ENCRYPTION_KEY``.

Trocar a chave invalida todos os tokens já guardados (os profissionais precisam
reconectar). Guarde a chave com o mesmo cuidado de um segredo de produção.
"""
from __future__ import annotations

from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken


class ChaveCriptografiaAusente(RuntimeError):
    """A GOOGLE_TOKEN_ENCRYPTION_KEY não está configurada."""


def _fernet() -> Fernet:
    chave = settings.GOOGLE_TOKEN_ENCRYPTION_KEY
    if not chave:
        raise ChaveCriptografiaAusente(
            "GOOGLE_TOKEN_ENCRYPTION_KEY não configurada. Gere uma com "
            "`python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` e defina no .env."
        )
    return Fernet(chave.encode() if isinstance(chave, str) else chave)


def criptografar(valor: str) -> str:
    """Criptografa um segredo (ex.: refresh token) e devolve texto base64."""
    return _fernet().encrypt(valor.encode()).decode()


def descriptografar(token_cifrado: str) -> str:
    """Descriptografa um valor gerado por :func:`criptografar`."""
    try:
        return _fernet().decrypt(token_cifrado.encode()).decode()
    except InvalidToken as exc:  # chave trocada ou dado corrompido
        raise ValueError(
            "Não foi possível descriptografar o token do Google (a chave de "
            "criptografia pode ter mudado). O profissional precisa reconectar."
        ) from exc
