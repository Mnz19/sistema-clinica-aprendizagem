"""
Views do módulo de pacientes.

- ``PacienteViewSet``           → /api/pacientes/          (CRUD do cadastro)
- ``DocumentoPacienteViewSet``  → /api/documentos/         (anexos, upload multipart)

Controle de acesso (ver ``permissions.py``): o papel PROFISSIONAL só enxerga os
pacientes aos quais está vinculado; DIREÇÃO, SUPERVISÃO e RECEPÇÃO enxergam todos.
Exclusão de paciente é lógica (``ativo=False``) para preservar histórico (LGPD).
"""
from django.contrib.auth import get_user_model
from rest_framework import generics, viewsets
from rest_framework.parsers import FormParser, MultiPartParser

from apps.accounts.models import Papel
from apps.pacientes.models import DocumentoPaciente, Paciente
from apps.pacientes.permissions import PodeAcessarPacientes
from apps.pacientes.serializers import (
    DocumentoPacienteSerializer,
    PacienteListSerializer,
    PacienteSerializer,
    ProfissionalResumoSerializer,
)

Usuario = get_user_model()


class ProfissionaisDisponiveisView(generics.ListAPIView):
    """
    Lista os profissionais que podem ser vinculados a um paciente.

    Endpoint auxiliar (somente leitura) para preencher o seletor de profissionais
    no cadastro. Disponível a todos os papéis que acessam o módulo de pacientes.
    """

    serializer_class = ProfissionalResumoSerializer
    permission_classes = [PodeAcessarPacientes]
    pagination_class = None
    search_fields = ["nome", "email"]
    ordering = ["nome"]

    def get_queryset(self):
        return Usuario.objects.filter(
            is_active=True,
            papeis__codigo__in=[Papel.PROFISSIONAL, Papel.SUPERVISAO, Papel.DIRECAO],
        ).distinct().order_by("nome")


def _pacientes_visiveis(user):
    """Queryset base de pacientes que o usuário pode acessar, conforme o papel."""
    # Sem usuário autenticado (ex.: geração do schema OpenAPI) → nada visível.
    if not getattr(user, "is_authenticated", False):
        return Paciente.objects.none()
    qs = Paciente.objects.all()
    if getattr(user, "somente_profissional", False):
        qs = qs.filter(profissionais=user)
    return qs


class PacienteViewSet(viewsets.ModelViewSet):
    """
    CRUD do cadastro de pacientes.

    Filtros: ``?ativo=true|false`` (por padrão lista apenas ativos),
    ``?profissionais=<id>``. Busca por ``nome_completo``/``cpf`` via ``?search=``.
    """

    permission_classes = [PodeAcessarPacientes]
    filterset_fields = ["ativo", "profissionais", "estado"]
    search_fields = ["nome_completo", "cpf", "email"]
    ordering_fields = ["nome_completo", "data_nascimento", "criado_em", "atualizado_em"]
    ordering = ["nome_completo"]

    def get_serializer_class(self):
        if self.action == "list":
            return PacienteListSerializer
        return PacienteSerializer

    def get_queryset(self):
        qs = _pacientes_visiveis(self.request.user).prefetch_related(
            "profissionais", "responsaveis", "documentos"
        )
        # Por padrão, listagens mostram só pacientes ativos (a menos que ?ativo=false).
        if self.action == "list" and "ativo" not in self.request.query_params:
            qs = qs.filter(ativo=True)
        return qs.distinct()

    def perform_create(self, serializer):
        paciente = serializer.save(criado_por=self.request.user)
        # Se um profissional cadastra um paciente, vincula-se a ele automaticamente.
        if (
            self.request.user.eh_profissional
            and not paciente.profissionais.exists()
        ):
            paciente.profissionais.add(self.request.user)

    def perform_destroy(self, instance):
        # Exclusão lógica: preserva histórico e cumpre a retenção exigida pela LGPD.
        instance.ativo = False
        instance.save(update_fields=["ativo", "atualizado_em"])


class DocumentoPacienteViewSet(viewsets.ModelViewSet):
    """
    Anexos do cadastro do paciente (upload/download/remoção).

    Upload via ``multipart/form-data`` (campos ``paciente``, ``arquivo``, ``tipo``,
    ``descricao``). O acesso segue as mesmas regras de visibilidade do paciente.
    """

    serializer_class = DocumentoPacienteSerializer
    permission_classes = [PodeAcessarPacientes]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ["paciente", "tipo"]
    ordering = ["-criado_em"]

    def get_queryset(self):
        pacientes = _pacientes_visiveis(self.request.user)
        return DocumentoPaciente.objects.filter(
            paciente__in=pacientes
        ).select_related("paciente", "enviado_por")

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        # Só permite anexar a pacientes que o usuário pode enxergar.
        campo = getattr(serializer, "fields", {}).get("paciente")
        if campo is not None:
            campo.queryset = _pacientes_visiveis(self.request.user)
        return serializer

    def perform_create(self, serializer):
        serializer.save(enviado_por=self.request.user)
