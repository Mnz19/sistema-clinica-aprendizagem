"""Serializers do módulo de pacientes: cadastro, responsáveis e documentos."""
from django.contrib.auth import get_user_model
from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import Papel
from apps.pacientes.models import (
    DocumentoPaciente,
    Paciente,
    Responsavel,
)
from apps.pacientes.validators import apenas_digitos, validar_cpf

Usuario = get_user_model()


class ProfissionalResumoSerializer(serializers.ModelSerializer):
    """Resumo de um profissional para exibição no cadastro do paciente."""

    class Meta:
        model = Usuario
        fields = ["id", "nome", "email", "role"]
        read_only_fields = fields


class ResponsavelSerializer(serializers.ModelSerializer):
    """Responsável legal do paciente (aninhado e editável dentro do paciente)."""

    # Aceita CPF com máscara; a normalização para dígitos ocorre em ``validate_cpf``.
    cpf = serializers.CharField(
        required=False, allow_blank=True, max_length=14
    )

    class Meta:
        model = Responsavel
        fields = [
            "id",
            "nome",
            "parentesco",
            "cpf",
            "telefone",
            "email",
            "principal",
        ]

    def validate_cpf(self, value):
        if not value:
            return ""
        digitos = apenas_digitos(value)
        validar_cpf(digitos)
        return digitos

    def validate_telefone(self, value):
        # Guarda apenas dígitos; a máscara é responsabilidade do front (visual).
        return apenas_digitos(value)


class DocumentoPacienteSerializer(serializers.ModelSerializer):
    """Anexo do cadastro do paciente (leitura + upload)."""

    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    enviado_por_nome = serializers.CharField(
        source="enviado_por.nome", read_only=True, default=None
    )
    arquivo_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_arquivo_url(self, obj):
        request = self.context.get("request")
        if obj.arquivo and hasattr(obj.arquivo, "url"):
            url = obj.arquivo.url
            return request.build_absolute_uri(url) if request else url
        return None

    class Meta:
        model = DocumentoPaciente
        fields = [
            "id",
            "paciente",
            "arquivo",
            "arquivo_url",
            "nome_original",
            "tipo",
            "tipo_display",
            "descricao",
            "enviado_por",
            "enviado_por_nome",
            "criado_em",
        ]
        read_only_fields = [
            "id",
            "nome_original",
            "enviado_por",
            "enviado_por_nome",
            "criado_em",
        ]
        extra_kwargs = {
            "arquivo": {"write_only": True},
            "paciente": {"required": True},
        }

    def create(self, validated_data):
        arquivo = validated_data.get("arquivo")
        if arquivo is not None and not validated_data.get("nome_original"):
            validated_data["nome_original"] = arquivo.name
        return super().create(validated_data)


class PacienteListSerializer(serializers.ModelSerializer):
    """Representação enxuta para listagens de pacientes."""

    idade = serializers.IntegerField(read_only=True)
    profissionais = ProfissionalResumoSerializer(many=True, read_only=True)

    class Meta:
        model = Paciente
        fields = [
            "id",
            "nome_completo",
            "data_nascimento",
            "idade",
            "cpf",
            "telefone",
            "profissionais",
            "ativo",
            "atualizado_em",
        ]
        read_only_fields = fields


class PacienteSerializer(serializers.ModelSerializer):
    """Cadastro completo do paciente (detalhe, criação e edição)."""

    idade = serializers.IntegerField(read_only=True)
    # Aceita CPF com máscara; normalizado para dígitos em ``validate_cpf``.
    cpf = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, max_length=14
    )
    responsaveis = ResponsavelSerializer(many=True, required=False)
    documentos = DocumentoPacienteSerializer(many=True, read_only=True)

    # Escrita por id; leitura detalhada em ``profissionais_detalhe``.
    profissionais = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=Usuario.objects.filter(
            is_active=True,
            papeis__codigo__in=[Papel.PROFISSIONAL, Papel.SUPERVISAO, Papel.DIRECAO],
        ).distinct(),
    )
    profissionais_detalhe = ProfissionalResumoSerializer(
        source="profissionais", many=True, read_only=True
    )

    class Meta:
        model = Paciente
        fields = [
            "id",
            "nome_completo",
            "data_nascimento",
            "idade",
            "cpf",
            "email",
            "telefone",
            "cep",
            "logradouro",
            "numero",
            "complemento",
            "bairro",
            "cidade",
            "estado",
            "escola",
            "serie_escolar",
            "escola_responsavel_nome",
            "escola_responsavel_telefone",
            "nome_mae",
            "nome_pai",
            "foto",
            "cadastro_incompleto",
            "informacoes_complementares",
            "diagnostico",
            "cid",
            "alertas",
            "profissionais",
            "profissionais_detalhe",
            "responsaveis",
            "documentos",
            "ativo",
            "criado_por",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_por", "criado_em", "atualizado_em"]

    def validate_foto(self, value):
        if value is None:
            return value
        max_bytes = 5 * 1024 * 1024
        if value.size > max_bytes:
            raise serializers.ValidationError("A foto não pode exceder 5 MB.")
        import os
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise serializers.ValidationError("Formato inválido. Use JPG, PNG ou WEBP.")
        return value

    def validate_cpf(self, value):
        if not value:
            return None
        digitos = apenas_digitos(value)
        validar_cpf(digitos)
        # O campo ``cpf`` é ``unique`` no modelo, mas ao declararmos o campo
        # manualmente perdemos o ``UniqueValidator`` automático do DRF. Sem esta
        # checagem, um CPF duplicado só falharia no banco (500) em vez de virar
        # um erro de validação (400) com mensagem amigável.
        qs = Paciente.objects.filter(cpf=digitos)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Já existe um paciente cadastrado com este CPF."
            )
        return digitos

    def validate_telefone(self, value):
        # Guarda apenas dígitos; a máscara é responsabilidade do front (visual).
        return apenas_digitos(value)

    def validate_escola_responsavel_telefone(self, value):
        # Guarda apenas dígitos; a máscara é responsabilidade do front (visual).
        return apenas_digitos(value)

    def validate_cep(self, value):
        # Guarda apenas dígitos; a máscara é responsabilidade do front (visual).
        return apenas_digitos(value)

    def _salvar_responsaveis(self, paciente, responsaveis_data):
        """Substitui o conjunto de responsáveis do paciente pelos dados enviados."""
        paciente.responsaveis.all().delete()
        for dados in responsaveis_data:
            Responsavel.objects.create(paciente=paciente, **dados)

    @transaction.atomic
    def create(self, validated_data):
        responsaveis_data = validated_data.pop("responsaveis", [])
        profissionais = validated_data.pop("profissionais", [])
        paciente = Paciente.objects.create(**validated_data)
        if profissionais:
            paciente.profissionais.set(profissionais)
        self._salvar_responsaveis(paciente, responsaveis_data)
        return paciente

    @transaction.atomic
    def update(self, instance, validated_data):
        responsaveis_data = validated_data.pop("responsaveis", None)
        profissionais = validated_data.pop("profissionais", None)

        for campo, valor in validated_data.items():
            setattr(instance, campo, valor)
        instance.save()

        if profissionais is not None:
            instance.profissionais.set(profissionais)
        if responsaveis_data is not None:
            self._salvar_responsaveis(instance, responsaveis_data)
        return instance
