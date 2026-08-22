"""
Modelos do app de contas.

- ``Usuario``  : usuário customizado com login por e-mail e papel (``role``).
- ``LogAcesso``: registro de tentativas de login (exigência de LGPD — trilha de
  acesso: quem, quando e de onde).
"""
from django.contrib.auth.models import AbstractUser, PermissionsMixin
from django.db import models

from apps.accounts.managers import UsuarioManager
from apps.accounts.validators import validar_cpf, validar_imagem


def caminho_avatar(instance, filename):
    """Caminho de upload da foto de perfil, isolando por usuário."""
    return f"usuarios/avatars/{instance.pk}/{filename}"


class UF(models.TextChoices):
    """
    Unidades federativas do Brasil.

    Duplica intencionalmente ``apps.pacientes.models.UF``: ``accounts`` é o
    app-base e não deve importar de ``pacientes`` (que já depende de ``accounts``).
    """

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


class Sexo(models.TextChoices):
    """Sexo/gênero informado no cadastro do prestador."""

    MASCULINO = "MASCULINO", "Masculino"
    FEMININO = "FEMININO", "Feminino"
    OUTRO = "OUTRO", "Outro"


class TipoConselho(models.TextChoices):
    """
    Conselho profissional de classe do prestador.

    Cobre as profissões típicas de uma clínica multiprofissional infantojuvenil.
    Use ``OUTRO`` para conselhos não listados.
    """

    CRP = "CRP", "CRP — Psicologia"
    CRM = "CRM", "CRM — Medicina"
    CREFONO = "CREFONO", "CREFONO — Fonoaudiologia"
    CREFITO = "CREFITO", "CREFITO — Fisioterapia/T.O."
    CRESS = "CRESS", "CRESS — Serviço Social"
    CRN = "CRN", "CRN — Nutrição"
    CREF = "CREF", "CREF — Educação Física"
    OUTRO = "OUTRO", "Outro"


class Especialidade(models.Model):
    """
    Especialidade de um prestador (ex.: Psicólogo Clínico, Neuropsicólogo).

    Lista gerenciável pela clínica (DIREÇÃO/SUPERVISÃO), vinculada aos usuários
    com papel ``PROFISSIONAL`` via M2M (``Usuario.especialidades``). Exclusão é
    lógica (``ativo=False``) para não quebrar vínculos históricos.
    """

    nome = models.CharField("nome", max_length=100, unique=True)
    ativo = models.BooleanField("ativo", default=True, db_index=True)

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Especialidade"
        verbose_name_plural = "Especialidades"
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class Papel(models.TextChoices):
    """
    Papéis (níveis de acesso) da clínica.

    Nesta fase o papel apenas existe no modelo e é retornado nos dados do usuário.
    As regras finas de permissão por papel serão implementadas nos módulos futuros
    (pacientes, prontuário, agenda, etc.).
    """

    DIRECAO = "DIRECAO", "Direção"  # acesso total (admin da clínica)
    SUPERVISAO = "SUPERVISAO", "Supervisão"  # acesso ampliado a prontuários (futuro)
    PROFISSIONAL = "PROFISSIONAL", "Profissional"  # apenas os próprios pacientes (futuro)
    RECEPCAO = "RECEPCAO", "Recepção"  # visão geral, exceto prontuários (futuro)
    FINANCEIRO = "FINANCEIRO", "Financeiro"  # visualiza valores de serviços (futuro)


