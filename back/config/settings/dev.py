"""
Configurações de desenvolvimento.

Banco padrão: SQLite (arquivo local ``db.sqlite3``), sem necessidade de subir
container de banco. Para usar outro banco em dev, basta definir ``DATABASE_URL``.
"""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env("DEBUG", default=True)

ALLOWED_HOSTS = ["*"]

# Em dev, liberar CORS facilita o desenvolvimento do frontend local.
CORS_ALLOW_ALL_ORIGINS = env("CORS_ALLOW_ALL_ORIGINS", default=True)

# E-mails são apenas impressos no console durante o desenvolvimento.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
