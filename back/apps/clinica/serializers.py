"""Serializers do módulo de clínica: salas, serviços, disponibilidade, ausências e agendamentos."""
from datetime import date, datetime, time, timedelta
from typing import Any

from django.db.models import Q, QuerySet
from rest_framework import serializers

from apps.accounts.models import Papel
from apps.clinica.models import (
    Agendamento,
    AusenciaProfissional,
    DisponibilidadeProfissional,
    Producao,
    Sala,
    Servico,
    StatusAgendamento,
)


def _calcular_horario_fim(
    data: date, horario_inicio: time, duracao_minutos: int
) -> time:
    """Soma a duração do serviço ao horário de início e retorna o horário de fim."""
    inicio_dt = datetime.combine(data, horario_inicio)
    fim_dt = inicio_dt + timedelta(minutes=duracao_minutos)
    return fim_dt.time()


def _tem_sobreposicao(
    queryset: QuerySet[Agendamento],
    data: date,
    horario_inicio: time,
    horario_fim: time,
    *,
    exclude_pk: int | None = None,
) -> bool:
    """
    Verifica se existe agendamento ativo (não cancelado) que se sobrepõe ao
    intervalo ``[horario_inicio, horario_fim)`` na mesma ``data``.

    Regra de interseção: ``inicio_existente < novo_fim AND fim_existente > novo_inicio``.
    """
    qs = queryset.filter(data=data).exclude(status=StatusAgendamento.DESMARCADO).filter(
        Q(horario_inicio__lt=horario_fim) & Q(horario_fim__gt=horario_inicio)
    )
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    return qs.exists()


class SalaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sala
        fields = [
            "id",
            "nome",
            "descricao",
            "ativa",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]


class ServicoSerializer(serializers.ModelSerializer):
    margem = serializers.SerializerMethodField(read_only=True)

    def get_margem(self, obj):
        return str(obj.valor_clinica - obj.valor_repasse)

    def validate(self, attrs):
        clinica = attrs.get("valor_clinica", getattr(self.instance, "valor_clinica", None))
        repasse = attrs.get("valor_repasse", getattr(self.instance, "valor_repasse", None))
        if clinica is not None and repasse is not None and repasse > clinica:
            raise serializers.ValidationError(
                {"valor_repasse": "Repasse não pode exceder o valor da clínica."}
            )
        return attrs

    class Meta:
        model = Servico
        fields = [
            "id",
            "nome",
            "descricao",
            "duracao_minutos",
            "valor_clinica",
            "valor_repasse",
            "margem",
            "profissionais",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "margem", "criado_em", "atualizado_em"]


class DisponibilidadeProfissionalSerializer(serializers.ModelSerializer):
    dia_semana_display = serializers.CharField(
        source="get_dia_semana_display", read_only=True
    )

    class Meta:
        model = DisponibilidadeProfissional
        fields = [
            "id",
            "profissional",
            "dia_semana",
            "dia_semana_display",
            "horario_inicio",
            "horario_fim",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]

    def validate(self, attrs):
        inicio = attrs.get("horario_inicio", getattr(self.instance, "horario_inicio", None))
        fim = attrs.get("horario_fim", getattr(self.instance, "horario_fim", None))
        if inicio and fim and inicio >= fim:
            raise serializers.ValidationError(
                "O horário de início deve ser anterior ao horário de fim."
            )
        return attrs

    def get_unique_together_validators(self):
        """
        POST idempotente: na criação, a unicidade
        (profissional, dia_semana, horario_inicio) é garantida pelo
        ``update_or_create`` em ``create`` — reenviar uma janela já existente
        apenas a atualiza, em vez de retornar 400. Em updates, mantém a
        validação padrão (mensagem amigável em caso de colisão).
        """
        if self.instance is None:
            return []
        return super().get_unique_together_validators()

    def create(self, validated_data):
        """Cria ou atualiza a janela com a mesma chave natural (upsert idempotente)."""
        chave = {
            "profissional": validated_data.pop("profissional"),
            "dia_semana": validated_data.pop("dia_semana"),
            "horario_inicio": validated_data.pop("horario_inicio"),
        }
        # POST = a janela deve existir e estar ativa. Sem ``ativo`` no payload,
        # reativamos — isso cobre o fluxo "desativar tudo e recriar" da grade
        # semanal, em que a linha soft-deletada (ativo=False) é reaproveitada pela
        # chave natural e precisa voltar a ficar ativa.
        validated_data.setdefault("ativo", True)
        instancia, _ = DisponibilidadeProfissional.objects.update_or_create(
            **chave, defaults=validated_data
        )
        return instancia


class AusenciaProfissionalSerializer(serializers.ModelSerializer):
    class Meta:
        model = AusenciaProfissional
        fields = [
            "id",
            "profissional",
            "data_inicio",
            "data_fim",
            "motivo",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]

    def validate(self, attrs):
        inicio = attrs.get("data_inicio", getattr(self.instance, "data_inicio", None))
        fim = attrs.get("data_fim", getattr(self.instance, "data_fim", None))
        if inicio and fim and inicio > fim:
            raise serializers.ValidationError(
                "A data de início não pode ser maior que a data de fim."
            )
        return attrs


