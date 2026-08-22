"""
Middleware de auditoria que captura o autor mesmo com autenticação JWT do DRF.

O `AuditlogMiddleware` padrão lê `request.user` no **início** do request. Isso
funciona para o Django Admin (sessão, resolvida pelo `AuthenticationMiddleware`),
mas não para a API: o SimpleJWT só autentica **dentro da view** do DRF, então,
naquele momento, `request.user` ainda é anônimo — e o autor da alteração ficava
nulo ("Sistema").

Aqui resolvemos o token JWT no próprio middleware, para carimbar o usuário correto
na trilha de auditoria (`LogEntry.actor`) em qualquer alteração feita via API.
"""
from auditlog.middleware import AuditlogMiddleware
from rest_framework_simplejwt.authentication import JWTAuthentication


class AuditlogUserMiddleware(AuditlogMiddleware):
    """`AuditlogMiddleware` + fallback para o usuário autenticado por JWT."""

    _jwt = JWTAuthentication()

    @staticmethod
    def _get_actor(request):
        # 1) Sessão (Admin) — já resolvida pelo AuthenticationMiddleware.
        user = AuditlogMiddleware._get_actor(request)
        if user is not None:
            return user

        # 2) API — resolve o Bearer token (o DRF só faria isso dentro da view).
        #    Requests sem token, ou com token inválido/expirado, seguem sem autor;
        #    a própria view do DRF responde 401 quando for o caso.
        try:
            resultado = AuditlogUserMiddleware._jwt.authenticate(request)
        except Exception:
            return None
        return resultado[0] if resultado else None
