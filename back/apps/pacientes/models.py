"""
Modelos do módulo de pacientes.

- ``Paciente``          : cadastro único do paciente (clínica infantojuvenil),
  vinculado a um ou mais profissionais responsáveis (M2M).
- ``Responsavel``       : responsáveis legais (pais/tutores) — dados estruturados,
  base para contato e futura confirmação por WhatsApp.
- ``DocumentoPaciente`` : anexos do cadastro (documentos pessoais, laudos,
  relatórios, encaminhamentos, etc.).

Contexto LGPD: são dados pessoais/sensíveis de menores. Exclusão é lógica
(``ativo=False``) para preservar histórico; o acesso é restrito por papel na
camada de views/permissões.
"""
from datetime import date

from django.conf import settings
from django.db import models

from apps.accounts.models import Papel
from apps.pacientes.validators import validar_arquivo, validar_cpf


def caminho_documento(instance, filename):
    """Define o caminho de upload do anexo, isolando por paciente."""
    return f"pacientes/{instance.paciente_id}/documentos/{filename}"


class UF(models.TextChoices):
    """Unidades federativas do Brasil."""

    AC = "AC", "Acre"
    AL = "AL", "Alagoas"
    AP = "AP", "Amapá"
    AM = "AM", "Amazonas"
    BA = "BA", "Bahia"
    CE = "CE", "Ceará"
    DF = "DF", "Distrito Federal"
    ES = "ES", "Espírito Santo"
    GO = "GO", "Goiás"
    MA = "MA", "Maranhão"
    MT = "MT", "Mato Grosso"
    MS = "MS", "Mato Grosso do Sul"
    MG = "MG", "Minas Gerais"
    PA = "PA", "Pará"
    PB = "PB", "Paraíba"
    PR = "PR", "Paraná"
    PE = "PE", "Pernambuco"
    PI = "PI", "Piauí"
    RJ = "RJ", "Rio de Janeiro"
    RN = "RN", "Rio Grande do Norte"
    RS = "RS", "Rio Grande do Sul"
    RO = "RO", "Rondônia"
    RR = "RR", "Roraima"
    SC = "SC", "Santa Catarina"
    SP = "SP", "São Paulo"
    SE = "SE", "Sergipe"
    TO = "TO", "Tocantins"


class Parentesco(models.TextChoices):
    """Grau de parentesco do responsável em relação ao paciente."""

    MAE = "MAE", "Mãe"
    PAI = "PAI", "Pai"
    AVO = "AVO", "Avó/Avô"
    TIO = "TIO", "Tia/Tio"
    TUTOR = "TUTOR", "Tutor(a) legal"
    OUTRO = "OUTRO", "Outro"


class TipoDocumento(models.TextChoices):
    """Categorias de anexo do cadastro do paciente (seção 2 dos requisitos)."""

    DOCUMENTO_PESSOAL = "DOCUMENTO_PESSOAL", "Documento pessoal"
    SOLICITACAO_MEDICA = "SOLICITACAO_MEDICA", "Solicitação médica"
    RELATORIO = "RELATORIO", "Relatório"
    LAUDO = "LAUDO", "Laudo"
    ENCAMINHAMENTO = "ENCAMINHAMENTO", "Encaminhamento"
    OUTRO = "OUTRO", "Outro"


class SerieEscolar(models.TextChoices):
    """Série/ano escolar do paciente (educação infantil → ensino médio)."""

    BERCARIO = "BERCARIO", "Berçário"
    MATERNAL = "MATERNAL", "Maternal"
    PRE_1 = "PRE_1", "Pré I (Jardim I)"
    PRE_2 = "PRE_2", "Pré II (Jardim II)"
    EF_1 = "EF_1", "1º ano — Fundamental"
    EF_2 = "EF_2", "2º ano — Fundamental"
    EF_3 = "EF_3", "3º ano — Fundamental"
    EF_4 = "EF_4", "4º ano — Fundamental"
    EF_5 = "EF_5", "5º ano — Fundamental"
    EF_6 = "EF_6", "6º ano — Fundamental"
    EF_7 = "EF_7", "7º ano — Fundamental"
    EF_8 = "EF_8", "8º ano — Fundamental"
    EF_9 = "EF_9", "9º ano — Fundamental"
    EM_1 = "EM_1", "1ª série — Médio"
    EM_2 = "EM_2", "2ª série — Médio"
    EM_3 = "EM_3", "3ª série — Médio"


