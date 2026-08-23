"""
Modelos do módulo de clínica (Fase 1: fundações operacionais).

- ``Sala``                      : espaços físicos de atendimento.
- ``Servico``                   : serviços prestados, sempre vinculados a um
  profissional (tipo de atendimento, duração e valor).
- ``DisponibilidadeProfissional``: horários recorrentes em que um profissional
  atende, por dia da semana.
- ``AusenciaProfissional``       : períodos em que um profissional está
  indisponível (férias, licenças, etc.), sobrepondo a disponibilidade.
- ``Agendamento``                : consulta agendada (paciente, profissional,
  sala, serviço, data/hora e status do atendimento).
- ``Producao``                   : ledger imutável de faturamento (snapshot do
  valor do serviço ao concluir/falta/cancelamento tardio).

Não há mais uma "Agenda" global: disponibilidade e ausência são centradas no
profissional (``settings.AUTH_USER_MODEL``).

Exclusão é sempre lógica (``ativo``/``ativa`` = ``False``); os registros nunca são
apagados fisicamente, conforme a política geral do projeto — com a exceção
controlada de ``Producao`` ao reverter status (correção da secretária).
"""
from django.conf import settings
from django.db import models

from apps.accounts.models import Papel


class DiaSemana(models.IntegerChoices):
    """Dias da semana (``0`` = segunda-feira … ``6`` = domingo)."""

    SEGUNDA = 0, "Segunda-feira"
    TERCA = 1, "Terça-feira"
    QUARTA = 2, "Quarta-feira"
    QUINTA = 3, "Quinta-feira"
    SEXTA = 4, "Sexta-feira"
    SABADO = 5, "Sábado"
    DOMINGO = 6, "Domingo"


class ModeloBase(models.Model):
    """Base abstrata com a trilha de criação/atualização, reaproveitada no módulo."""

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        abstract = True


class Sala(models.Model):
    """Espaço físico de atendimento (sala de consulta, avaliação, etc.)."""

    nome = models.CharField("nome", max_length=100)
    descricao = models.TextField("descrição", blank=True)
    ativa = models.BooleanField("ativa", default=True, db_index=True)

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Sala"
        verbose_name_plural = "Salas"
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class Servico(models.Model):
    """Serviço prestado por um ou mais profissionais (tipo de atendimento)."""

    nome = models.CharField("nome", max_length=150)
    descricao = models.TextField("descrição", blank=True)
    duracao_minutos = models.PositiveIntegerField("duração (minutos)")
    valor_clinica = models.DecimalField("valor clínica", max_digits=10, decimal_places=2)
    valor_repasse = models.DecimalField("repasse profissional", max_digits=10, decimal_places=2)
    profissionais = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="servicos",
        limit_choices_to={"papeis__codigo": Papel.PROFISSIONAL},
        verbose_name="profissionais",
    )
    ativo = models.BooleanField("ativo", default=True, db_index=True)

    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        verbose_name = "Serviço"
        verbose_name_plural = "Serviços"
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class DisponibilidadeProfissional(ModeloBase):
    """Janela recorrente de atendimento de um profissional em um dia da semana."""

    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="disponibilidades",
        limit_choices_to={"papeis__codigo": Papel.PROFISSIONAL},
        verbose_name="profissional",
    )
    dia_semana = models.IntegerField(
        "dia da semana", choices=DiaSemana.choices, db_index=True
    )
    horario_inicio = models.TimeField("horário de início")
    horario_fim = models.TimeField("horário de fim")
    ativo = models.BooleanField("ativo", default=True, db_index=True)

    class Meta:
        verbose_name = "Disponibilidade do profissional"
        verbose_name_plural = "Disponibilidades dos profissionais"
        ordering = ["profissional", "dia_semana", "horario_inicio"]
        unique_together = ("profissional", "dia_semana", "horario_inicio")

    def __str__(self) -> str:
        return (
            f"{self.profissional} — {self.get_dia_semana_display()} "
            f"({self.horario_inicio}–{self.horario_fim})"
        )


class AusenciaProfissional(ModeloBase):
    """Período em que um profissional está indisponível (férias, licença, etc.)."""

    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ausencias",
        limit_choices_to={"papeis__codigo": Papel.PROFISSIONAL},
        verbose_name="profissional",
    )
    data_inicio = models.DateField("data de início")
    data_fim = models.DateField("data de fim")
    motivo = models.CharField("motivo", max_length=255, blank=True)
    ativo = models.BooleanField("ativo", default=True, db_index=True)

    class Meta:
        verbose_name = "Ausência do profissional"
        verbose_name_plural = "Ausências dos profissionais"
        ordering = ["-data_inicio"]

    def __str__(self) -> str:
        return f"{self.profissional} — {self.data_inicio} a {self.data_fim}"


class StatusAgendamento(models.TextChoices):
    """Estados possíveis de um agendamento de consulta."""

    AGENDADO       = "AGENDADO",       "Agendado"
    PRE_CONFIRMADO = "PRE_CONFIRMADO", "Pré-confirmado"
    CONFIRMADO     = "CONFIRMADO",     "Confirmado"
    EM_ATENDIMENTO = "EM_ATENDIMENTO", "Em atendimento"
    ATENDIDO       = "ATENDIDO",       "Atendido"
    FALTA          = "FALTA",          "Falta"
    DESMARCADO     = "DESMARCADO",     "Desmarcado"


class Frequencia(models.TextChoices):
    """Frequência de repetição de uma série de agendamentos."""

    SEMANAL   = "SEMANAL",   "Semanal"
    QUINZENAL = "QUINZENAL", "Quinzenal"
    MENSAL    = "MENSAL",    "Mensal"


