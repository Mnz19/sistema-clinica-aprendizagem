#!/usr/bin/env python
"""Utilitário de linha de comando do Django para tarefas administrativas."""
import os
import sys
from pathlib import Path

# Carrega variáveis do arquivo .env automaticamente, se existir.
try:
    import environ

    env_file = Path(__file__).resolve().parent / ".env"
    if env_file.exists():
        environ.Env.read_env(str(env_file))
except ImportError:
    # django-environ ainda não instalado; segue sem carregar .env.
    pass


def main():
    """Executa tarefas administrativas."""
    # Em desenvolvimento usamos o settings de dev (SQLite) por padrão.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Não foi possível importar o Django. Verifique se ele está instalado "
            "e disponível na variável de ambiente PYTHONPATH. Você esqueceu de "
            "ativar o ambiente virtual?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
