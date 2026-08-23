"""Serializers do app de contas: autenticação, /me, troca de senha e gestão de usuários."""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import Especialidade, Papel
from apps.accounts.validators import apenas_digitos, validar_cpf

Usuario = get_user_model()


def _foto_url(obj, context):
    """URL absoluta da foto de perfil (ou ``None``)."""
    if not obj.foto:
        return None
    request = context.get("request")
    return request.build_absolute_uri(obj.foto.url) if request else obj.foto.url


class EspecialidadeSerializer(serializers.ModelSerializer):
    """Especialidade de prestador (lista gerenciável pela clínica)."""

    class Meta:
        model = Especialidade
        fields = ["id", "nome", "ativo", "criado_em", "atualizado_em"]
        read_only_fields = ["id", "criado_em", "atualizado_em"]


# Campos do cadastro completo do prestador, compartilhados entre leitura e escrita.
CAMPOS_CADASTRO = [
    "cpf",
    "rg",
    "rg_orgao_emissor",
    "data_nascimento",
    "sexo",
    "telefone",
    "celular",
    "conselho_tipo",
    "conselho_uf",
    "conselho_numero",
    "conselho",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
]


class UsuarioSerializer(serializers.ModelSerializer):
    """Representação de leitura dos dados do usuário (usado em /me e nas listagens)."""

    foto = serializers.SerializerMethodField()
    conselho = serializers.CharField(read_only=True)
    papeis = serializers.SerializerMethodField()
    # Mesma forma do serializer de escrita: ids + detalhe (mantém o tipo do front único).
    especialidades = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    especialidades_detalhe = EspecialidadeSerializer(
        source="especialidades", many=True, read_only=True
    )

    class Meta:
        model = Usuario
        fields = [
            "id",
            "nome",
            "email",
            "role",
            "papeis",
            "foto",
            *CAMPOS_CADASTRO,
            "especialidades",
            "especialidades_detalhe",
            "is_active",
            "is_staff",
            "is_superuser",
            "precisa_trocar_senha",
            "last_login",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_foto(self, obj):
        return _foto_url(obj, self.context)

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_papeis(self, obj):
        return sorted(obj.papeis_codigos)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer de login JWT.

    Além dos tokens ``access``/``refresh``, injeta o papel no token e devolve os
    dados básicos do usuário no corpo da resposta.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Claims customizadas embutidas no token de acesso.
        token["role"] = user.role
        token["nome"] = user.nome
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UsuarioSerializer(self.user, context=self.context).data
        return data


class TrocaSenhaSerializer(serializers.Serializer):
    """Troca de senha do próprio usuário autenticado."""

    senha_atual = serializers.CharField(write_only=True)
    nova_senha = serializers.CharField(write_only=True)

    def validate_senha_atual(self, value):
        usuario = self.context["request"].user
        if not usuario.check_password(value):
            raise serializers.ValidationError("A senha atual está incorreta.")
        return value

    def validate_nova_senha(self, value):
        usuario = self.context["request"].user
        validate_password(value, user=usuario)
        return value

    def save(self, **kwargs):
        usuario = self.context["request"].user
        usuario.set_password(self.validated_data["nova_senha"])
        # Ao trocar a senha, a obrigatoriedade (1º acesso) deixa de valer.
        usuario.precisa_trocar_senha = False
        usuario.save(
            update_fields=["password", "precisa_trocar_senha", "atualizado_em"]
        )
        return usuario


class UsuarioAdminSerializer(serializers.ModelSerializer):
    """
    Serializer de criação/edição de usuários (DIREÇÃO/SUPERVISÃO; sem signup público).

    Dois modos de criação:
      - **senha inicial**: define ``password`` → o usuário é obrigado a trocá-la no
        primeiro acesso (``precisa_trocar_senha=True``).
      - **convite**: ``enviar_convite=True`` (sem senha) → cria a conta sem senha
        utilizável e a view dispara o e-mail de convite para o usuário definir a
        própria senha.

    A senha é somente de escrita e sempre aplicada com o hasher do Django.
    """

    password = serializers.CharField(
        write_only=True,
        required=False,
        style={"input_type": "password"},
        help_text="Senha inicial. Obrigatória na criação, exceto no modo convite.",
    )
    enviar_convite = serializers.BooleanField(
        write_only=True,
        required=False,
        default=False,
        help_text="Se verdadeiro, cria sem senha e envia convite por e-mail.",
    )
    role = serializers.ChoiceField(choices=Papel.choices, default=Papel.PROFISSIONAL)
    papeis = serializers.ListField(
        child=serializers.ChoiceField(choices=Papel.choices),
        required=False,
        write_only=True,
        help_text="Papéis do usuário (um ou mais). Se omitido, usa o 'role'.",
    )
    foto = serializers.SerializerMethodField()
    conselho = serializers.CharField(read_only=True)
    # Aceita CPF com máscara; a normalização para dígitos ocorre em ``validate_cpf``.
    cpf = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=14
    )
    # Especialidades por id na escrita; leitura detalhada em ``especialidades_detalhe``.
    especialidades = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Especialidade.objects.all()
    )
    especialidades_detalhe = EspecialidadeSerializer(
        source="especialidades", many=True, read_only=True
    )

    class Meta:
        model = Usuario
        fields = [
            "id",
            "nome",
            "email",
            "role",
            "papeis",
            "foto",
            *CAMPOS_CADASTRO,
            "especialidades",
            "especialidades_detalhe",
            "is_active",
            "is_staff",
            "precisa_trocar_senha",
            "password",
            "enviar_convite",
            "last_login",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "id",
            "foto",
            "conselho",
            "especialidades_detalhe",
            "precisa_trocar_senha",
            "last_login",
            "criado_em",
            "atualizado_em",
        ]

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_foto(self, obj):
        return _foto_url(obj, self.context)

    def to_representation(self, instance):
        # ``papeis`` é write_only (ListField); injeta a leitura como lista de códigos.
        data = super().to_representation(instance)
        data["papeis"] = sorted(instance.papeis_codigos)
        return data

    def _aplicar_papeis(self, usuario, papeis):
        """Define o conjunto de papéis (o signal sincroniza o ``role`` principal)."""
        from apps.accounts.models import PapelUsuario

        codigos = set(papeis) if papeis else {usuario.role}
        objs = [
            PapelUsuario.objects.get_or_create(codigo=c)[0] for c in codigos
        ]
        usuario.papeis.set(objs)

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_cpf(self, value):
        # Guarda apenas dígitos; vazio vira NULL (o CPF é único e opcional).
        if not value:
            return None
        digitos = apenas_digitos(value)
        validar_cpf(digitos)
        return digitos

    def validate_telefone(self, value):
        return apenas_digitos(value)

    def validate_celular(self, value):
        return apenas_digitos(value)

    def validate_cep(self, value):
        return apenas_digitos(value)

    def validate(self, attrs):
        # Na criação, exige senha inicial OU convite (um dos dois).
        if self.instance is None:
            convite = attrs.get("enviar_convite", False)
            senha = attrs.get("password")
            if not convite and not senha:
                raise serializers.ValidationError(
                    {"password": "Informe uma senha inicial ou marque o envio de convite."}
                )
            if convite and senha:
                raise serializers.ValidationError(
                    {"password": "No modo convite não se define senha manualmente."}
                )

        # Papéis não podem vir vazios quando informados explicitamente.
        if "papeis" in attrs and not attrs["papeis"]:
            raise serializers.ValidationError(
                {"papeis": "Selecione ao menos um papel."}
            )

        # Profissional precisa ter ao menos uma especialidade. Só cobramos na
        # criação ou quando as especialidades são alteradas — não bloqueia a
        # edição de outros campos de um profissional legado que ainda não a tem.
        # Multi-papel: vale se PROFISSIONAL estiver entre os papéis aplicados.
        if "papeis" in attrs:
            papeis_aplicados = set(attrs["papeis"])
        elif self.instance is not None:
            papeis_aplicados = self.instance.papeis_codigos
        else:
            papeis_aplicados = {attrs.get("role", Papel.PROFISSIONAL)}
        if Papel.PROFISSIONAL in papeis_aplicados:
            if "especialidades" in attrs and not attrs["especialidades"]:
                raise serializers.ValidationError(
                    {"especialidades": "Selecione ao menos uma especialidade para o profissional."}
                )
            if self.instance is None and "especialidades" not in attrs:
                raise serializers.ValidationError(
                    {"especialidades": "Selecione ao menos uma especialidade para o profissional."}
                )
        return attrs

    def create(self, validated_data):
        senha = validated_data.pop("password", None)
        convite = validated_data.pop("enviar_convite", False)
        especialidades = validated_data.pop("especialidades", None)
        papeis = validated_data.pop("papeis", None)

        usuario = Usuario(**validated_data)
        if convite:
            # Conta sem senha utilizável; o convite permitirá defini-la.
            usuario.set_unusable_password()
            usuario.precisa_trocar_senha = False
        else:
            usuario.set_password(senha)
            usuario.precisa_trocar_senha = True  # troca obrigatória no 1º acesso
        usuario.save()
        # Define os papéis (o signal deriva o ``role`` principal do conjunto).
        self._aplicar_papeis(usuario, papeis)
        if especialidades is not None:
            usuario.especialidades.set(especialidades)

        # Sinaliza para a view enviar o e-mail (mantém o I/O fora do serializer).
        self._enviar_convite = convite
        return usuario

    def update(self, instance, validated_data):
        validated_data.pop("enviar_convite", None)
        senha = validated_data.pop("password", None)
        especialidades = validated_data.pop("especialidades", None)
        papeis = validated_data.pop("papeis", None)
        for campo, valor in validated_data.items():
            setattr(instance, campo, valor)
        if senha:
            # Reset de senha pela gestão → força troca no próximo acesso.
            instance.set_password(senha)
            instance.precisa_trocar_senha = True
        instance.save()
        # Só mexe nos papéis quando enviados; o signal ressincroniza o ``role``.
        if papeis is not None:
            self._aplicar_papeis(instance, papeis)
        elif "role" in validated_data:
            # Edição legada apenas com ``role``: reflete no conjunto (coerência).
            self._aplicar_papeis(instance, [validated_data["role"]])
        if especialidades is not None:
            instance.especialidades.set(especialidades)
        return instance


