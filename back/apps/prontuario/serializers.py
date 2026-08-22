"""Serializers do prontuário modular."""
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.prontuario.models import (
    Atestado,
    AnexoEntrada,
    CategoriaItemProntuario,
    ComentarioEntrada,
    EntradaProntuario,
    GrupoExames,
    ItemProntuario,
    ModeloAtestado,
    ProtocoloProntuario,
    TextoPadrao,
    TIPOS_CAMPO_COM_OPCOES,
    TipoCampo,
    TipoItem,
)

Usuario = get_user_model()


def validar_formulario_schema(value):
    """Valida a lista de campos de um formulário personalizado.

    Cada campo precisa de ``id``, ``tipo`` válido e ``rotulo``. Campos de
    escolha exigem ``opcoes`` não vazias. Os ``id`` devem ser únicos.
    """
    if value in (None, ""):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError("O schema deve ser uma lista de campos.")

    tipos_validos = set(TipoCampo.values)
    ids_vistos = set()
    for i, campo in enumerate(value):
        if not isinstance(campo, dict):
            raise serializers.ValidationError(f"Campo {i}: formato inválido.")
        campo_id = campo.get("id")
        if not campo_id:
            raise serializers.ValidationError(f"Campo {i}: 'id' é obrigatório.")
        if campo_id in ids_vistos:
            raise serializers.ValidationError(f"Campo '{campo_id}': id duplicado.")
        ids_vistos.add(campo_id)

        tipo = campo.get("tipo")
        if tipo not in tipos_validos:
            raise serializers.ValidationError(
                f"Campo '{campo_id}': tipo '{tipo}' inválido."
            )
        if not campo.get("rotulo"):
            raise serializers.ValidationError(
                f"Campo '{campo_id}': 'rotulo' é obrigatório."
            )
        if tipo in TIPOS_CAMPO_COM_OPCOES:
            opcoes = campo.get("opcoes") or []
            if not isinstance(opcoes, list) or not opcoes:
                raise serializers.ValidationError(
                    f"Campo '{campo_id}': tipos de escolha exigem 'opcoes'."
                )
    return value


# --- Configuração ------------------------------------------------------------


class CategoriaItemProntuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaItemProntuario
        fields = ["id", "profissional", "nome", "ordem", "ativo", "criado_em"]
        read_only_fields = ["id", "criado_em"]


class ItemProntuarioSerializer(serializers.ModelSerializer):
    tipo_item_display = serializers.CharField(
        source="get_tipo_item_display", read_only=True
    )
    categoria_nome = serializers.CharField(
        source="categoria.nome", read_only=True, default=None
    )

    class Meta:
        model = ItemProntuario
        fields = [
            "id",
            "profissional",
            "categoria",
            "categoria_nome",
            "nome",
            "tipo_item",
            "tipo_item_display",
            "chave_fixa",
            "visivel",
            "ordem",
            "ativo",
            "formulario_schema",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "chave_fixa", "criado_em", "atualizado_em"]

    def validate_formulario_schema(self, value):
        return validar_formulario_schema(value)

    def validate(self, attrs):
        tipo = attrs.get("tipo_item", getattr(self.instance, "tipo_item", None))
        schema = attrs.get(
            "formulario_schema", getattr(self.instance, "formulario_schema", [])
        )
        if tipo == TipoItem.FORMULARIO and not schema:
            raise serializers.ValidationError(
                {"formulario_schema": "Formulário precisa de ao menos um campo."}
            )
        return attrs


class TextoPadraoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TextoPadrao
        fields = [
            "id",
            "profissional",
            "titulo",
            "conteudo",
            "item",
            "compartilhado",
            "ordem",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]


class GrupoExamesSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrupoExames
        fields = [
            "id",
            "profissional",
            "nome",
            "exames",
            "ordem",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]


class ModeloAtestadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModeloAtestado
        fields = [
            "id",
            "profissional",
            "nome",
            "titulo",
            "corpo",
            "ordem",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]


