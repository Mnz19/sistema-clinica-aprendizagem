# CLAUDE.md

Este arquivo orienta o Claude Code ao trabalhar neste repositório.

## WHAT

Backend Django do **ERP de uma clínica multiprofissional infantojuvenil** (psicologia,
neuropsicologia, etc.), que vai substituir uma plataforma de terceiros. O público é o
frontend interno da clínica e integrações autenticadas.

Estado atual: **apenas a base do projeto + módulo de autenticação**. Os módulos de
negócio ainda **não existem** e serão adicionados sobre esta fundação, nesta ordem
provável: pacientes → prontuário eletrônico → agenda multiprofissional → salas →
consultas → relatórios de produção → integração WhatsApp (Meta Cloud API) → bot.

## WHY

É um projeto **greenfield**, então a prioridade é manter a fundação limpa e coerente
para crescer. Duas coisas foram decididas cedo e não devem ser "corrigidas" sem
conversa:

- **Custom user model desde a primeira migration** (`accounts.Usuario`, login por
  e-mail, sem username). Trocar o user model depois de haver dados é caríssimo.
- **Papel (`role`) já no modelo**, mas **sem regras finas de permissão ainda**. A
  estrutura base de permissões existe e deve ser reutilizada; não invente regras de
  acesso por papel fora do que os módulos futuros exigirem.

Contexto sensível: dados clínicos infantojuvenis → **LGPD leva a sério**. Já existe
trilha de acesso (`LogAcesso`); ao criar módulos com dado pessoal/sensível, mantenha
esse cuidado.

## HOW

### Stack

- Python 3.11 (Docker) / 3.10+ local
- Django 5.2.1 + djangorestframework 3.16
- djangorestframework-simplejwt 5.5 (JWT + blacklist para logout)
- django-environ 0.12 (configuração por ambiente)
- drf-spectacular 0.28 (OpenAPI em `/api/docs/`)
- django-filter, django-cors-headers, whitenoise, gunicorn
- **Banco:** SQLite em dev (arquivo local) · PostgreSQL em prod
- pytest + pytest-django (a suíte roda em SQLite em memória)

### Comandos

Use o Python do venv (`./venv/bin/python`). Em dev, o `DJANGO_SETTINGS_MODULE`
padrão já é `config.settings.dev` (definido em `manage.py`).

```bash
./venv/bin/python manage.py check
./venv/bin/python manage.py makemigrations
./venv/bin/python manage.py migrate
./venv/bin/python manage.py createsuperuser
./venv/bin/python manage.py runserver
./venv/bin/python manage.py spectacular --file schema.yml   # valida o OpenAPI
./venv/bin/pytest -q                                         # testes
```

Instalação: `pip install -r requirements-dev.txt` (inclui `requirements.txt` + pytest).

### Arquitetura

- `config/settings/{base,dev,prod}.py` — configuração por ambiente. `base` é a fonte
  da verdade; `dev` = SQLite + DEBUG; `prod` = PostgreSQL + hardening de segurança.
- `config/urls.py` — rotas raiz: admin, health, OpenAPI e `include("apps.accounts.urls")`.
- `apps/accounts/` — único app de negócio hoje:
  - `models.py` — `Usuario` (custom user, e-mail, `role`, timestamps) e `LogAcesso`
    (trilha LGPD). `Papel` é um `TextChoices`.
  - `managers.py` — `UsuarioManager` (create_user / create_superuser por e-mail).
  - `permissions.py` — permissões base por papel (`TemPapel`, fábrica `tem_papel(...)`,
    `IsDirecao`, etc.). **Reutilize isto** ao implementar acesso por papel.
  - `serializers.py` / `views.py` / `urls.py` — endpoints de auth e gestão de usuários.
  - `admin.py` — `Usuario` (por e-mail) e `LogAcesso` (somente leitura).
- `apps/auditoria/` — expõe a **trilha de alterações** (django-auditlog) em
  `/api/logs/`, somente leitura, restrita a DIREÇÃO ou `is_superuser`
  (`IsDirecaoOuSuperuser`). Não tem models próprios: a captura é global via
  `AUDITLOG_*` em `config/settings/base.py` (`AUDITLOG_INCLUDE_ALL_MODELS`).