class ResetSenhaSolicitarSerializer(serializers.Serializer):
    """
    (Stub) Solicitação de reset de senha por e-mail.

    Base para o fluxo futuro: recebe o e-mail e, se existir, dispara o envio do
    link de redefinição. A implementação completa (geração de token, template de
    e-mail e endpoint de confirmação) fica para uma próxima etapa.
    """

    email = serializers.EmailField()


class ResetSenhaConfirmarSerializer(serializers.Serializer):
    """(Stub) Confirmação de reset de senha com token recebido por e-mail."""

    uid = serializers.CharField()
    token = serializers.CharField()
    nova_senha = serializers.CharField(write_only=True)

    def validate_nova_senha(self, value):
        validate_password(value)
        return value


class PerfilSerializer(serializers.ModelSerializer):
    """Atualização do próprio perfil pelo usuário autenticado (nome, foto e conselho)."""

    conselho = serializers.CharField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            "nome",
            "foto",
            "conselho_tipo",
            "conselho_uf",
            "conselho_numero",
            "conselho",
        ]

    def validate_foto(self, value):
        from django.core.exceptions import ValidationError as DjangoValidationError

        from apps.accounts.validators import validar_imagem

        if value:
            try:
                validar_imagem(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.messages)
        return value


class ConviteConfirmarSerializer(serializers.Serializer):
    """Confirma o convite: valida uid/token e define a senha, ativando a conta."""

    uid = serializers.CharField()
    token = serializers.CharField()
    nova_senha = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            pk = force_str(urlsafe_base64_decode(attrs["uid"]))
            usuario = Usuario.objects.get(pk=pk)
        except (Usuario.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError("Convite inválido ou expirado.")

        if not default_token_generator.check_token(usuario, attrs["token"]):
            raise serializers.ValidationError("Convite inválido ou expirado.")

        validate_password(attrs["nova_senha"], user=usuario)
        attrs["usuario"] = usuario
        return attrs

    def save(self, **kwargs):
        usuario = self.validated_data["usuario"]
        usuario.set_password(self.validated_data["nova_senha"])
        usuario.precisa_trocar_senha = False
        usuario.is_active = True
        usuario.save(
            update_fields=[
                "password",
                "precisa_trocar_senha",
                "is_active",
                "atualizado_em",
            ]
        )
        return usuario
