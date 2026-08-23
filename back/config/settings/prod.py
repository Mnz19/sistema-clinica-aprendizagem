"""
Configurações de produção.

Banco: PostgreSQL — defina ``DATABASE_URL=postgres://usuario:senha@host:5432/base``.
Este arquivo apenas prepara o ambiente de produção; o deploy real não faz parte
desta fase do projeto.
"""
from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# Em produção, ALLOWED_HOSTS deve ser explícito (via variável de ambiente).
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# --- Segurança HTTP ----------------------------------------------------------
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 30)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
X_FRAME_OPTIONS = "DENY"

# Em produção, versiona os estáticos com hash (cache busting) — exige collectstatic.
# Só sobrescrevemos o backend de ESTÁTICOS: o de "default" (mídias) vem do base e
# pode ser o disco local OU o S3 (quando USE_S3=True). Redefinir o dict inteiro
# aqui apagaria a escolha do S3 feita no base.
STORAGES["staticfiles"]["BACKEND"] = (
    "whitenoise.storage.CompressedManifestStaticFilesStorage"
)

# E-mail real deve ser configurado por variáveis de ambiente (SMTP).
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="nao-responder@clinica.local")
