"""
Configurações base do projeto (comuns a todos os ambientes).

A escolha do banco de dados vem da variável de ambiente ``DATABASE_URL``:
  - Desenvolvimento → SQLite (arquivo local, valor padrão)
  - Produção        → PostgreSQL (definir DATABASE_URL=postgres://...)

Segredos e parâmetros sensíveis são lidos de variáveis de ambiente (arquivo
``.env`` em dev). Nunca faça commit do ``.env`` — use o ``.env.example`` como base.
"""
from datetime import timedelta
from pathlib import Path

import environ

# Raiz do projeto (…/erp-backend)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# --- Leitura de variáveis de ambiente ---------------------------------------
env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOW_ALL_ORIGINS=(bool, False),
    CORS_ALLOWED_ORIGINS=(list, []),
    CSRF_TRUSTED_ORIGINS=(list, []),
)

# Carrega o .env se ele existir (em dev). Em produção as variáveis vêm do ambiente.
env_file = BASE_DIR / ".env"
if env_file.exists():
    env.read_env(str(env_file))

SECRET_KEY = env(
    "SECRET_KEY",
    default="django-insecure-troque-esta-chave-em-producao-0123456789abcdef",
)
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# --- Aplicações --------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "auditlog",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.pacientes",
    "apps.auditoria",
    "apps.clinica.apps.ClinicaConfig",
    "apps.prontuario",
    "apps.whatsapp",
    "apps.financeiro",
    "apps.fila_espera",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Carimba o autor nas mudanças capturadas pelo auditlog. Precisa vir DEPOIS do
    # AuthenticationMiddleware. Versão própria: resolve também o usuário via JWT
    # (o AuditlogMiddleware padrão só enxerga sessão e perderia o autor na API).
    "apps.auditoria.middleware.AuditlogUserMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Banco de dados ----------------------------------------------------------
# Padrão: SQLite (arquivo local). Em produção, defina DATABASE_URL para o Postgres.
DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    ),
}

# O SQLite (dev) serializa escritas e estoura "database is locked" sob requisições
# concorrentes — ex.: o frontend salvando a grade de disponibilidades em lote.
# WAL melhora a concorrência leitura/escrita; ``timeout`` faz a conexão aguardar o
# lock em vez de falhar na hora; e ``transaction_mode=IMMEDIATE`` adquire o lock de
# escrita no início da transação, evitando o deadlock de upgrade entre escritores.
# Nada disso se aplica ao PostgreSQL (prod).
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    _sqlite_options = DATABASES["default"].setdefault("OPTIONS", {})
    _sqlite_options.setdefault("timeout", 20)
    _sqlite_options.setdefault("transaction_mode", "IMMEDIATE")
    _sqlite_options.setdefault(
        "init_command",
        "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
    )

# --- Autenticação ------------------------------------------------------------
AUTH_USER_MODEL = "accounts.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Internacionalização -----------------------------------------------------
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Belem"
USE_I18N = True
USE_TZ = True

# --- Arquivos estáticos e de mídia -------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Sem manifesto no base: seguro em dev sem precisar rodar collectstatic.
    # Em produção usamos a variante com manifesto (ver config/settings/prod.py).
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Mídias no Amazon S3 (opcional) ------------------------------------------
# Por padrão (USE_S3=False) as mídias vão para o disco local (MEDIA_ROOT) — ideal
# em dev. Com USE_S3=True, o storage "default" passa a ser o Amazon S3.
#
# IMPORTANTE (LGPD): os arquivos são clínicos e infantojuvenis. O bucket DEVE ser
# PRIVADO. Mantemos AWS_QUERYSTRING_AUTH=True, então cada `.url` gera uma URL
# ASSINADA e temporária (presigned) — ninguém acessa o objeto sem passar pela API.
# Os serializers já usam `obj.arquivo.url` / `obj.foto.url`, então nada muda no
# código de serving: com S3 privado eles passam a devolver a URL assinada.
USE_S3 = env.bool("USE_S3", default=False)
if USE_S3:
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME", default="sa-east-1")
    # Credenciais: em EC2/ECS o ideal é usar IAM Role (deixe em branco e o boto3
    # descobre sozinho). Fora da AWS, informe as chaves do usuário IAM.
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID", default=None)
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY", default=None)

    # Bucket privado + URLs assinadas (não deixe público!).
    AWS_DEFAULT_ACL = None          # herda a policy do bucket (bucket owner enforced)
    AWS_QUERYSTRING_AUTH = True     # gera URL assinada em cada `.url`
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_QUERYSTRING_EXPIRE = env.int(
        "AWS_QUERYSTRING_EXPIRE", default=3600
    )  # validade da URL assinada, em segundos (1h)
    AWS_S3_FILE_OVERWRITE = False   # nunca sobrescreve; anexa sufixo se colidir
    AWS_S3_ADDRESSING_STYLE = "virtual"
    # Domínio customizado opcional (ex.: CloudFront). Deixe em branco para usar o
    # endpoint padrão do S3.
    _s3_domain = env("AWS_S3_CUSTOM_DOMAIN", default="")
    if _s3_domain:
        AWS_S3_CUSTOM_DOMAIN = _s3_domain

    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage"},
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Django REST Framework ---------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "user": env("THROTTLE_USER", default="10000/day"),
        "anon": env("THROTTLE_ANON", default="100/hour"),
    },
}

