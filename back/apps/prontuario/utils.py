"""Utilitários compartilhados do prontuário."""
from apps.accounts.models import Papel
from apps.pacientes.models import Paciente


def pacientes_visiveis(user):
    """Pacientes cujo prontuário o usuário pode acessar, conforme o papel.

    PROFISSIONAL só enxerga os pacientes vinculados; SUPERVISÃO e DIREÇÃO
    enxergam todos. Usuário não autenticado não enxerga nada (schema).
    """
    if not getattr(user, "is_authenticated", False):
        return Paciente.objects.none()
    qs = Paciente.objects.all()
    if getattr(user, "somente_profissional", False):
        qs = qs.filter(profissionais=user)
    return qs