class ProtocoloProntuarioSerializer(serializers.ModelSerializer):
    especialidade_nome = serializers.CharField(
        source="especialidade.nome", read_only=True, default=None
    )
    tipo_item_display = serializers.CharField(
        source="get_tipo_item_display", read_only=True
    )

    class Meta:
        model = ProtocoloProntuario
        fields = [
            "id",
            "nome",
            "descricao",
            "especialidade",
            "especialidade_nome",
            "tipo_item",
            "tipo_item_display",
            "formulario_schema",
            "ativo",
        ]
        read_only_fields = fields


# --- Preenchimento -----------------------------------------------------------


class AnexoEntradaSerializer(serializers.ModelSerializer):
    arquivo_url = serializers.SerializerMethodField()
    enviado_por_nome = serializers.CharField(
        source="enviado_por.nome", read_only=True, default=None
    )

    class Meta:
        model = AnexoEntrada
        fields = [
            "id",
            "entrada",
            "arquivo",
            "arquivo_url",
            "nome_original",
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
        extra_kwargs = {"arquivo": {"write_only": True}, "entrada": {"required": True}}

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_arquivo_url(self, obj):
        request = self.context.get("request")
        if obj.arquivo and hasattr(obj.arquivo, "url"):
            return (
                request.build_absolute_uri(obj.arquivo.url)
                if request
                else obj.arquivo.url
            )
        return None

    def create(self, validated_data):
        arquivo = validated_data.get("arquivo")
        if arquivo is not None and not validated_data.get("nome_original"):
            validated_data["nome_original"] = arquivo.name
        return super().create(validated_data)


class EntradaProntuarioSerializer(serializers.ModelSerializer):
    item_nome = serializers.CharField(source="item.nome", read_only=True)
    item_tipo = serializers.CharField(source="item.tipo_item", read_only=True)
    autor_nome = serializers.CharField(source="autor.nome", read_only=True, default=None)
    autor_conselho = serializers.CharField(
        source="autor.conselho", read_only=True, default=""
    )
    autor_papel = serializers.CharField(
        source="autor.get_role_display", read_only=True, default=None
    )
    autor_foto = serializers.SerializerMethodField()
    anexos = AnexoEntradaSerializer(many=True, read_only=True)
    pode_editar = serializers.SerializerMethodField()

    class Meta:
        model = EntradaProntuario
        fields = [
            "id",
            "paciente",
            "item",
            "item_nome",
            "item_tipo",
            "profissional",
            "autor",
            "autor_nome",
            "autor_conselho",
            "autor_papel",
            "autor_foto",
            "agendamento",
            "titulo",
            "conteudo",
            "respostas",
            "schema_snapshot",
            "data_evento",
            "referente_a",
            "anexos",
            "pode_editar",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "id",
            "profissional",
            "autor",
            "autor_nome",
            "autor_conselho",
            "autor_papel",
            "autor_foto",
            "schema_snapshot",
            "anexos",
            "pode_editar",
            "criado_em",
            "atualizado_em",
        ]

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_autor_foto(self, obj):
        request = self.context.get("request")
        if obj.autor and obj.autor.foto:
            url = obj.autor.foto.url
            return request.build_absolute_uri(url) if request else url
        return None

    @extend_schema_field(serializers.BooleanField())
    def get_pode_editar(self, obj):
        request = self.context.get("request")
        return bool(request and obj.autor_id == request.user.id)

    def validate(self, attrs):
        item = attrs.get("item", getattr(self.instance, "item", None))
        if item is None:
            raise serializers.ValidationError({"item": "Item é obrigatório."})
        if item.tipo_item == TipoItem.FORMULARIO:
            respostas = attrs.get("respostas", getattr(self.instance, "respostas", {}))
            if not isinstance(respostas, dict):
                raise serializers.ValidationError(
                    {"respostas": "Respostas devem ser um objeto {campo: valor}."}
                )
            schema = self.instance.schema_snapshot if self.instance else item.formulario_schema
            faltando = [
                c.get("rotulo") or c.get("id")
                for c in (schema or [])
                if c.get("obrigatorio")
                and c.get("tipo") != TipoCampo.SECAO
                and not respostas.get(c.get("id"))
            ]
            if faltando:
                raise serializers.ValidationError(
                    {"respostas": f"Campos obrigatórios: {', '.join(faltando)}."}
                )
        return attrs

    def create(self, validated_data):
        item = validated_data["item"]
        validated_data["profissional"] = item.profissional
        # Congela o schema do formulário no momento do preenchimento.
        if item.tipo_item == TipoItem.FORMULARIO:
            validated_data["schema_snapshot"] = item.formulario_schema
        return super().create(validated_data)


class ComentarioEntradaSerializer(serializers.ModelSerializer):
    """Anotações colaborativas (observação/comentário) de uma entrada."""

    autor_nome = serializers.CharField(source="autor.nome", read_only=True, default=None)
    autor_papel = serializers.CharField(
        source="autor.get_role_display", read_only=True, default=None
    )
    autor_foto = serializers.SerializerMethodField()
    pode_editar = serializers.SerializerMethodField()

    class Meta:
        model = ComentarioEntrada
        fields = [
            "id",
            "entrada",
            "tipo",
            "texto",
            "autor",
            "autor_nome",
            "autor_papel",
            "autor_foto",
            "pode_editar",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "id",
            "autor",
            "autor_nome",
            "autor_papel",
            "autor_foto",
            "pode_editar",
            "criado_em",
            "atualizado_em",
        ]
        extra_kwargs = {"entrada": {"required": True}}

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_autor_foto(self, obj):
        request = self.context.get("request")
        if obj.autor and obj.autor.foto:
            url = obj.autor.foto.url
            return request.build_absolute_uri(url) if request else url
        return None

    @extend_schema_field(serializers.BooleanField())
    def get_pode_editar(self, obj):
        request = self.context.get("request")
        return bool(request and obj.autor_id == request.user.id)

    def validate_texto(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("O texto não pode ficar em branco.")
        return value


# --- Ações -------------------------------------------------------------------


class CIDSerializer(serializers.Serializer):
    codigo = serializers.CharField(required=False, allow_blank=True)
    descricao = serializers.CharField(required=False, allow_blank=True)


class GerarAtestadoSerializer(serializers.Serializer):
    """Entrada da ação de geração de atestado."""

    paciente = serializers.IntegerField()
    modelo = serializers.IntegerField()
    agendamento = serializers.IntegerField(required=False, allow_null=True)
    cids = CIDSerializer(many=True, required=False)


class AtestadoSerializer(serializers.ModelSerializer):
    profissional_nome = serializers.CharField(
        source="profissional.nome", read_only=True, default=None
    )
    profissional_conselho = serializers.CharField(
        source="profissional.conselho", read_only=True, default=""
    )
    paciente_nome = serializers.CharField(
        source="paciente.nome_completo", read_only=True, default=None
    )

    class Meta:
        model = Atestado
        fields = [
            "id",
            "paciente",
            "paciente_nome",
            "modelo",
            "profissional",
            "profissional_nome",
            "profissional_conselho",
            "autor",
            "agendamento",
            "titulo",
            "corpo_resolvido",
            "cids",
            "emitido_em",
            "criado_em",
        ]
        read_only_fields = fields


class ReplicarConfigSerializer(serializers.Serializer):
    """Entrada da ação de replicação de configuração entre profissionais."""

    origem = serializers.IntegerField()
    destino = serializers.IntegerField()
    incluir = serializers.ListField(
        child=serializers.ChoiceField(
            choices=["itens", "textos", "atestados", "grupos"]
        ),
        allow_empty=False,
    )

    def validate(self, attrs):
        if attrs["origem"] == attrs["destino"]:
            raise serializers.ValidationError(
                "Profissional origem e destino devem ser diferentes."
            )
        return attrs


class ImportarProtocoloSerializer(serializers.Serializer):
    """Entrada da ação de importação de um protocolo pronto."""

    profissional = serializers.IntegerField()
    categoria = serializers.IntegerField(required=False, allow_null=True)