# --- SimpleJWT ---------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env.int("JWT_ACCESS_MINUTES", default=60)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# --- CORS / CSRF -------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = env("CORS_ALLOW_ALL_ORIGINS")
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")

# --- E-mail ------------------------------------------------------------------
# Em dev, o padrão imprime o e-mail no console (sem SMTP). Em produção, defina
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend e as credenciais.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL",
    default="Clínica da Aprendizagem <nao-responder@clinicadaaprendizagem.com>",
)

# URL base do frontend, usada em links de e-mail (convite, redefinição de senha).
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")

# --- Clínica (identidade) ----------------------------------------------------
# Nome exibido no cabeçalho de impressões e resolvido no macro [NOME_UNIDADE]
# dos atestados. Ajuste por ambiente via variável CLINICA_NOME.
CLINICA_NOME = env("CLINICA_NOME", default="Fontes Comportamentais")

# --- WhatsApp (Meta Cloud API) ----------------------------------------------
# Sem token/phone id, o envio roda em modo simulado (registra a mensagem no log).
# Em produção, defina as credenciais da sua conta WhatsApp Business.
WHATSAPP_TOKEN = env("WHATSAPP_TOKEN", default="")
WHATSAPP_PHONE_NUMBER_ID = env("WHATSAPP_PHONE_NUMBER_ID", default="")
WHATSAPP_API_VERSION = env("WHATSAPP_API_VERSION", default="v21.0")
# Token de verificação do webhook (você define o mesmo valor no painel da Meta).
WHATSAPP_VERIFY_TOKEN = env("WHATSAPP_VERIFY_TOKEN", default="")

# --- OpenAPI (drf-spectacular) ----------------------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "ERP Clínica — API",
    "DESCRIPTION": (
        "Backend do sistema de gestão clínica multiprofissional infantojuvenil. "
        "Nesta fase, apenas o módulo de autenticação está disponível."
    ),
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api",
    "COMPONENT_SPLIT_REQUEST": True,
}

# --- Auditoria (django-auditlog) ---------------------------------------------
# Registra automaticamente create/update/delete de TODOS os models, guardando o
# diff campo-a-campo e o autor da mudança. É a fonte da aba "Logs" (LGPD).
AUDITLOG_INCLUDE_ALL_MODELS = True
# Tabelas internas/ruidosas que não interessam à auditoria de negócio.
AUDITLOG_EXCLUDE_TRACKING_MODELS = (
    "admin.logentry",
    "sessions.session",
    "contenttypes.contenttype",
    "auth.permission",
    "auth.group",
    "token_blacklist.outstandingtoken",
    "token_blacklist.blacklistedtoken",
    "accounts.logacesso",  # já é trilha própria (acessos); evita ruído
    "auditlog.logentry",
)
# Override por model: nunca registra o hash de senha (segurança) nem o last_login
# (ruído a cada acesso — já coberto pela trilha LogAcesso).
AUDITLOG_INCLUDE_TRACKING_MODELS = (
    {"model": "accounts.usuario", "exclude_fields": ["password", "last_login"]},
)
