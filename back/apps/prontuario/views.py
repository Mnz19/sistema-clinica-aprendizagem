"""
Views do prontuário modular.

Configuração (DIREÇÃO): categorias, itens, textos padrão, grupos de exames,
modelos de atestado, replicação e importação de protocolos.

Preenchimento (DIREÇÃO/SUPERVISÃO/PROFISSIONAL, com recorte por paciente):
entradas, anexos, itens visíveis do paciente, geração de atestados.
"""
import copy

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.prontuario.macros import MACROS_DISPONIVEIS, resolver_macros
from apps.prontuario.models import (
    Atestado,
    AnexoEntrada,
    CategoriaItemProntuario,
    ComentarioEntrada,
    EntradaProntuario,
    GrupoExames,
    ITENS_FIXOS,
    ItemProntuario,
    ModeloAtestado,
    ProtocoloProntuario,
    TextoPadrao,
    TipoCampo,
    TipoItem,
)
from apps.prontuario.permissions import (
    PodeAcessarProntuario,
    PodeConfigurarProntuario,
)
from apps.prontuario.serializers import (
    AtestadoSerializer,
    AnexoEntradaSerializer,
    CategoriaItemProntuarioSerializer,
    ComentarioEntradaSerializer,
    EntradaProntuarioSerializer,
    GerarAtestadoSerializer,
    GrupoExamesSerializer,
    ImportarProtocoloSerializer,
    ItemProntuarioSerializer,
    ModeloAtestadoSerializer,
    ProtocoloProntuarioSerializer,
    ReplicarConfigSerializer,
    TextoPadraoSerializer,
)
from apps.prontuario.utils import pacientes_visiveis


# --- Metadados (choices para o frontend) ------------------------------------


class OpcoesProntuarioView(APIView):
    """Choices e macros usadas pelo frontend (tipos de item/campo, macros)."""

    permission_classes = [PodeAcessarProntuario]

    @extend_schema(responses=OpenApiResponse(description="Choices e macros do prontuário."))
    def get(self, request):
        return Response(
            {
                "tipos_item": [
                    {"valor": v, "rotulo": r} for v, r in TipoItem.choices
                ],
                "tipos_campo": [
                    {"valor": v, "rotulo": r} for v, r in TipoCampo.choices
                ],
                "macros": [
                    {"token": token, "rotulo": rotulo}
                    for token, rotulo in MACROS_DISPONIVEIS
                ],
            }
        )


# --- Configuração (DIREÇÃO) --------------------------------------------------


class CategoriaItemProntuarioViewSet(viewsets.ModelViewSet):
    """Categorias (agrupadores) dos itens de prontuário. Filtro ``?profissional=``."""

    queryset = CategoriaItemProntuario.objects.all()
    serializer_class = CategoriaItemProntuarioSerializer
    permission_classes = [PodeConfigurarProntuario]
    filterset_fields = ["profissional", "ativo"]
    ordering = ["ordem", "nome"]


class ItemProntuarioViewSet(viewsets.ModelViewSet):
    """Itens configuráveis do prontuário. Filtros ``?profissional=``, ``?tipo_item=``."""

    queryset = ItemProntuario.objects.select_related("categoria")
    serializer_class = ItemProntuarioSerializer
    permission_classes = [PodeConfigurarProntuario]
    filterset_fields = ["profissional", "tipo_item", "categoria", "ativo"]
    search_fields = ["nome"]
    ordering = ["ordem", "nome"]

    def perform_destroy(self, instance):
        # Itens fixos do sistema não são apagados; apenas ocultados.
        if instance.chave_fixa:
            instance.visivel = False
            instance.save(update_fields=["visivel"])
            return
        instance.delete()

    @action(detail=False, methods=["post"])
    def provisionar_fixos(self, request):
        """Garante que os itens fixos do sistema existam para um profissional."""
        prof_id = request.data.get("profissional")
        if not prof_id:
            raise ValidationError({"profissional": "Parâmetro obrigatório."})
        existentes = set(
            ItemProntuario.objects.filter(profissional_id=prof_id)
            .exclude(chave_fixa="")
            .values_list("chave_fixa", flat=True)
        )
        novos = [
            ItemProntuario(
                profissional_id=prof_id,
                nome=nome,
                tipo_item=tipo,
                chave_fixa=chave,
                visivel=visivel,
                ordem=ordem,
                formulario_schema=copy.deepcopy(schema),
            )
            for ordem, (chave, nome, tipo, visivel, schema) in enumerate(ITENS_FIXOS)
            if chave not in existentes
        ]
        ItemProntuario.objects.bulk_create(novos)
        return Response({"criados": len(novos)})

    @action(detail=False, methods=["post"])
    def reordenar(self, request):
        """Reordena itens: body ``[{"id": 1, "ordem": 0}, ...]``."""
        dados = request.data if isinstance(request.data, list) else request.data.get("itens", [])
        ids = [d.get("id") for d in dados]
        itens = {i.id: i for i in ItemProntuario.objects.filter(id__in=ids)}
        atualizados = []
        for d in dados:
            item = itens.get(d.get("id"))
            if item is not None:
                item.ordem = d.get("ordem", item.ordem)
                atualizados.append(item)
        ItemProntuario.objects.bulk_update(atualizados, ["ordem"])
        return Response({"reordenados": len(atualizados)})