class AgendamentoSerializer(serializers.ModelSerializer):
    """
    Serializer de agendamentos com motor de validação anti-conflito.

    Na criação, ``horario_fim`` e ``status`` são somente leitura: o fim é
    calculado pela duração do serviço e o status inicia como ``AGENDADO``.

    Ao alterar o status para ``FALTA`` ou ``DESMARCADO``, o campo
    ``parecer_status`` torna-se obrigatório.
    """

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    paciente_nome = serializers.CharField(source="paciente.nome_completo", read_only=True)
    profissional_nome = serializers.CharField(source="profissional.nome", read_only=True)
    sala_nome = serializers.CharField(source="sala.nome", read_only=True)
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)
    confirmacao = serializers.SerializerMethodField()
    duracao_atendimento_segundos = serializers.IntegerField(read_only=True)

    def get_confirmacao(self, obj):
        """Estado de confirmação por WhatsApp (CONFIRMADO/AGUARDANDO/DESMARCADO/None)."""
        # Import tardio para evitar dependência circular clinica ↔ whatsapp.
        from apps.whatsapp.services import estado_confirmacao

        return estado_confirmacao(obj)

    class Meta:
        model = Agendamento
        fields = [
            "id",
            "paciente",
            "paciente_nome",
            "profissional",
            "profissional_nome",
            "sala",
            "sala_nome",
            "servico",
            "servico_nome",
            "data",
            "horario_inicio",
            "horario_fim",
            "status",
            "status_display",
            "confirmacao",
            "parecer_status",
            "observacoes",
            "atendimento_iniciado_em",
            "atendimento_finalizado_em",
            "duracao_atendimento_segundos",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "id",
            "horario_fim",
            # Cronômetro: gravado apenas pelas actions iniciar/finalizar-atendimento.
            "atendimento_iniciado_em",
            "atendimento_finalizado_em",
            "duracao_atendimento_segundos",
            "criado_em",
            "atualizado_em",
        ]

    def get_read_only_fields(self) -> list[str]:
        """Na criação, ``status`` também é somente leitura (default ``AGENDADO``)."""
        campos = list(super().get_read_only_fields())
        if self.instance is None and "status" not in campos:
            campos.append("status")
        return campos

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        """
        Motor de agendamento: valida parecer obrigatório para faltas/cancelamentos,
        calcula o horário de fim e bloqueia conflitos de profissional e sala.
        """
        instancia = self.instance

        # --- Profissional só muda pela ação de transferência -----------------------
        # A troca de profissional passa a ser feita exclusivamente por
        # ``POST /agendamentos/{id}/transferir/`` (que trata "fora da
        # disponibilidade" como aviso). Um update comum reenvia o profissional
        # atual sem problemas, mas não pode alterá-lo.
        if instancia is not None:
            novo_profissional = attrs.get("profissional")
            if novo_profissional is not None and novo_profissional != instancia.profissional:
                raise serializers.ValidationError(
                    {
                        "profissional": (
                            "Para trocar o profissional, use a ação de transferência."
                        )
                    }
                )

        # --- Validação de transição de status por papel ----------------------------
        status = attrs.get("status", getattr(instancia, "status", None))
        status_atual = getattr(instancia, "status", None)
        if instancia is not None and status_atual and status and status != status_atual:
            request = self.context.get("request")
            if request and hasattr(request.user, "role"):
                from apps.clinica.transitions import validar_transicao
                validar_transicao(status_atual, status, request.user.role)

        # --- Parecer obrigatório para FALTA e DESMARCADO ---------------------------
        parecer_status = attrs.get(
            "parecer_status", getattr(instancia, "parecer_status", None)
        )

        if status in (StatusAgendamento.FALTA, StatusAgendamento.DESMARCADO):
            if parecer_status is None or not str(parecer_status).strip():
                raise serializers.ValidationError(
                    {
                        "parecer_status": (
                            "É necessário fornecer um parecer para este status."
                        )
                    }
                )

        paciente = attrs.get("paciente", getattr(instancia, "paciente", None))
        profissional = attrs.get("profissional", getattr(instancia, "profissional", None))
        sala = attrs.get("sala", getattr(instancia, "sala", None))
        servico = attrs.get("servico", getattr(instancia, "servico", None))
        data_agendamento = attrs.get("data", getattr(instancia, "data", None))
        horario_inicio = attrs.get(
            "horario_inicio", getattr(instancia, "horario_inicio", None)
        )

        if not all([paciente, profissional, sala, servico, data_agendamento, horario_inicio]):
            return attrs

        # Ao desmarcar, o agendamento deixa a grade: não faz sentido barrá-lo por
        # conflito de horário, ausência ou entidades inativas. O parecer obrigatório
        # já foi validado acima.
        if status == StatusAgendamento.DESMARCADO:
            return attrs

        erros: dict[str, list[str]] = {}

        # --- Integridade dos vínculos e entidades ativas ----------------------------
        if not paciente.ativo:
            erros.setdefault("paciente", []).append("O paciente está inativo.")

        if not sala.ativa:
            erros.setdefault("sala", []).append("A sala está inativa.")

        if not servico.ativo:
            erros.setdefault("servico", []).append("O serviço está inativo.")

        if not servico.profissionais.filter(pk=profissional.pk).exists():
            erros.setdefault("servico", []).append(
                "O serviço selecionado não é oferecido pelo profissional informado."
            )

        if profissional.role != Papel.PROFISSIONAL:
            erros.setdefault("profissional", []).append(
                "O usuário informado não possui o papel de profissional."
            )

        if not profissional.is_active:
            erros.setdefault("profissional", []).append("O profissional está inativo.")

        # --- Cálculo do horário de fim (duração do serviço) -----------------------
        horario_fim = _calcular_horario_fim(
            data_agendamento, horario_inicio, servico.duracao_minutos
        )

        if horario_inicio >= horario_fim:
            erros.setdefault("horario_inicio", []).append(
                "O horário de início somado à duração do serviço ultrapassa a meia-noite "
                "ou resulta em intervalo inválido."
            )

        if erros:
            raise serializers.ValidationError(erros)

        # --- Ausência do profissional na data -------------------------------------
        tem_ausencia = AusenciaProfissional.objects.filter(
            profissional=profissional,
            ativo=True,
            data_inicio__lte=data_agendamento,
            data_fim__gte=data_agendamento,
        ).exists()

        if tem_ausencia:
            erros.setdefault("profissional", []).append(
                "O profissional possui ausência registrada para esta data."
            )

        # --- Conflito de horário: profissional --------------------------------------
        conflito_profissional = _tem_sobreposicao(
            Agendamento.objects.filter(profissional=profissional),
            data_agendamento,
            horario_inicio,
            horario_fim,
            exclude_pk=instancia.pk if instancia else None,
        )
        if conflito_profissional:
            erros.setdefault("profissional", []).append(
                "O profissional já possui outro agendamento neste horário."
            )

        # --- Conflito de horário: sala (independente do profissional) -------------
        conflito_sala = _tem_sobreposicao(
            Agendamento.objects.filter(sala=sala),
            data_agendamento,
            horario_inicio,
            horario_fim,
            exclude_pk=instancia.pk if instancia else None,
        )
        if conflito_sala:
            erros.setdefault("sala", []).append(
                "A sala já possui outro agendamento neste horário."
            )

        # --- Disponibilidade semanal do profissional ------------------------------
        # Regra: se o profissional não tem NENHUMA janela cadastrada, a agenda fica
        # livre (permite qualquer horário). Havendo janelas, o intervalo do
        # agendamento precisa caber inteiro dentro de uma janela ativa do dia da
        # semana correspondente (dia_semana: 0=segunda … 6=domingo).
        disponibilidades = DisponibilidadeProfissional.objects.filter(
            profissional=profissional, ativo=True
        )
        if disponibilidades.exists():
            dentro_da_janela = disponibilidades.filter(
                dia_semana=data_agendamento.weekday(),
                horario_inicio__lte=horario_inicio,
                horario_fim__gte=horario_fim,
            ).exists()
            if not dentro_da_janela:
                erros.setdefault("profissional", []).append(
                    "O horário está fora da disponibilidade do profissional."
                )

        if erros:
            raise serializers.ValidationError(erros)

        attrs["horario_fim"] = horario_fim
        return attrs


