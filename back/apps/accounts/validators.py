"""Validadores do app de contas."""
import os
import re

from django.core.exceptions import ValidationError

EXTENSOES_IMAGEM = {".jpg", ".jpeg", ".png", ".webp"}
TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024  # 5 MB


def apenas_digitos(valor: str) -> str:
    """Remove tudo que não é dígito de uma string."""
    return re.sub(r"\D", "", valor or "")


def validar_cpf(valor: str) -> None:
    """
    Valida um CPF brasileiro (11 dígitos + dígitos verificadores).

    Aceita com ou sem máscara (``000.000.000-00``). Levanta ``ValidationError``
    quando inválido. O CPF do prestador é opcional; campos vazios devem ser
    tratados antes de chamar este validador.

    Duplica intencionalmente ``apps.pacientes.validators.validar_cpf``: ``accounts``
    é o app-base e não deve depender de ``pacientes`` (que já importa ``accounts``).
    """
    cpf = apenas_digitos(valor)

    if len(cpf) != 11:
        raise ValidationError("CPF deve conter 11 dígitos.")

    if cpf == cpf[0] * 11:
        raise ValidationError("CPF inválido.")

    def _digito(parcial: str) -> str:
        peso = len(parcial) + 1
        soma = sum(int(d) * (peso - i) for i, d in enumerate(parcial))
        resto = (soma * 10) % 11
        return "0" if resto == 10 else str(resto)

    if _digito(cpf[:9]) != cpf[9] or _digito(cpf[:10]) != cpf[10]:
        raise ValidationError("CPF inválido.")


def validar_imagem(arquivo) -> None:
    """Valida tamanho e extensão de uma imagem de perfil (avatar)."""
    if arquivo.size > TAMANHO_MAXIMO_IMAGEM:
        raise ValidationError("A imagem excede o tamanho máximo de 5 MB.")

    ext = os.path.splitext(arquivo.name)[1].lower()
    if ext not in EXTENSOES_IMAGEM:
        permitidas = ", ".join(sorted(EXTENSOES_IMAGEM))
        raise ValidationError(f"Formato não permitido. Use: {permitidas}.")
