"""
Classes de permissão base por papel.

Estrutura reutilizável para as regras finas de acesso que serão implementadas nos
módulos futuros (pacientes, prontuário, agenda, etc.). Nesta fase servem de
fundação: basta declarar os papéis permitidos em uma subclasse ou usar a fábrica
``tem_papel(...)``.
"""
from rest_framework.permissions import BasePermission

from apps.accounts.models import Papel


class IsDirecaoOuSuperuser(BasePermission):
    """
    Acesso restrito à DIREÇÃO da clínica ou ao superusuário técnico do Django.

    Usada na trilha de auditoria (aba "Logs"): apenas quem administra a clínica
    (``role == DIRECAO``) ou o superusuário (``is_superuser``) pode consultar os logs.
    """

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and (usuario.is_superuser or usuario.role == Papel.DIRECAO)
        )


class TemPapel(BasePermission):
    """
    Permite acesso apenas a usuários autenticados cujo ``role`` esteja em
    ``papeis_permitidos``. Subclasses definem a tupla de papéis.
    """

    papeis_permitidos: tuple = ()

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and usuario.role in self.papeis_permitidos
        )


def tem_papel(*papeis):
    """
    Fábrica de classes de permissão a partir de papéis.

    Uso em uma view::

        permission_classes = [tem_papel(Papel.DIRECAO, Papel.SUPERVISAO)]
    """
    return type(
        "PermissaoPapel",
        (TemPapel,),
        {"papeis_permitidos": tuple(papeis)},
    )


class IsDirecao(TemPapel):
    """Acesso restrito ao papel DIREÇÃO (admin da clínica)."""

    papeis_permitidos = (Papel.DIRECAO,)


class IsSupervisao(TemPapel):
    """Acesso restrito aos papéis DIREÇÃO e SUPERVISÃO."""

    papeis_permitidos = (Papel.DIRECAO, Papel.SUPERVISAO)


class IsRecepcao(TemPapel):
    """Acesso restrito aos papéis DIREÇÃO e RECEPÇÃO."""

    papeis_permitidos = (Papel.DIRECAO, Papel.RECEPCAO)


class IsFinanceiro(TemPapel):
    """Acesso restrito aos papéis DIREÇÃO e FINANCEIRO."""

    papeis_permitidos = (Papel.DIRECAO, Papel.FINANCEIRO)
