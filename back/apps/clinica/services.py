"""
Serviço de agendamentos recorrentes.

- ``gerar_datas``: função pura que calcula as datas de ocorrência de uma série.
- ``criar_serie``: cria SerieRecorrente + Agendamentos em bulk, respeitando
  conflitos de profissional e sala.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from rest_framework.exceptions import ValidationError

from apps.accounts.models import Papel
from apps.clinica.models import (
    Agendamento,
    AusenciaProfissional,
    DisponibilidadeProfissional,
    Frequencia,
    SerieRecorrente,
    StatusAgendamento,
)
from apps.clinica.serializers import _calcular_horario_fim, _tem_sobreposicao

MAX_OCORRENCIAS = 104

# Só agendamentos "em aberto" podem ser transferidos: uma consulta atendida,
# faltosa, desmarcada ou já em atendimento não deve trocar de profissional.
STATUS_TRANSFERIVEIS = (
    StatusAgendamento.AGENDADO,
    StatusAgendamento.PRE_CONFIRMADO,
    StatusAgendamento.CONFIRMADO,
)


def gerar_datas(data_inicio: date, frequencia: str, data_fim: date) -> list[date]:
    """
    Retorna lista de datas de ocorrência entre data_inicio e data_fim (inclusive).

    Raises:
        ValidationError: se data_fim < data_inicio ou ocorrências > MAX_OCORRENCIAS.
    """
    if data_fim < data_inicio:
        raise ValidationError(
            {"data_fim_recorrencia": "A data fim deve ser posterior à data de início."}
        )

    datas: list[date] = []
    atual = data_inicio

    while atual <= data_fim:
        datas.append(atual)
        if frequencia == Frequencia.SEMANAL:
            atual = atual + timedelta(weeks=1)
        elif frequencia == Frequencia.QUINZENAL:
            atual = atual + timedelta(weeks=2)
        else:  # MENSAL
            atual = _proximo_mes(atual)

    if len(datas) > MAX_OCORRENCIAS:
        raise ValidationError(
            {
                "data_fim_recorrencia": (
                    f"Período de recorrência excede o limite de {MAX_OCORRENCIAS} sessões "
                    f"(calculadas: {len(datas)})."
                )
            }
        )

    return datas


def _proximo_mes(d: date) -> date:
    """Avança exatamente um mês, respeitando o último dia do mês destino."""
    mes = d.month % 12 + 1
    ano = d.year + (d.month // 12)
    ultimo_dia = monthrange(ano, mes)[1]
    return d.replace(year=ano, month=mes, day=min(d.day, ultimo_dia))


def criar_serie(
    agendamento_origem: Agendamento,
    frequencia: str,
    data_fim: date,
    criado_por,
) -> tuple[list[Agendamento], list[dict]]:
    """
    Cria uma SerieRecorrente e gera todas as ocorrências a partir do agendamento_origem.

    O próprio agendamento_origem NÃO é incluído na série (já existe).
    As datas geradas começam no dia SEGUINTE ao agendamento_origem.data.

    Returns:
        (criados, nao_criados) onde nao_criados é lista de {"data": date, "motivo": str}.
    """
    data_inicio = agendamento_origem.data + timedelta(days=1)

    # gerar_datas levanta ValidationError se data_fim inválida ou > MAX_OCORRENCIAS
    # Ajusta: se data_inicio > data_fim retorna lista vazia sem erro
    if data_inicio > data_fim:
        return [], []

    datas = gerar_datas(data_inicio, frequencia, data_fim)

    serie = SerieRecorrente.objects.create(
        frequencia=frequencia,
        data_fim=data_fim,
        criado_por=criado_por,
    )

    # Vincula o agendamento_origem à série
    agendamento_origem.serie = serie
    agendamento_origem.numero_na_serie = 1
    agendamento_origem.save(update_fields=["serie", "numero_na_serie"])

    criados: list[Agendamento] = []
    nao_criados: list[dict] = []

    for numero, data in enumerate(datas, start=2):
        horario_fim = _calcular_horario_fim(
            data, agendamento_origem.horario_inicio, agendamento_origem.servico.duracao_minutos
        )

        conflito_prof = _tem_sobreposicao(
            Agendamento.objects.filter(profissional=agendamento_origem.profissional),
            data,
            agendamento_origem.horario_inicio,
            horario_fim,
        )
        conflito_sala = _tem_sobreposicao(
            Agendamento.objects.filter(sala=agendamento_origem.sala),
            data,
            agendamento_origem.horario_inicio,
            horario_fim,
        )

        if conflito_prof or conflito_sala:
            motivo = "conflito de profissional" if conflito_prof else "conflito de sala"
            nao_criados.append({"data": str(data), "motivo": motivo})
            continue

        criados.append(
            Agendamento(
                paciente=agendamento_origem.paciente,
                profissional=agendamento_origem.profissional,
                sala=agendamento_origem.sala,
                servico=agendamento_origem.servico,
                data=data,
                horario_inicio=agendamento_origem.horario_inicio,
                horario_fim=horario_fim,
                status=StatusAgendamento.AGENDADO,
                serie=serie,
                numero_na_serie=numero,
            )
        )

    if criados:
        Agendamento.objects.bulk_create(criados)

    return criados, nao_criados


def transferir_agendamento(
    agendamento: Agendamento,
    novo_profissional,
    *,
    confirmar: bool = False,
) -> tuple[bool, list[str]]:
    """
    Transfere um agendamento em aberto para outro profissional.

    Decisão de produto: estar FORA da disponibilidade semanal do profissional
    de destino é apenas um AVISO — não trava. Já ausência/férias na data,
    serviço não oferecido pelo destino e choque de horário (agenda dupla)
    continuam BLOQUEANDO.

    Fluxo de confirmação:
        - Havendo avisos e ``confirmar=False``, nada é salvo e a função retorna
          ``(False, avisos)`` — a UI mostra o alerta e reenvia com
          ``confirmar=True``.
        - Sem avisos, ou com ``confirmar=True``, a transferência é efetivada e
          retorna ``(True, avisos)``.

    Raises:
        ValidationError: para qualquer bloqueio (regra dura).
    """
    if agendamento.status not in STATUS_TRANSFERIVEIS:
        raise ValidationError(
            {
                "status": (
                    "Só é possível transferir agendamentos em aberto "
                    "(Agendado, Pré-confirmado ou Confirmado)."
                )
            }
        )

    if novo_profissional.pk == agendamento.profissional_id:
        raise ValidationError(
            {"profissional": "O agendamento já pertence a este profissional."}
        )

    erros: dict[str, list[str]] = {}

    # --- Profissional de destino válido ---------------------------------------
    if not novo_profissional.eh_profissional:
        erros.setdefault("profissional", []).append(
            "O usuário informado não possui o papel de profissional."
        )
    if not novo_profissional.is_active:
        erros.setdefault("profissional", []).append(
            "O profissional de destino está inativo."
        )

    # --- Serviço precisa ser oferecido pelo destino (bloqueia) ----------------
    servico = agendamento.servico
    if not servico.profissionais.filter(pk=novo_profissional.pk).exists():
        erros.setdefault("servico", []).append(
            "O serviço do agendamento não é oferecido pelo profissional de destino."
        )

    data = agendamento.data
    horario_inicio = agendamento.horario_inicio
    horario_fim = agendamento.horario_fim

    # --- Ausência do destino na data (bloqueia) -------------------------------
    tem_ausencia = AusenciaProfissional.objects.filter(
        profissional=novo_profissional,
        ativo=True,
        data_inicio__lte=data,
        data_fim__gte=data,
    ).exists()
    if tem_ausencia:
        erros.setdefault("profissional", []).append(
            "O profissional de destino possui ausência registrada para esta data."
        )

    # --- Choque de horário do destino / agenda dupla (bloqueia) ---------------
    conflito = _tem_sobreposicao(
        Agendamento.objects.filter(profissional=novo_profissional),
        data,
        horario_inicio,
        horario_fim,
        exclude_pk=agendamento.pk,
    )
    if conflito:
        erros.setdefault("profissional", []).append(
            "O profissional de destino já possui outro agendamento neste horário."
        )

    if erros:
        raise ValidationError(erros)

    # --- Fora da disponibilidade semanal do destino (apenas AVISO) ------------
    avisos: list[str] = []
    disponibilidades = DisponibilidadeProfissional.objects.filter(
        profissional=novo_profissional, ativo=True
    )
    if disponibilidades.exists():
        dentro_da_janela = disponibilidades.filter(
            dia_semana=data.weekday(),
            horario_inicio__lte=horario_inicio,
            horario_fim__gte=horario_fim,
        ).exists()
        if not dentro_da_janela:
            avisos.append(
                "O horário está fora da disponibilidade semanal do "
                "profissional de destino."
            )

    if avisos and not confirmar:
        return False, avisos

    agendamento.profissional = novo_profissional
    agendamento.save(update_fields=["profissional", "atualizado_em"])
    return True, avisos
