"""
Views de autenticação e gestão de usuários.

Endpoints:
  - LoginView            → POST /api/auth/login/            (access + refresh, com log LGPD)
  - TokenRefreshView     → POST /api/auth/refresh/          (renovação do access token)
  - LogoutView           → POST /api/auth/logout/           (blacklist do refresh token)
  - MeView               → GET  /api/auth/me/               (dados do usuário logado)
  - TrocaSenhaView       → POST /api/auth/change-password/  (troca de senha)
  - Reset de senha       → POST /api/auth/password-reset/…  (stub para etapa futura)
  - UsuarioViewSet       → /api/usuarios/                   (CRUD p/ DIREÇÃO e SUPERVISÃO)
"""
import django_filters
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.emails import enviar_convite
from apps.accounts.models import Especialidade, LogAcesso, Papel
from apps.accounts.permissions import IsSupervisao, IsRecepcao
from apps.accounts.serializers import (
    ConviteConfirmarSerializer,
    CustomTokenObtainPairSerializer,
    EspecialidadeSerializer,
    PerfilSerializer,
    ResetSenhaConfirmarSerializer,
    ResetSenhaSolicitarSerializer,
    TrocaSenhaSerializer,
    UsuarioAdminSerializer,
    UsuarioSerializer,
)
from apps.accounts.utils import get_client_ip

Usuario = get_user_model()


class UsuarioFilter(django_filters.FilterSet):
    """
    Filtros do endpoint de usuários.

    - ``role``  : filtra pelo **papel principal** (coluna derivada).
    - ``papel`` : filtra por **qualquer** papel do conjunto (multi-papel). É o que
      a agenda usa para listar quem atende (``?papel=PROFISSIONAL``), pegando
      também quem acumula papéis (ex.: DIREÇÃO+PROFISSIONAL).
    """

    papel = django_filters.CharFilter(field_name="papeis__codigo")

    class Meta:
        model = Usuario
        fields = ["role", "papel", "is_active"]


class LoginView(TokenObtainPairView):
    """
    Autenticação por e-mail e senha (JWT).

    Retorna ``access`` + ``refresh`` e os dados do usuário. Toda tentativa —
    bem-sucedida ou não — é registrada em ``LogAcesso`` (trilha de acesso / LGPD).
    """

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        email = request.data.get("email", "")
        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            self._registrar(request, email, sucesso=False)
            raise
        self._registrar(request, email, sucesso=True)
        return response

    @staticmethod
    def _registrar(request, email, *, sucesso):
        """Cria o registro de acesso associado ao e-mail informado."""
        usuario = Usuario.objects.filter(email=email).first() if sucesso else None
        LogAcesso.objects.create(
            usuario=usuario,
            email_informado=email or "",
            sucesso=sucesso,
            ip=get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )


class LogoutView(APIView):
    """
    Logout: adiciona o refresh token à blacklist, invalidando futuras renovações.

    Espera ``{"refresh": "<token>"}`` no corpo da requisição.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={205: None})
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response(
                {"detail": "O campo 'refresh' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except TokenError:
            return Response(
                {"detail": "Token inválido ou já expirado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    """
    Perfil do usuário autenticado.

    - ``GET``   → dados do usuário (id, nome, e-mail, papel, foto, flags).
    - ``PATCH`` → atualização do próprio perfil (nome e foto de perfil). Aceita
      ``multipart/form-data`` para o upload da imagem.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(responses=UsuarioSerializer)
    def get(self, request):
        return Response(
            UsuarioSerializer(request.user, context={"request": request}).data
        )

    @extend_schema(request=PerfilSerializer, responses=UsuarioSerializer)
    def patch(self, request):
        serializer = PerfilSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UsuarioSerializer(request.user, context={"request": request}).data
        )


