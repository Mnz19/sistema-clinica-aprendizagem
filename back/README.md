# ERP Clínica — Backend

Backend do sistema de gestão clínica multiprofissional infantojuvenil (psicologia,
neuropsicologia, etc.). Esta fase entrega apenas a **base do projeto + módulo de
autenticação**. Os módulos futuros (pacientes, prontuário, agenda, salas,
consultas, relatórios, WhatsApp/bot) serão construídos sobre esta fundação.

## Stack

- Python 3.11 (imagem Docker) / 3.10+ local
- Django 5.2 + Django REST Framework
- `djangorestframework-simplejwt` (JWT com blacklist)
- `django-environ` (configuração por variáveis de ambiente)
- `drf-spectacular` (OpenAPI/Swagger)
- **Banco:** SQLite em desenvolvimento (arquivo local) · PostgreSQL em produção
- `pytest` + `pytest-django` para testes

O banco é escolhido pela variável `DATABASE_URL`: sem ela, usa-se SQLite; definindo
`DATABASE_URL=postgres://...`, usa-se PostgreSQL — sem alterar código.

## Estrutura

```
erp-backend/
├── config/                 # projeto Django
│   ├── settings/
│   │   ├── base.py         # configuração comum
│   │   ├── dev.py          # desenvolvimento (SQLite, DEBUG)
│   │   └── prod.py         # produção (PostgreSQL, segurança)
│   ├── urls.py             # rotas raiz (admin, docs, health, api)
│   ├── wsgi.py / asgi.py
├── apps/
│   └── accounts/           # usuário customizado + autenticação
│       ├── models.py       # Usuario (login por e-mail, role) + LogAcesso
│       ├── managers.py     # criação de usuário/superusuário
│       ├── permissions.py  # classes de permissão base por papel
│       ├── serializers.py  # login, /me, troca de senha, gestão de usuários
│       ├── views.py        # endpoints de auth e ViewSet de usuários
│       ├── urls.py         # rotas do módulo
│       ├── admin.py        # Django Admin
│       └── tests/          # testes pytest
├── manage.py
├── requirements.txt        # dependências de execução
├── requirements-dev.txt    # + pytest
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Papéis de usuário (`role`)

| Papel          | Descrição                                                  |
|----------------|------------------------------------------------------------|
| `DIRECAO`      | Acesso total (admin da clínica)                            |
| `SUPERVISAO`   | Acesso ampliado a prontuários de todos (futuro)            |
| `PROFISSIONAL` | Acesso apenas aos próprios pacientes/prontuários (futuro)  |
| `RECEPCAO`     | Visão geral da clínica, exceto prontuários (futuro)        |
| `FINANCEIRO`   | Pode visualizar valores de serviços (futuro)               |

Nesta fase o papel apenas existe no modelo e é retornado nos dados do usuário. As
regras finas de permissão serão implementadas nos módulos futuros — a estrutura base
(`apps/accounts/permissions.py`) já está pronta para reutilização.

## Endpoints

Base: `/api/auth/`

| Método | Rota                             | Descrição                                    | Auth |
|--------|----------------------------------|----------------------------------------------|------|
| POST   | `/api/auth/login/`               | Login → `access` + `refresh` + dados do user | não  |
| POST   | `/api/auth/refresh/`             | Renova o `access` token                      | não  |
| POST   | `/api/auth/verify/`              | Valida um token                              | não  |
| POST   | `/api/auth/logout/`              | Blacklist do `refresh` token                 | sim  |
| GET    | `/api/auth/me/`                  | Dados do usuário autenticado                 | sim  |
| POST   | `/api/auth/change-password/`     | Troca de senha (usuário logado)              | sim  |
| POST   | `/api/auth/password-reset/`      | (stub) Solicita reset por e-mail             | não  |
| POST   | `/api/auth/password-reset/confirm/` | (stub) Confirma reset                     | não  |
| —      | `/api/usuarios/`                 | CRUD de usuários (**restrito a `DIRECAO`**)  | sim  |

Outros: `/admin/` (Django Admin), `/health/` (healthcheck), `/api/docs/` (Swagger),
`/api/redoc/`, `/api/schema/`.

Não há cadastro público (signup). A clínica cadastra a equipe pelo Admin ou pelo
endpoint `/api/usuarios/`.

---

## Como rodar

### Opção A — Local (recomendado para dev)

```bash
# 1. Ambiente virtual + dependências
python -m venv venv
source venv/bin/activate            # Windows: .\venv\Scripts\activate
pip install -r requirements-dev.txt

# 2. Variáveis de ambiente
cp .env.example .env                # ajuste SECRET_KEY etc. se quiser

# 3. Migrations (cria o db.sqlite3 local)
python manage.py migrate

# 4. Superusuário (papel DIRECAO por padrão)
python manage.py createsuperuser

# 5. Sobe o servidor
python manage.py runserver
```

Acesse:
- API/Swagger: http://localhost:8000/api/docs/
- Admin: http://localhost:8000/admin/

### Opção B — Docker (apenas a aplicação; banco é SQLite local)

```bash
cp .env.example .env
docker compose up --build
```

O container aplica as migrations e sobe o `runserver` em http://localhost:8000.
Para criar o superusuário:

```bash
docker compose exec web python manage.py createsuperuser
```

> Em produção, defina `DJANGO_SETTINGS_MODULE=config.settings.prod` e
> `DATABASE_URL=postgres://...` no ambiente. O serviço `db` (Postgres) está
> comentado no `docker-compose.yml` como referência.

## Testes

```bash
pytest                 # roda toda a suíte (SQLite em memória)
pytest -v              # detalhado
```

## Exemplo rápido de uso (cURL)

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","password":"suaSenha"}'

# /me (use o access token retornado)
curl http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## LGPD — trilha de acessos

Toda tentativa de login (sucesso ou falha) é registrada no modelo `LogAcesso`
(usuário, e-mail informado, sucesso, IP, user-agent, data/hora), visível no Django
Admin em modo somente leitura. Isso antecipa a exigência de "registro de acessos".
