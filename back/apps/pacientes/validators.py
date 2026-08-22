"""
Validadores do módulo de pacientes.

- ``validar_cpf``     : valida um CPF (11 dígitos + dígitos verificadores).
- ``validar_arquivo`` : limita tamanho e extensões dos anexos.
"""
import re

from django.core.exceptions import ValidationError

# Extensões aceitas para anexos (documentos, laudos, relatórios, imagens).
EXTENSOES_PERMITIDAS = {
    ".pdf", ".doc", ".docx", ".odt", ".txt", ".rtf",
    ".jpg", ".jpeg", ".png", ".webp", ".heic",
    ".xls", ".xlsx", ".csv",
}

# Tamanho máximo por arquivo (25 MB).
TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024


def apenas_digitos(valor: str) -> str:
    """Remove tudo que não é dígito de uma string."""
    return re.sub(r"\D", "", valor or "")


def validar_cpf(valor: str) -> None:
    """
    Valida um CPF brasileiro.

    Aceita com ou sem máscara (``000.000.000-00``). Levanta ``ValidationError``
    quando o CPF é inválido. Campos vazios devem ser tratados antes (o CPF é
    opcional para pacientes infantojuvenis).
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


def validar_arquivo(arquivo) -> None:
    """Valida tamanho e extensão de um anexo enviado."""
    import os

    if arquivo.size > TAMANHO_MAXIMO_BYTES:
        raise ValidationError("O arquivo excede o tamanho máximo de 25 MB.")

    ext = os.path.splitext(arquivo.name)[1].lower()
    if ext not in EXTENSOES_PERMITIDAS:
        permitidas = ", ".join(sorted(EXTENSOES_PERMITIDAS))
        raise ValidationError(f"Extensão não permitida. Use: {permitidas}.")