class TrocaSenhaView(APIView):
    """Troca de senha do próprio usuário autenticado."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=TrocaSenhaSerializer, responses={200: None})
    def post(self, request):
        serializer = TrocaSenhaSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Senha alterada com sucesso."})


class ResetSenhaSolicitarView(APIView):
    """
    (Stub) Solicita o reset de senha por e-mail.

    Sempre responde 200 para não revelar se o e-mail existe (boa prática de
    segurança). O envio real do e-mail será implementado em etapa futura.
    """

    permission_classes = []
    authentication_classes = []

    @extend_schema(request=ResetSenhaSolicitarSerializer, responses={200: None})
    def post(self, request):
        serializer = ResetSenhaSolicitarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # TODO: gerar token, montar link e enviar e-mail de redefinição.
        return Response(
            {
                "detail": (
                    "Se o e-mail estiver cadastrado, enviaremos instruções de "
                    "redefinição de senha."
                )
            }
        )


class ResetSenhaConfirmarView(APIView):
    """(Stub) Confirma o reset de senha com o token recebido por e-mail."""

    permission_classes = []
    authentication_classes = []

    @extend_schema(request=ResetSenhaConfirmarSerializer, responses={200: None})
    def post(self, request):
        serializer = ResetSenhaConfirmarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # TODO: validar uid/token e aplicar a nova senha.
        return Response(
            {"detail": "Fluxo de confirmação ainda não implementado."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )


class ConviteConfirmarView(APIView):
    """
    Confirma um convite: valida o token, define a senha e ativa a conta.

    Público (o usuário ainda não tem sessão). Espera ``{uid, token, nova_senha}``.
    """

    permission_classes = []
    authentication_classes = []

    @extend_schema(request=ConviteConfirmarSerializer, responses={200: None})
    def post(self, request):
        serializer = ConviteConfirmarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Senha definida com sucesso. Você já pode entrar."})


class UsuarioViewSet(viewsets.ModelViewSet):
    """
    Gestão da equipe (não há signup público; a clínica cadastra seus usuários).

    Permite listar, criar, consultar, atualizar e **desativar** usuários. O acesso
    é restrito aos papéis DIREÇÃO e SUPERVISÃO. A remoção é lógica (``is_active=
    False``) para preservar o histórico e a trilha de acesso (LGPD).

    Criação em dois modos: senha inicial (troca obrigatória no 1º acesso) ou
    convite por e-mail. A ação ``enviar-convite`` (re)envia o convite.
    
    RECEPCAO pode listar usuários (para preencher dropdown de profissionais no
    agendamento) mas não pode criar, atualizar ou deletar.
    """

    queryset = (
        Usuario.objects.all().prefetch_related("especialidades", "papeis").distinct()
    )
    serializer_class = UsuarioAdminSerializer
    permission_classes = [IsSupervisao]
    filterset_class = UsuarioFilter
    search_fields = ["nome", "email"]
    ordering_fields = ["nome", "email", "criado_em"]
    ordering = ["nome"]

    def get_permissions(self):
        """
        RECEPCAO pode listar e recuperar usuários (para agendamentos), mas apenas
        SUPERVISAO/DIRECAO pode criar, atualizar ou deletar.
        """
        if self.action in ["list", "retrieve"]:
            # Permite leitura também a RECEPCAO (necessário para dropdown de profissionais)
            return [IsRecepcao()]
        # Escrita requer SUPERVISAO ou superior
        return [IsSupervisao()]

    def perform_create(self, serializer):
        usuario = serializer.save()
        # Se o cadastro foi no modo convite, dispara o e-mail com o link.
        if getattr(serializer, "_enviar_convite", False):
            enviar_convite(usuario)

    @extend_schema(request=None, responses={200: None})
    @action(detail=True, methods=["post"], url_path="enviar-convite")
    def enviar_convite(self, request, pk=None):
        """(Re)envia o convite de acesso por e-mail ao usuário."""
        usuario = self.get_object()
        enviar_convite(usuario)
        return Response({"detail": f"Convite enviado para {usuario.email}."})

    def perform_update(self, serializer):
        # Impede que o usuário desative a própria conta pela edição.
        instance = serializer.instance
        desativando = serializer.validated_data.get("is_active") is False
        if instance == self.request.user and desativando:
            raise ValidationError("Você não pode desativar a própria conta.")
        serializer.save()

    def perform_destroy(self, instance):
        # Um usuário não pode desativar a própria conta (evita se trancar para fora).
        if instance == self.request.user:
            raise ValidationError("Você não pode desativar a própria conta.")
        # Exclusão lógica: preserva histórico e a trilha de acesso (LGPD).
        instance.is_active = False
        instance.save(update_fields=["is_active", "atualizado_em"])


class EspecialidadeViewSet(viewsets.ModelViewSet):
    """
    Gestão da lista de especialidades dos prestadores (DIREÇÃO e SUPERVISÃO).

    Listar, criar, editar e **desativar** especialidades. A remoção é lógica
    (``ativo=False``) para não quebrar vínculos históricos com profissionais.
    Por padrão a listagem traz apenas as ativas; use ``?ativo=false`` (ou
    ``?todos=1``) para ver as demais.
    """

    serializer_class = EspecialidadeSerializer
    permission_classes = [IsSupervisao]
    filterset_fields = ["ativo"]
    search_fields = ["nome"]
    ordering_fields = ["nome", "criado_em"]
    ordering = ["nome"]

    def get_queryset(self):
        qs = Especialidade.objects.all()
        params = self.request.query_params
        # Sem filtro explícito de ``ativo``/``todos``, mostra só as ativas.
        if "ativo" not in params and "todos" not in params:
            qs = qs.filter(ativo=True)
        return qs

    def perform_destroy(self, instance):
        # Exclusão lógica: preserva os vínculos já existentes com profissionais.
        instance.ativo = False
        instance.save(update_fields=["ativo", "atualizado_em"])
