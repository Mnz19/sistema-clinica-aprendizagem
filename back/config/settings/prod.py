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

# E-mail: em produção sempre pelo Resend (nunca o console). Se a RESEND_API_KEY
# faltar, o envio falha com ImproperlyConfigured em vez de "sumir" no stdout —
# sem derrubar o boot (o collectstatic do build roda sem segredos).
EMAIL_BACKEND = env("EMAIL_BACKEND", default="config.email_backend.ResendEmailBackend")

# --- Logs --------------------------------------------------------------------
# Sem isto, com DEBUG=False o Django manda o traceback dos 500 só para
# mail_admins e ele some. Vai tudo para o stderr do container (docker logs →
# Alloy → Grafana Cloud, monitoramento da VPS). django.request só em ERROR: os
# 4xx já estão no access log do Traefik. A linha começa pela data — o Alloy
# junta o traceback a ela.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "padrao": {"format": "{asctime} {levelname} {name}: {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "padrao"},
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}