class ProducaoSerializer(serializers.ModelSerializer):
    """
    Ledger de produção — somente leitura.

    Os lançamentos são criados automaticamente pelo signal de ``Agendamento``;
    a API apenas consulta (filtros por período, profissional e paciente).
    """

    paciente_nome = serializers.CharField(source="paciente.nome_completo", read_only=True)
    profissional_nome = serializers.CharField(source="profissional.nome", read_only=True)

    class Meta:
        model = Producao
        fields = [
            "id",
            "agendamento",
            "paciente",
            "paciente_nome",
            "profissional",
            "profissional_nome",
            "data",
            "servico_nome",
            "valor",
            "motivo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = fields


class AtendimentoEmAndamentoSerializer(serializers.Serializer):
    """Atendimento que ocupa uma sala no momento (cronômetro em andamento)."""

    agendamento_id = serializers.IntegerField()
    paciente_id = serializers.IntegerField()
    paciente_nome = serializers.CharField()
    profissional_id = serializers.IntegerField()
    profissional_nome = serializers.CharField()
    servico_nome = serializers.CharField()
    atendimento_iniciado_em = serializers.DateTimeField()
    duracao_atendimento_segundos = serializers.IntegerField()


class SalaOcupacaoSerializer(serializers.Serializer):
    """Estado de ocupação de uma sala para a visão de ocupação por sala."""

    sala_id = serializers.IntegerField()
    sala_nome = serializers.CharField()
    em_uso = serializers.BooleanField()
    atendimento = AtendimentoEmAndamentoSerializer(allow_null=True)