class TextoPadraoViewSet(viewsets.ModelViewSet):
    """Textos padrão reutilizáveis. Filtros ``?profissional=``, ``?item=``."""

    queryset = TextoPadrao.objects.all()
    serializer_class = TextoPadraoSerializer
    filterset_fields = ["profissional", "item", "compartilhado", "ativo"]
    search_fields = ["titulo", "conteudo"]
    ordering = ["ordem", "titulo"]

    def get_permissions(self):
        # Leitura liberada aos preenchedores (para inserir texto ao registrar);
        # escrita exclusiva da DIREÇÃO.
        if self.action in ("list", "retrieve"):
            return [PodeAcessarProntuario()]
        return [PodeConfigurarProntuario()]


class GrupoExamesViewSet(viewsets.ModelViewSet):
    """Grupos de exames pré-configurados. Filtro ``?profissional=``."""

    queryset = GrupoExames.objects.all()
    serializer_class = GrupoExamesSerializer
    filterset_fields = ["profissional", "ativo"]
    search_fields = ["nome"]
    ordering = ["ordem", "nome"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [PodeAcessarProntuario()]
        return [PodeConfigurarProntuario()]


class ModeloAtestadoViewSet(viewsets.ModelViewSet):
    """Modelos de atestado. Escrita só DIREÇÃO; leitura liberada para o picker."""

    queryset = ModeloAtestado.objects.all()
    serializer_class = ModeloAtestadoSerializer
    filterset_fields = ["profissional", "ativo"]
    search_fields = ["nome", "titulo"]
    ordering = ["ordem", "nome"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [PodeAcessarProntuario()]
        return [PodeConfigurarProntuario()]


class ProtocoloProntuarioViewSet(viewsets.ReadOnlyModelViewSet):
    """Biblioteca de protocolos prontos (somente leitura + importar)."""

    queryset = ProtocoloProntuario.objects.filter(ativo=True).select_related(
        "especialidade"
    )
    serializer_class = ProtocoloProntuarioSerializer
    permission_classes = [PodeConfigurarProntuario]
    filterset_fields = ["especialidade", "tipo_item"]
    search_fields = ["nome", "descricao"]

    @action(detail=True, methods=["post"])
    def importar(self, request, pk=None):
        """Cria um ``ItemProntuario`` para um profissional a partir do protocolo."""
        protocolo = self.get_object()
        entrada = ImportarProtocoloSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        prof_id = entrada.validated_data["profissional"]
        categoria_id = entrada.validated_data.get("categoria")

        ordem = (
            ItemProntuario.objects.filter(profissional_id=prof_id).count()
        )
        item = ItemProntuario.objects.create(
            profissional_id=prof_id,
            categoria_id=categoria_id,
            nome=protocolo.nome,
            tipo_item=protocolo.tipo_item,
            formulario_schema=copy.deepcopy(protocolo.formulario_schema),
            ordem=ordem,
        )
        return Response(
            ItemProntuarioSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ConfigProntuarioView(APIView):
    """Ações de configuração que não mapeiam a um recurso (replicar)."""

    permission_classes = [PodeConfigurarProntuario]

    @extend_schema(
        request=ReplicarConfigSerializer,
        responses=OpenApiResponse(description="Resumo dos itens replicados por tipo."),
    )
    def post(self, request):
        entrada = ReplicarConfigSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        origem = entrada.validated_data["origem"]
        destino = entrada.validated_data["destino"]
        incluir = set(entrada.validated_data["incluir"])
        resumo = {}

        if "itens" in incluir:
            resumo["itens"] = self._replicar_itens(origem, destino)
        if "textos" in incluir:
            resumo["textos"] = self._replicar(
                TextoPadrao, origem, destino, ["titulo", "conteudo", "compartilhado", "ordem"]
            )
        if "atestados" in incluir:
            resumo["atestados"] = self._replicar(
                ModeloAtestado, origem, destino, ["nome", "titulo", "corpo", "ordem"]
            )
        if "grupos" in incluir:
            resumo["grupos"] = self._replicar(
                GrupoExames, origem, destino, ["nome", "exames", "ordem"]
            )
        return Response(resumo)

    @staticmethod
    def _replicar_itens(origem, destino):
        base = ItemProntuario.objects.filter(profissional_id=destino).count()
        criados = 0
        for i, item in enumerate(
            ItemProntuario.objects.filter(profissional_id=origem, ativo=True)
        ):
            ItemProntuario.objects.create(
                profissional_id=destino,
                nome=item.nome,
                tipo_item=item.tipo_item,
                chave_fixa=item.chave_fixa,
                visivel=item.visivel,
                ordem=base + i,
                formulario_schema=copy.deepcopy(item.formulario_schema),
            )
            criados += 1
        return criados

    @staticmethod
    def _replicar(modelo, origem, destino, campos):
        criados = 0
        for obj in modelo.objects.filter(profissional_id=origem):
            dados = {c: copy.deepcopy(getattr(obj, c)) for c in campos}
            modelo.objects.create(profissional_id=destino, **dados)
            criados += 1
        return criados


# --- Preenchimento -----------------------------------------------------------


class EntradaProntuarioViewSet(viewsets.ModelViewSet):
    """Entradas preenchidas do prontuário. Filtros ``?paciente=``, ``?item=``, ``?profissional=``."""

    serializer_class = EntradaProntuarioSerializer
    permission_classes = [PodeAcessarProntuario]
    filterset_fields = ["paciente", "item", "profissional"]
    search_fields = ["titulo", "conteudo"]
    ordering_fields = ["data_evento", "criado_em"]
    ordering = ["-data_evento", "-criado_em"]

    def get_queryset(self):
        return (
            EntradaProntuario.objects.filter(
                paciente__in=pacientes_visiveis(self.request.user)
            )
            .select_related("autor", "paciente", "item")
            .prefetch_related("anexos", "anexos__enviado_por")
        )

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        campos = getattr(serializer, "fields", {})
        if "paciente" in campos:
            campos["paciente"].queryset = pacientes_visiveis(self.request.user)
        return serializer

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)

    def _garantir_autor(self, instance):
        if instance.autor_id != self.request.user.id:
            raise PermissionDenied(
                "Apenas o autor pode alterar ou excluir esta entrada."
            )

    def perform_update(self, serializer):
        self._garantir_autor(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._garantir_autor(instance)
        instance.delete()

    @action(detail=False, methods=["get"], url_path="itens-do-paciente")
    def itens_do_paciente(self, request):
        """Itens visíveis do PRÓPRIO usuário — cada profissional preenche o seu prontuário.

        O ``?paciente=`` serve apenas para checar o acesso ao paciente; os itens
        retornados são sempre os do usuário logado (sem filtro por profissional).
        """
        paciente_id = request.query_params.get("paciente")
        if not paciente_id:
            raise ValidationError({"paciente": "Parâmetro obrigatório."})
        paciente = (
            pacientes_visiveis(request.user).filter(pk=paciente_id).first()
        )
        if paciente is None:
            raise PermissionDenied("Paciente não acessível.")

        itens = (
            ItemProntuario.objects.filter(
                profissional=request.user, ativo=True, visivel=True
            )
            .select_related("categoria")
            .order_by("ordem", "nome")
        )
        return Response(
            ItemProntuarioSerializer(itens, many=True, context={"request": request}).data
        )


class AnexoEntradaViewSet(viewsets.ModelViewSet):
    """Anexos de uma entrada (upload/remoção). Só nas próprias entradas."""

    serializer_class = AnexoEntradaSerializer
    permission_classes = [PodeAcessarProntuario]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ["entrada"]

    def _entradas_do_autor(self):
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return EntradaProntuario.objects.none()
        return EntradaProntuario.objects.filter(autor=user)

    def get_queryset(self):
        return AnexoEntrada.objects.filter(
            entrada__in=self._entradas_do_autor()
        ).select_related("entrada", "enviado_por")

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        campo = getattr(serializer, "fields", {}).get("entrada")
        if campo is not None:
            campo.queryset = self._entradas_do_autor()
        return serializer

    def perform_create(self, serializer):
        serializer.save(enviado_por=self.request.user)


class ComentarioEntradaViewSet(viewsets.ModelViewSet):
    """Anotações colaborativas de uma entrada (observações e comentários).

    Diferente das entradas — travadas por autor — qualquer usuário com acesso
    ao prontuário do paciente pode criar. Editar/excluir continua restrito ao
    autor da anotação. Filtros ``?entrada=`` e ``?tipo=``.
    """

    serializer_class = ComentarioEntradaSerializer
    permission_classes = [PodeAcessarProntuario]
    filterset_fields = ["entrada", "entrada__paciente", "tipo"]
    ordering = ["criado_em"]

    def get_queryset(self):
        return ComentarioEntrada.objects.filter(
            entrada__paciente__in=pacientes_visiveis(self.request.user)
        ).select_related("autor", "entrada")

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        campo = getattr(serializer, "fields", {}).get("entrada")
        if campo is not None:
            campo.queryset = EntradaProntuario.objects.filter(
                paciente__in=pacientes_visiveis(self.request.user)
            )
        return serializer

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)

    def _garantir_autor(self, instance):
        if instance.autor_id != self.request.user.id:
            raise PermissionDenied("Apenas o autor pode alterar ou excluir esta anotação.")

    def perform_update(self, serializer):
        self._garantir_autor(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._garantir_autor(instance)
        instance.delete()


class AtestadoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Atestados gerados (leitura + ação ``gerar``). Recorte por paciente."""

    serializer_class = AtestadoSerializer
    permission_classes = [PodeAcessarProntuario]
    filterset_fields = ["paciente", "profissional"]
    ordering = ["-emitido_em"]

    def get_queryset(self):
        return Atestado.objects.filter(
            paciente__in=pacientes_visiveis(self.request.user)
        ).select_related("paciente", "profissional")

    @action(detail=False, methods=["post"])
    def gerar(self, request):
        """Gera um atestado resolvendo as macros do modelo para o paciente."""
        entrada = GerarAtestadoSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        dados = entrada.validated_data

        paciente = (
            pacientes_visiveis(request.user).filter(pk=dados["paciente"]).first()
        )
        if paciente is None:
            raise PermissionDenied("Paciente não acessível.")
        modelo = get_object_or_404(ModeloAtestado, pk=dados["modelo"])

        agendamento = None
        ag_id = dados.get("agendamento")
        if ag_id:
            from apps.clinica.models import Agendamento

            agendamento = Agendamento.objects.filter(pk=ag_id).first()

        cids = dados.get("cids") or []
        titulo = resolver_macros(
            modelo.titulo,
            paciente=paciente,
            profissional=modelo.profissional,
            agendamento=agendamento,
            cids=cids,
        )
        corpo = resolver_macros(
            modelo.corpo,
            paciente=paciente,
            profissional=modelo.profissional,
            agendamento=agendamento,
            cids=cids,
        )
        atestado = Atestado.objects.create(
            paciente=paciente,
            modelo=modelo,
            profissional=modelo.profissional,
            autor=request.user,
            agendamento=agendamento,
            titulo=titulo,
            corpo_resolvido=corpo,
            cids=cids,
        )
        return Response(
            AtestadoSerializer(atestado, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