class Paciente(models.Model):
    """
    Cadastro único de um paciente da clínica.

    Um paciente pode ser atendido por múltiplos profissionais simultaneamente
    (psicoterapia, avaliação neuropsicológica, etc.) — daí o M2M ``profissionais``.
    """

    # --- Dados cadastrais ----------------------------------------------------
    nome_completo = models.CharField("nome completo", max_length=150, db_index=True)
    data_nascimento = models.DateField("data de nascimento")
    cpf = models.CharField(
        "CPF",
        max_length=11,
        null=True,
        blank=True,
        unique=True,
        validators=[validar_cpf],
        help_text="Somente dígitos. Opcional (pacientes infantojuvenis podem não ter).",
    )
    rg = models.CharField("RG", max_length=20, blank=True)
    rg_orgao_emissor = models.CharField(
        "órgão emissor do RG", max_length=20, blank=True
    )
    email = models.EmailField("e-mail", blank=True)
    telefone = models.CharField("telefone", max_length=20, blank=True)

    # --- Endereço ------------------------------------------------------------
    cep = models.CharField("CEP", max_length=9, blank=True)
    logradouro = models.CharField("logradouro", max_length=150, blank=True)
    numero = models.CharField("número", max_length=20, blank=True)
    complemento = models.CharField("complemento", max_length=100, blank=True)
    bairro = models.CharField("bairro", max_length=100, blank=True)
    cidade = models.CharField("cidade", max_length=100, blank=True)
    estado = models.CharField("estado (UF)", max_length=2, choices=UF.choices, blank=True)

    informacoes_complementares = models.TextField(
        "informações complementares", blank=True
    )

    # --- Dados clínicos (exibidos no cabeçalho do prontuário) ----------------
    diagnostico = models.TextField("diagnóstico / hipótese diagnóstica", blank=True)
    cid = models.CharField(
        "CID", max_length=20, blank=True, help_text="Código CID relacionado (ex.: F90.0)."
    )
    alertas = models.CharField(
        "alertas",
        max_length=255,
        blank=True,
        help_text="Avisos importantes (ex.: alergias, cuidados). Destacado no prontuário.",
    )

    # --- Dados escolares -----------------------------------------------------
    escola = models.CharField("escola", max_length=150, blank=True)
    serie_escolar = models.CharField(
        "série escolar",
        max_length=20,
        blank=True,
        choices=SerieEscolar.choices,
    )
    escola_responsavel_nome = models.CharField(
        "responsável na escola",
        max_length=150,
        blank=True,
        help_text="Pessoa de contato na escola (coordenação, professor(a), etc.).",
    )
    escola_responsavel_telefone = models.CharField(
        "telefone do responsável na escola", max_length=20, blank=True
    )

    # --- Dados complementares de família -------------------------------------
    nome_mae = models.CharField("nome da mãe", max_length=150, blank=True)
    nome_pai = models.CharField("nome do pai", max_length=150, blank=True)
    foto = models.ImageField(
        "foto",
        upload_to="pacientes/%Y/%m/",
        null=True,
        blank=True,
    )

    # --- Controle de cadastro ------------------------------------------------
    cadastro_incompleto = models.BooleanField(
        "cadastro incompleto",
        default=False,
        db_index=True,
        help_text="Marcado quando o paciente foi criado com dados mínimos durante o agendamento.",
    )

    # --- Vínculos e controle -------------------------------------------------
    profissionais = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="pacientes",
        blank=True,
        limit_choices_to={
            "papeis__codigo__in": [Papel.PROFISSIONAL, Papel.SUPERVISAO, Papel.DIRECAO],
            "is_active": True,
        },
        verbose_name="profissionais responsáveis",
        help_text="Profissionais que atendem este paciente.",
    )
    ativo = models.BooleanField("ativo", default=True, db_index=True)

    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pacientes_criados",
        verbose_name="criado por",
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Paciente"
        verbose_name_plural = "Pacientes"
        ordering = ["nome_completo"]
        indexes = [
            models.Index(fields=["nome_completo"]),
            models.Index(fields=["ativo"]),
        ]

    def __str__(self):
        return self.nome_completo

    @property
    def idade(self):
        """Idade em anos completos na data de hoje."""
        if not self.data_nascimento:
            return None
        hoje = date.today()
        return (
            hoje.year
            - self.data_nascimento.year
            - (
                (hoje.month, hoje.day)
                < (self.data_nascimento.month, self.data_nascimento.day)
            )
        )


class Responsavel(models.Model):
    """
    Responsável legal (pai, mãe, tutor) por um paciente.

    Dados estruturados para permitir contato e, futuramente, a confirmação
    automática de consultas por WhatsApp.
    """

    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name="responsaveis",
        verbose_name="paciente",
    )
    nome = models.CharField("nome completo", max_length=150)
    parentesco = models.CharField(
        "parentesco", max_length=10, choices=Parentesco.choices, default=Parentesco.OUTRO
    )
    cpf = models.CharField(
        "CPF", max_length=11, blank=True, validators=[validar_cpf]
    )
    telefone = models.CharField("telefone", max_length=20, blank=True)
    email = models.EmailField("e-mail", blank=True)
    principal = models.BooleanField(
        "contato principal",
        default=False,
        help_text="Responsável usado por padrão para contatos e avisos.",
    )

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Responsável"
        verbose_name_plural = "Responsáveis"
        ordering = ["-principal", "nome"]

    def __str__(self):
        return f"{self.nome} ({self.get_parentesco_display()})"


class DocumentoPaciente(models.Model):
    """
    Anexo do cadastro do paciente (documento pessoal, laudo, relatório, etc.).

    Faz parte do cadastro (seção 2 dos requisitos), não do prontuário clínico.
    """

    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.CASCADE,
        related_name="documentos",
        verbose_name="paciente",
    )
    arquivo = models.FileField(
        "arquivo", upload_to=caminho_documento, validators=[validar_arquivo]
    )
    nome_original = models.CharField("nome do arquivo", max_length=255, blank=True)
    tipo = models.CharField(
        "tipo", max_length=20, choices=TipoDocumento.choices, default=TipoDocumento.OUTRO
    )
    descricao = models.CharField("descrição", max_length=255, blank=True)

    enviado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documentos_enviados",
        verbose_name="enviado por",
    )
    criado_em = models.DateTimeField("enviado em", auto_now_add=True)

    class Meta:
        verbose_name = "Documento do paciente"
        verbose_name_plural = "Documentos do paciente"
        ordering = ["-criado_em"]

    def __str__(self):
        return self.nome_original or self.arquivo.name
