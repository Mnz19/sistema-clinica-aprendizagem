# Imagem da aplicação (apenas o app; em dev o banco é SQLite, arquivo local).
FROM python:3.11-slim AS base

# Boas práticas para Python em container.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependências de sistema mínimas (psycopg em produção precisa da libpq).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Instala as dependências primeiro para aproveitar o cache de camadas.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copia o código da aplicação.
COPY . .

# Usuário sem privilégios. Pré-cria staticfiles/media já com dono `app`: assim,
# quando o compose monta volumes nomeados vazios nesses caminhos em produção, o
# Docker herda o dono `app` do ponto de montagem da imagem e o collectstatic/upload
# funcionam sem precisar de chown manual no host.
RUN mkdir -p /app/staticfiles /app/media \
    && addgroup --system app && adduser --system --ingroup app app \
    && chown -R app:app /app
USER app

EXPOSE 8000

# Coleta estáticos e sobe o gunicorn usando o settings de produção.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3"]