### Endpoints

`/api/auth/`: `login/`, `refresh/`, `verify/`, `logout/` (blacklist), `me/`,
`change-password/`, `password-reset/` e `password-reset/confirm/` (ambos **stubs**).
`/api/usuarios/` (ViewSet **restrito a `DIRECAO`**). Fora de `/api`: `/admin/`,
`/health/`, `/api/docs/`, `/api/redoc/`, `/api/schema/`.

### Convenções não óbvias

- **`AUTH_USER_MODEL = "accounts.Usuario"`**. Login é por `email`; não há `username`,
  `first_name` nem `last_name` (removidos). O nome fica em `Usuario.nome`.
- Papéis são o enum `apps.accounts.models.Papel` (`DIRECAO`, `SUPERVISAO`,
  `PROFISSIONAL`, `RECEPCAO`, `FINANCEIRO`). Não use strings soltas.
- **Não crie signup público.** Usuários são criados por `DIRECAO` (Admin ou
  `/api/usuarios/`). `create_superuser` já define `role=DIRECAO`.
- Escolha do banco vem de `DATABASE_URL` (via `django-environ`): sem ela → SQLite;
  com `postgres://...` → PostgreSQL. Não hardcode engine de banco no código.
- `REST_FRAMEWORK` exige autenticação por padrão (`IsAuthenticated`); rotas públicas
  (login, reset) declaram `permission_classes = []` explicitamente.
- SimpleJWT usa `ROTATE_REFRESH_TOKENS=True` + `BLACKLIST_AFTER_ROTATION=True`; o
  logout depende do app `token_blacklist` (está em `INSTALLED_APPS` e tem migrations).
- Storage de estáticos: `base` usa whitenoise **sem** manifesto (seguro em dev sem
  collectstatic); `prod` sobrescreve para a variante **com** manifesto. Não mova o
  manifesto para o `base`, senão o `runserver` quebra sem collectstatic.
- `TIME_ZONE = "America/Belem"`, `LANGUAGE_CODE = "pt-br"`, `USE_TZ = True`. Respeite
  em lógica e testes de data/hora.
- Comentários, docstrings e nomes de campo em **português** (`nome`, `criado_em`,
  `atualizado_em`). Mantenha esse padrão nos módulos novos.

### LGPD

- Todo login (sucesso e falha) grava um `LogAcesso` (usuário, e-mail informado,
  sucesso, IP, user-agent, data/hora). O registro é feito em `LoginView._registrar`.
- `LogAcesso` no Admin é **somente leitura** (sem add/change). Não crie caminhos para
  editar/apagar logs de acesso.
- Toda alteração de dados (create/update/delete de qualquer model) é registrada
  automaticamente pelo django-auditlog (autor via `AuditlogMiddleware`), consultável em
  `/api/logs/`. O hash de senha e o `last_login` do `Usuario` ficam **fora** do diff
  (`AUDITLOG_INCLUDE_TRACKING_MODELS`). Não registre/edite logs de auditoria à mão.

### O que NÃO fazer agora

- Não criar módulos de paciente, agenda, sala, prontuário, consulta, relatórios ou
  WhatsApp — só quando forem o escopo da tarefa.
- Não implementar regras finas de permissão por papel além do necessário; use a base
  de `permissions.py`.
- Não configurar deploy de produção real (o `prod.py` só deixa o ambiente preparado).

### Operação

- Antes de concluir mudanças, rode `./venv/bin/python manage.py check` e `pytest`.
- Rode os testes ao mexer em auth, serializers, permissões ou no modelo de usuário.
- Ao criar um novo app ou conjunto de rotas, atualize `INSTALLED_APPS`
  (`config/settings/base.py`) e `config/urls.py`.
- Se mexer em modelos, gere e versione as migrations (`makemigrations`) e confira que
  aplicam limpo em SQLite (dev) — o mesmo esquema deve valer para PostgreSQL (prod).
- Ao adicionar variável de ambiente, atualize o `.env.example`.
