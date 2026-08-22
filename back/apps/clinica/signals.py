"""
Signals do módulo de clínica.

A Produção atua como ledger imutável: ao mudar o status do ``Agendamento``,
criamos/atualizamos (ou removemos) o snapshot de valor do serviço.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.clinica.models import Agendamento, Producao, StatusAgendamento

# Antecedência mínima para cancelamento sem cobrança (regra de negócio).
ANTECEDENCIA_CANCELAMENTO_SEM_COBRANCA = timedelta(hours=8)

MOTIVO_REALIZADO = "Atendimento Realizado"
MOTIVO_FALTA = "Falta do Paciente"
MOTIVO_CANCELAMENTO_TARDIO = "Cancelamento Tardio (< 8h)"


def _inicio_agendamento(agendamento: Agendamento) -> datetime:
    """Combina data + horário de início e torna timezone-aware (TZ do projeto)."""
    naive = datetime.combine(agendamento.data, agendamento.horario_inicio)
    if timezone.is_naive(naive):
        return timezone.make_aware(naive, timezone.get_current_timezone())
    return naive


def _upsert_producao(agendamento: Agendamento, motivo: str) -> Producao:
    """Cria ou atualiza o lançamento de produção a partir do snapshot do serviço."""
    servico = agendamento.servico
    producao, _criado = Producao.objects.update_or_create(
        agendamento=agendamento,
        defaults={
            "paciente": agendamento.paciente,
            "profissional": agendamento.profissional,
            "data": agendamento.data,
            "servico_nome": servico.nome,
            "valor": servico.valor_clinica,
            "motivo": motivo,
        },
    )
    return producao


def _remover_producao(agendamento: Agendamento) -> None:
    """Remove o lançamento de produção (correção / cancelamento com antecedência)."""
    Producao.objects.filter(agendamento=agendamento).delete()


@receiver(post_save, sender=Agendamento)
def sincronizar_producao_com_agendamento(
    sender: type[Agendamento],
    instance: Agendamento,
    **kwargs: Any,
) -> None:
    """
    Mantém o ledger de ``Producao`` alinhado ao status do agendamento.

    - ``ATENDIDO`` → cria/atualiza com motivo "Atendimento Realizado".
    - ``FALTA`` → cria/atualiza com motivo "Falta do Paciente".
    - ``DESMARCADO`` com ≤ 8h até o início → cria/atualiza "Cancelamento Tardio (< 8h)".
    - ``DESMARCADO`` com > 8h de antecedência, ou retorno a
      ``AGENDADO``/``PRE_CONFIRMADO``/``CONFIRMADO`` → remove a produção (se existir),
      permitindo correção da secretária.
    """
    status = instance.status

    if status == StatusAgendamento.ATENDIDO:
        _upsert_producao(instance, MOTIVO_REALIZADO)
        return

    if status == StatusAgendamento.FALTA:
        _upsert_producao(instance, MOTIVO_FALTA)
        return

    if status == StatusAgendamento.DESMARCADO:
        inicio = _inicio_agendamento(instance)
        tempo_restante = inicio - timezone.now()
        if tempo_restante <= ANTECEDENCIA_CANCELAMENTO_SEM_COBRANCA:
            _upsert_producao(instance, MOTIVO_CANCELAMENTO_TARDIO)
        else:
            _remover_producao(instance)
        return

    if status in (
        StatusAgendamento.AGENDADO,
        StatusAgendamento.PRE_CONFIRMADO,
        StatusAgendamento.CONFIRMADO,
    ):
        _remover_producao(instance)
