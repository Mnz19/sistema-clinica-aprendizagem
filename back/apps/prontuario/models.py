"""
Modelos do prontuário eletrônico — **modular por profissional**.

A configuração do prontuário é montada pela DIREÇÃO para cada profissional:

- ``CategoriaItemProntuario`` : agrupador opcional dos itens.
- ``ItemProntuario``          : o item configurável (fixo com liga/desliga,
  texto livre ou formulário personalizado). O formulário é descrito em JSON.
- ``EntradaProntuario``       : um registro preenchido de um item para um
  paciente (texto rico ou respostas do formulário). Guarda um *snapshot* do
  schema no momento do preenchimento para integridade histórica.
- ``AnexoEntrada``            : documentos anexados a uma entrada.
- ``TextoPadrao``             : textos reutilizáveis nos preenchimentos.
- ``GrupoExames``             : grupos de exames pré-configurados.
- ``ModeloAtestado``          : modelo de atestado com corpo + macros.
- ``Atestado``                : atestado gerado (macros já resolvidas).
- ``ProtocoloProntuario``     : biblioteca global de formulários pré-definidos
  (protocolos prontos) que a direção importa para o profissional.

Regras de acesso (ver ``permissions.py``/``views.py``): a **configuração** é
exclusiva da DIREÇÃO; o **preenchimento** segue a regra do módulo (profissional
só acessa pacientes vinculados; supervisão e direção acessam todos). Toda
alteração fica na trilha do auditlog.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.pacientes.models import Paciente
from apps.pacientes.validators import validar_arquivo


def caminho_anexo_entrada(instance, filename):
    """Caminho de upload do anexo, isolando por paciente e entrada."""
    return f"prontuario/{instance.entrada.paciente_id}/{instance.entrada_id}/{filename}"


class TipoItem(models.TextChoices):
    """Natureza de um item de prontuário."""

    FIXO = "FIXO", "Item fixo"
    TEXTO_LIVRE = "TEXTO_LIVRE", "Texto livre"
    FORMULARIO = "FORMULARIO", "Formulário personalizado"


class TipoCampo(models.TextChoices):
    """Tipos de campo suportados pelo construtor de formulários (essenciais)."""

    TEXTO_CURTO = "TEXTO_CURTO", "Texto curto"
    TEXTO_LONGO = "TEXTO_LONGO", "Texto longo"
    DATA = "DATA", "Data"
    NUMERO = "NUMERO", "Número"
    SELECAO_UNICA = "SELECAO_UNICA", "Seleção única"
    MULTIPLA_ESCOLHA = "MULTIPLA_ESCOLHA", "Múltipla escolha"
    SECAO = "SECAO", "Título / seção"


# Tipos de campo que exigem lista de ``opcoes``.
TIPOS_CAMPO_COM_OPCOES = {TipoCampo.SELECAO_UNICA, TipoCampo.MULTIPLA_ESCOLHA}


def _campo_anamnese(cid, tipo, rotulo, ordem, *, obrigatorio=False, opcoes=None):
    """Atalho para montar um campo do schema seed da Anamnese."""
    return {
        "id": cid,
        "tipo": tipo,
        "rotulo": rotulo,
        "ordem": ordem,
        "obrigatorio": obrigatorio,
        "opcoes": opcoes or [],
    }


# Schema padrão (seed) da Anamnese, voltado a fonoaudiologia — TEA nível 1 e
# dificuldades de aprendizagem. 10 perguntas essenciais como ponto de partida:
# cada profissional pode editar/adicionar/remover perguntas depois.
ANAMNESE_SCHEMA_PADRAO = [
    _campo_anamnese("data_anamnese", TipoCampo.DATA, "Data da anamnese", 0, obrigatorio=True),
    _campo_anamnese("informante", TipoCampo.TEXTO_CURTO, "Informante (nome e parentesco)", 1),
    _campo_anamnese("queixa_principal", TipoCampo.TEXTO_LONGO, "Queixa principal", 2, obrigatorio=True),
    _campo_anamnese("desenvolvimento_linguagem", TipoCampo.TEXTO_LONGO, "Desenvolvimento da linguagem (primeiras palavras/frases)", 3),
    _campo_anamnese("diagnosticos", TipoCampo.TEXTO_LONGO, "Diagnósticos / laudos prévios", 4),
    _campo_anamnese("terapias", TipoCampo.TEXTO_LONGO, "Terapias em andamento (fono, TO, psico, etc.)", 5),
    _campo_anamnese("interacao_social", TipoCampo.TEXTO_LONGO, "Interação social e comunicação", 6),
    _campo_anamnese("aspectos_sensoriais", TipoCampo.TEXTO_LONGO, "Aspectos sensoriais (sons, texturas, luz, toque)", 7),
    _campo_anamnese("dificuldades_aprendizagem", TipoCampo.TEXTO_LONGO, "Dificuldades de aprendizagem observadas", 8),
    _campo_anamnese("expectativas", TipoCampo.TEXTO_LONGO, "Expectativas da família", 9),
]


# Catálogo de itens fixos do sistema: (chave, nome, tipo, visível, schema).
# São provisionados por profissional. ``visivel`` liga/desliga a exibição.
# A Anamnese é um FORMULARIO fixo cujas perguntas vêm de ``ANAMNESE_SCHEMA_PADRAO``
# e podem ser editadas pelo profissional; os demais são seções de texto rico.
ITENS_FIXOS = [
    ("ANAMNESE", "Anamnese", TipoItem.FORMULARIO, True, ANAMNESE_SCHEMA_PADRAO),
    ("PLANO_ATENDIMENTO", "Plano de atendimento", TipoItem.FIXO, True, []),
    ("EVOLUCAO", "Evolução", TipoItem.FIXO, True, []),
    ("VISITA_ESCOLAR", "Visita escolar", TipoItem.FIXO, False, []),
    ("REFLEXOES_TERAPEUTA", "Reflexões do terapeuta", TipoItem.FIXO, False, []),
    ("ENCERRAMENTO", "Encerramento", TipoItem.FIXO, False, []),
    ("ATUALIZACOES", "Atualizações", TipoItem.FIXO, True, []),
]


class ModeloBase(models.Model):
    """Timestamps padrão reaproveitados pelos modelos do prontuário."""

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        abstract = True


# --- Configuração por profissional ------------------------------------------


class CategoriaItemProntuario(ModeloBase):
    """Agrupador (categoria) dos itens de prontuário de um profissional."""

    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categorias_prontuario",
        verbose_name="profissional",
    )
    nome = models.CharField("nome", max_length=120)
    ordem = models.PositiveSmallIntegerField("ordem", default=0)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        verbose_name = "Categoria de prontuário"
        verbose_name_plural = "Categorias de prontuário"
        ordering = ["profissional", "ordem", "nome"]

    def __str__(self) -> str:
        return f"{self.nome} ({self.profissional})"


class ItemProntuario(ModeloBase):
    """
    Item configurável do prontuário de um profissional.

    ``FIXO``       : item padrão do sistema, controlado por ``visivel``.
    ``TEXTO_LIVRE``: preenchido com texto rico.
    ``FORMULARIO`` : preenchido a partir de ``formulario_schema`` (JSON).
    """

    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="itens_prontuario",
        verbose_name="profissional",
    )
    categoria = models.ForeignKey(
        CategoriaItemProntuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="itens",
        verbose_name="categoria",
    )
    nome = models.CharField("nome", max_length=150)
    tipo_item = models.CharField(
        "tipo do item", max_length=20, choices=TipoItem.choices
    )
    chave_fixa = models.CharField(
        "chave do item fixo",
        max_length=40,
        blank=True,
        help_text="Preenchido apenas para itens fixos do sistema.",
    )
    visivel = models.BooleanField(
        "visível",
        default=True,
        help_text="Liga/desliga a exibição do item (usado nos itens fixos).",
    )
    ordem = models.PositiveSmallIntegerField("ordem", default=0)
    ativo = models.BooleanField("ativo", default=True)
    formulario_schema = models.JSONField(
        "schema do formulário",
        default=list,
        blank=True,
        help_text="Lista de campos {id, tipo, rotulo, ordem, obrigatorio, opcoes}.",
    )

    class Meta:
        verbose_name = "Item de prontuário"
        verbose_name_plural = "Itens de prontuário"
        ordering = ["profissional", "ordem", "nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["profissional", "chave_fixa"],
                condition=~models.Q(chave_fixa=""),
                name="item_fixo_unico_por_profissional",
            )
        ]
        indexes = [models.Index(fields=["profissional", "ativo"])]

    def __str__(self) -> str:
        return f"{self.nome} ({self.profissional})"


# --- Preenchimento (registros do paciente) ----------------------------------


class EntradaProntuario(ModeloBase):
    """Um registro preenchido de um item de prontuário para um paciente."""

    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name="entradas",
        verbose_name="paciente",
    )
    item = models.ForeignKey(
        ItemProntuario,
        on_delete=models.PROTECT,
        related_name="entradas",
        verbose_name="item",
    )
    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entradas_prontuario",
        verbose_name="profissional",
        help_text="Dono da configuração do item (denormalizado para filtros).",
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entradas_prontuario_autoradas",
        verbose_name="autor",
    )
    agendamento = models.ForeignKey(
        "clinica.Agendamento",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entradas_prontuario",
        verbose_name="agendamento",
    )
    titulo = models.CharField("título", max_length=200, blank=True)
    conteudo = models.TextField(
        "conteúdo", blank=True, help_text="Texto rico (itens FIXO/TEXTO_LIVRE)."
    )
    respostas = models.JSONField(
        "respostas",
        default=dict,
        blank=True,
        help_text="Respostas por campo (itens FORMULARIO): {campo_id: valor}.",
    )
    schema_snapshot = models.JSONField(
        "schema no preenchimento",
        default=list,
        blank=True,
        help_text="Cópia do schema do item no momento do preenchimento.",
    )
    data_evento = models.DateTimeField(
        "data do evento",
        default=timezone.now,
        db_index=True,
        help_text="Quando o atendimento/evento ocorreu (pode diferir do registro).",
    )
    referente_a = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="observacoes",
        verbose_name="referente a",
    )

    class Meta:
        verbose_name = "Entrada do prontuário"
        verbose_name_plural = "Entradas do prontuário"
        ordering = ["-data_evento", "-criado_em"]
        indexes = [
            models.Index(fields=["paciente", "-data_evento"]),
            models.Index(fields=["item"]),
            models.Index(fields=["profissional"]),
        ]

    def __str__(self) -> str:
        return f"{self.item.nome} — {self.paciente} ({self.data_evento:%d/%m/%Y})"


class AnexoEntrada(ModeloBase):
    """Documento anexado a uma entrada do prontuário."""

    entrada = models.ForeignKey(
        EntradaProntuario,
        on_delete=models.CASCADE,
        related_name="anexos",
        verbose_name="entrada",
    )
    arquivo = models.FileField(
        "arquivo", upload_to=caminho_anexo_entrada, validators=[validar_arquivo]
    )
    nome_original = models.CharField("nome do arquivo", max_length=255, blank=True)
    descricao = models.CharField("descrição", max_length=255, blank=True)
    enviado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="anexos_prontuario_enviados",
        verbose_name="enviado por",
    )

    class Meta:
        verbose_name = "Anexo da entrada"
        verbose_name_plural = "Anexos da entrada"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return self.nome_original or self.arquivo.name


class TipoComentario(models.TextChoices):
    """Anotações colaborativas sobre uma entrada da linha do tempo."""

    OBSERVACAO = "OBSERVACAO", "Observação"
    COMENTARIO = "COMENTARIO", "Comentário"


class ComentarioEntrada(ModeloBase):
    """Anotação (observação ou comentário) sobre uma entrada do prontuário.

    Diferente da própria entrada — travada por autor — a anotação é
    **colaborativa**: qualquer profissional com acesso ao prontuário do
    paciente pode registrar. ``OBSERVACAO`` é exibida acima do registro na
    linha do tempo; ``COMENTARIO`` compõe uma thread no rodapé do registro.
    """

    entrada = models.ForeignKey(
        EntradaProntuario,
        on_delete=models.CASCADE,
        related_name="comentarios",
        verbose_name="entrada",
    )
    tipo = models.CharField(
        "tipo",
        max_length=10,
        choices=TipoComentario.choices,
        default=TipoComentario.COMENTARIO,
    )
    texto = models.TextField("texto")
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comentarios_prontuario",
        verbose_name="autor",
    )

    class Meta:
        verbose_name = "Anotação da entrada"
        verbose_name_plural = "Anotações da entrada"
        ordering = ["criado_em"]
        indexes = [models.Index(fields=["entrada", "tipo", "criado_em"])]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} de {self.autor} em {self.entrada_id}"


# --- Recursos auxiliares da configuração ------------------------------------


class TextoPadrao(ModeloBase):
    """Texto padrão (modelo) reutilizável no preenchimento das entradas."""

    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="textos_padrao",
        verbose_name="profissional",
    )
    titulo = models.CharField("título", max_length=150)
    conteudo = models.TextField("conteúdo")
    item = models.ForeignKey(
        ItemProntuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="textos_padrao",
        verbose_name="item associado",
    )
    compartilhado = models.BooleanField(
        "compartilhado com a equipe",
        default=False,
        help_text="Se verdadeiro, todos os profissionais podem usar este texto.",
    )
    ordem = models.PositiveSmallIntegerField("ordem", default=0)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        verbose_name = "Texto padrão"
        verbose_name_plural = "Textos padrão"
        ordering = ["profissional", "ordem", "titulo"]

    def __str__(self) -> str:
        return self.titulo


class GrupoExames(ModeloBase):
    """Grupo de exames pré-configurado para solicitação rápida."""

    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grupos_exames",
        verbose_name="profissional",
    )
    nome = models.CharField("nome", max_length=150)
    exames = models.JSONField(
        "exames",
        default=list,
        blank=True,
        help_text="Lista de exames: [{nome, observacao}].",
    )
    ordem = models.PositiveSmallIntegerField("ordem", default=0)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        verbose_name = "Grupo de exames"
        verbose_name_plural = "Grupos de exames"
        ordering = ["profissional", "ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class ModeloAtestado(ModeloBase):
    """Modelo de atestado com corpo em texto rico e macros ([NOME_PACIENTE]...)."""

    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="modelos_atestado",
        verbose_name="profissional",
    )
    nome = models.CharField("nome do modelo", max_length=150)
    titulo = models.CharField("título impresso", max_length=200, blank=True)
    corpo = models.TextField(
        "corpo", help_text="Texto do atestado com macros entre colchetes."
    )
    ordem = models.PositiveSmallIntegerField("ordem", default=0)
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        verbose_name = "Modelo de atestado"
        verbose_name_plural = "Modelos de atestado"
        ordering = ["profissional", "ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class Atestado(ModeloBase):
    """Atestado gerado para um paciente (macros já resolvidas e congeladas)."""

    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name="atestados",
        verbose_name="paciente",
    )
    modelo = models.ForeignKey(
        ModeloAtestado,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="atestados",
        verbose_name="modelo",
    )
    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="atestados_prontuario",
        verbose_name="profissional",
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="atestados_emitidos",
        verbose_name="autor",
    )
    agendamento = models.ForeignKey(
        "clinica.Agendamento",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="atestados",
        verbose_name="agendamento",
    )
    titulo = models.CharField("título", max_length=200, blank=True)
    corpo_resolvido = models.TextField("corpo resolvido")
    cids = models.JSONField(
        "CIDs",
        default=list,
        blank=True,
        help_text="Lista de CIDs usados: [{codigo, descricao}].",
    )
    emitido_em = models.DateTimeField("emitido em", default=timezone.now)

    class Meta:
        verbose_name = "Atestado"
        verbose_name_plural = "Atestados"
        ordering = ["-emitido_em"]
        indexes = [models.Index(fields=["paciente", "-emitido_em"])]

    def __str__(self) -> str:
        return f"{self.titulo or 'Atestado'} — {self.paciente}"


# --- Biblioteca de protocolos prontos (global) ------------------------------


class ProtocoloProntuario(ModeloBase):
    """
    Formulário pré-definido (protocolo pronto), global e por especialidade.

    A DIREÇÃO importa um protocolo para a configuração de um profissional,
    criando um ``ItemProntuario`` a partir do ``formulario_schema``.
    """

    nome = models.CharField("nome", max_length=150)
    descricao = models.CharField("descrição", max_length=255, blank=True)
    especialidade = models.ForeignKey(
        "accounts.Especialidade",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="protocolos_prontuario",
        verbose_name="especialidade",
    )
    tipo_item = models.CharField(
        "tipo do item",
        max_length=20,
        choices=TipoItem.choices,
        default=TipoItem.FORMULARIO,
    )
    formulario_schema = models.JSONField(
        "schema do formulário", default=list, blank=True
    )
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        verbose_name = "Protocolo pronto"
        verbose_name_plural = "Protocolos prontos"
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome
