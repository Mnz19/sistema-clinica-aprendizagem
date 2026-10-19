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

# E-mails são impressos no console durante o desenvolvimento. Para testar o envio
# real pelo Resend, defina EMAIL_BACKEND=config.email_backend.ResendEmailBackend.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