class Usuario(AbstractUser):
    """
    Usuário do sistema, autenticado por e-mail (sem username).

    Herda de ``AbstractUser`` para reaproveitar ``is_active``, ``is_staff``,
    ``is_superuser``, ``last_login`` e a integração com grupos/permissões do Django.
    O campo ``username`` é removido; o login é feito pelo ``email``.
    """

    username = None
    first_name = None
    last_name = None

    email = models.EmailField("e-mail", unique=True, db_index=True)
    nome = models.CharField("nome completo", max_length=150)
    role = models.CharField(
        "papel",
        max_length=20,
        choices=Papel.choices,
        default=Papel.PROFISSIONAL,
        help_text="Nível de acesso do usuário na clínica.",
    )
    foto = models.ImageField(
        "foto de perfil",
        upload_to=caminho_avatar,
        null=True,
        blank=True,
        validators=[validar_imagem],
    )

    # --- Dados pessoais ------------------------------------------------------
    cpf = models.CharField(
        "CPF",
        max_length=11,
        null=True,
        blank=True,
        unique=True,
        validators=[validar_cpf],
        help_text="Somente dígitos. Opcional.",
    )
    rg = models.CharField("identidade (RG)", max_length=20, blank=True)
    rg_orgao_emissor = models.CharField("órgão emissor", max_length=20, blank=True)
    data_nascimento = models.DateField("data de nascimento", null=True, blank=True)
    sexo = models.CharField("sexo", max_length=10, choices=Sexo.choices, blank=True)

    # --- Contato -------------------------------------------------------------
    telefone = models.CharField("telefone", max_length=20, blank=True)
    celular = models.CharField("celular", max_length=20, blank=True)

    # --- Registro no conselho (assinatura do prontuário) ---------------------
    conselho_tipo = models.CharField(
        "conselho", max_length=10, choices=TipoConselho.choices, blank=True
    )
    conselho_uf = models.CharField(
        "UF do conselho", max_length=2, choices=UF.choices, blank=True
    )
    conselho_numero = models.CharField("número no conselho", max_length=30, blank=True)

    # --- Endereço ------------------------------------------------------------
    cep = models.CharField("CEP", max_length=9, blank=True)
    logradouro = models.CharField("logradouro", max_length=150, blank=True)
    numero = models.CharField("número", max_length=20, blank=True)
    complemento = models.CharField("complemento", max_length=100, blank=True)
    bairro = models.CharField("bairro", max_length=100, blank=True)
    cidade = models.CharField("cidade", max_length=100, blank=True)
    estado = models.CharField("estado (UF)", max_length=2, choices=UF.choices, blank=True)

    # --- Qualificação profissional -------------------------------------------
    especialidades = models.ManyToManyField(
        Especialidade,
        related_name="profissionais",
        blank=True,
        verbose_name="especialidades",
        help_text="Especialidades do prestador (obrigatório para o papel PROFISSIONAL).",
    )

    precisa_trocar_senha = models.BooleanField(
        "precisa trocar a senha",
        default=False,
        help_text="Quando verdadeiro, o usuário é obrigado a definir uma nova senha no próximo acesso.",
    )

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nome"]  # solicitado ao criar superusuário via CLI

    objects = UsuarioManager()

    class Meta:
        verbose_name = "Usuário"
        verbose_name_plural = "Usuários"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.nome} <{self.email}>" if self.nome else self.email

    @property
    def is_direcao(self):
        """Atalho: indica se o usuário tem papel de DIREÇÃO."""
        return self.role == Papel.DIRECAO

    @property
    def conselho(self):
        """
        Registro no conselho montado a partir dos campos estruturados.

        Ex.: ``CRP PA/1009775``. Retorna string vazia quando não há tipo/número.
        Usado como assinatura nos registros do prontuário (``autor.conselho``).
        """
        if not (self.conselho_tipo and self.conselho_numero):
            return ""
        uf = f" {self.conselho_uf}" if self.conselho_uf else ""
        return f"{self.conselho_tipo}{uf}/{self.conselho_numero}"


class LogAcesso(models.Model):
    """
    Trilha de acessos (LGPD): registra tentativas de login no sistema.

    Registramos tanto sucessos quanto falhas, guardando o e-mail informado (mesmo
    quando não corresponde a um usuário existente), o IP e o user-agent de origem.
    """

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs_acesso",
        verbose_name="usuário",
    )
    email_informado = models.EmailField("e-mail informado")
    sucesso = models.BooleanField("sucesso", default=False)
    ip = models.GenericIPAddressField("endereço IP", null=True, blank=True)
    user_agent = models.TextField("user-agent", blank=True)
    data_hora = models.DateTimeField("data/hora", auto_now_add=True)

    class Meta:
        verbose_name = "Log de acesso"
        verbose_name_plural = "Logs de acesso"
        ordering = ["-data_hora"]
        indexes = [
            models.Index(fields=["-data_hora"]),
            models.Index(fields=["email_informado"]),
        ]

    def __str__(self):
        estado = "sucesso" if self.sucesso else "falha"
        return f"{self.email_informado} — {estado} em {self.data_hora:%d/%m/%Y %H:%M}"