class SerieRecorrente(ModeloBase):
    """Agrupa as ocorrências de um agendamento recorrente."""

    frequencia = models.CharField(
        "frequência", max_length=10, choices=Frequencia.choices
    )
    data_fim = models.DateField("data fim da recorrência")
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="series_recorrentes",
        verbose_name="criado por",
    )
    ativo = models.BooleanField("ativo", default=True)

    class Meta:
        verbose_name = "Série recorrente"
        verbose_name_plural = "Séries recorrentes"
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return f"Série {self.get_frequencia_display()} até {self.data_fim}"


class Agendamento(ModeloBase):
    """
    Consulta agendada na clínica.

    O ``horario_fim`` é calculado automaticamente a partir da duração do
    ``servico`` e validado contra conflitos de profissional e sala antes de
    persistir (ver ``AgendamentoSerializer.validate``).

    Ao alterar o status para ``FALTA`` ou ``DESMARCADO``, é obrigatório informar
    um parecer em ``parecer_status`` (validado no serializer).
    """

    paciente = models.ForeignKey(
        "pacientes.Paciente",
        on_delete=models.PROTECT,
        related_name="agendamentos",
        verbose_name="paciente",
    )
    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="agendamentos",
        limit_choices_to={"papeis__codigo": Papel.PROFISSIONAL},
        verbose_name="profissional",
    )
    sala = models.ForeignKey(
        Sala,
        on_delete=models.PROTECT,
        related_name="agendamentos",
        verbose_name="sala",
    )
    servico = models.ForeignKey(
        Servico,
        on_delete=models.PROTECT,
        related_name="agendamentos",
        verbose_name="serviço",
    )
    data = models.DateField("data", db_index=True)
    horario_inicio = models.TimeField("horário de início")
    horario_fim = models.TimeField("horário de fim")
    status = models.CharField(
        "status",
        max_length=14,
        choices=StatusAgendamento.choices,
        default=StatusAgendamento.AGENDADO,
        db_index=True,
    )
    parecer_status = models.TextField(
        "Parecer/Justificativa do Status",
        blank=True,
        null=True,
        help_text="Obrigatório caso o status seja Falta ou Desmarcado.",
    )
    serie = models.ForeignKey(
        SerieRecorrente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ocorrencias",
        verbose_name="série recorrente",
    )
    numero_na_serie = models.PositiveSmallIntegerField(
        "número na série", null=True, blank=True
    )
    observacoes = models.TextField("observações", blank=True, null=True)

    # Cronômetro do atendimento: marcados ao "Iniciar atendimento" e "Finalizar"
    # (ver ``AgendamentoViewSet.iniciar_atendimento``/``finalizar_atendimento``).
    # Enquanto ``atendimento_iniciado_em`` estiver preenchido e
    # ``atendimento_finalizado_em`` não, a sala é considerada em uso.
    atendimento_iniciado_em = models.DateTimeField(
        "atendimento iniciado em",
        null=True,
        blank=True,
        db_index=True,
        help_text="Momento em que o profissional iniciou o atendimento (início do cronômetro).",
    )
    atendimento_finalizado_em = models.DateTimeField(
        "atendimento finalizado em",
        null=True,
        blank=True,
        help_text="Momento em que o atendimento foi finalizado (fim do cronômetro).",
    )

    class Meta:
        verbose_name = "Agendamento"
        verbose_name_plural = "Agendamentos"
        ordering = ["data", "horario_inicio"]
        indexes = [
            models.Index(fields=["data", "profissional"]),
            models.Index(fields=["data", "sala"]),
            models.Index(fields=["data", "paciente"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.paciente} — {self.data} {self.horario_inicio}–{self.horario_fim} "
            f"({self.get_status_display()})"
        )

    @property
    def atendimento_em_andamento(self) -> bool:
        """Atendimento iniciado e ainda não finalizado (ocupa a sala)."""
        return bool(self.atendimento_iniciado_em and not self.atendimento_finalizado_em)

    @property
    def duracao_atendimento_segundos(self) -> int | None:
        """
        Duração do atendimento em segundos.

        - Finalizado: ``fim - início``.
        - Em andamento: ``agora - início`` (para o cronômetro se sincronizar).
        - Não iniciado: ``None``.
        """
        if not self.atendimento_iniciado_em:
            return None
        from django.utils import timezone

        fim = self.atendimento_finalizado_em or timezone.now()
        return int((fim - self.atendimento_iniciado_em).total_seconds())


class Producao(ModeloBase):
    """
    Ledger (livro-razão) de produção/faturamento de atendimentos.

    Cada registro é um snapshot do valor do serviço no momento em que o
    agendamento gera cobrança (realizado, falta ou cancelamento tardio).
    O vínculo OneToOne com ``Agendamento`` garante no máximo um lançamento
    por consulta; a criação/remoção é feita automaticamente via signal.
    """

    agendamento = models.OneToOneField(
        Agendamento,
        on_delete=models.PROTECT,
        related_name="producao",
        verbose_name="agendamento",
    )
    paciente = models.ForeignKey(
        "pacientes.Paciente",
        on_delete=models.PROTECT,
        related_name="producoes",
        verbose_name="paciente",
    )
    profissional = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="producoes",
        verbose_name="profissional",
    )
    data = models.DateField("data do atendimento", db_index=True)
    servico_nome = models.CharField("nome do serviço", max_length=150)
    valor = models.DecimalField("valor produzido", max_digits=10, decimal_places=2)
    motivo = models.CharField("motivo", max_length=100)

    class Meta:
        verbose_name = "Produção"
        verbose_name_plural = "Produções"
        ordering = ["-data"]

    def __str__(self) -> str:
        return f"{self.data} — {self.servico_nome} ({self.motivo}) — R$ {self.valor}"
