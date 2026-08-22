# ---------------------------------------------------------------------------
# Imagem do frontend (SPA React/Vite) servido por Nginx.
#
# Estágio 1: build do bundle com Vite.
# Estágio 2: Nginx enxuto que serve o SPA e faz proxy de /api,/admin,/static,
#            /media para o backend Django (ver docker/nginx.conf).
#
# A URL da API é embutida em build-time como caminho relativo (/api): o mesmo
# Nginx que serve o SPA faz o proxy, então não há CORS e funciona em qualquer
# domínio (dev/prod) sem rebuild por ambiente.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Instala dependências primeiro para aproveitar o cache de camadas.
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do código e gera o build de produção.
COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine

# Config do Nginx interno (SPA + proxy para o backend). O TLS é terminado pelo
# Nginx central da VM; aqui servimos apenas HTTP na porta 80.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Bundle estático gerado pelo Vite.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
