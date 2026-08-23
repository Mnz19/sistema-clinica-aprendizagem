"""
Signals que espelham os agendamentos no Google Agenda dos profissionais.

Regra de ouro: a sincronização roda **depois do commit** (``transaction.
on_commit``) e nunca levanta exceção para o fluxo de negócio — as chamadas à API
do Google não seguram a transação nem derrubam o save do agendamento.

- ``post_save`` de ``Agendamento`` → cria/atualiza/move o evento (via
  ``sincronizar_agendamento_seguro``), cobrindo também mudança de status e
  transferência de profissional.
- ``pre_delete`` de ``Agendamento`` → captura o vínculo ``EventoGoogle`` (que
  seria removido em cascata) e agenda a exclusão do evento remoto no commit.
"""
from __future__ import annotations

from typing import Any

from django.db import transaction
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.clinica.models import Agendamento
from apps.google_agenda import services
from apps.google_agenda.models import EventoGoogle


@receiver(post_save, sender=Agendamento)
def sincronizar_agendamento_no_google(
    sender: type[Agendamento], instance: Agendamento, **kwargs: Any
) -> None:
    """Após salvar um agendamento, espelha-o no Google (fora da transação)."""
    if not services.esta_configurado():
        return
    agendamento_id = instance.pk
    transaction.on_commit(
        lambda: services.sincronizar_agendamento_seguro(agendamento_id)
    )


@receiver(pre_delete, sender=Agendamento)
def remover_evento_no_google(
    sender: type[Agendamento], instance: Agendamento, **kwargs: Any
) -> None:
    """Antes de apagar o agendamento, agenda a remoção do evento remoto."""
    if not services.esta_configurado():
        return
    vinculo = (
        EventoGoogle.objects.select_related("conta")
        .filter(agendamento=instance)
        .first()
    )
    if vinculo is None:
        return
    conta = vinculo.conta
    event_id = vinculo.google_event_id
    # O vínculo EventoGoogle é apagado em cascata junto do agendamento; por isso
    # capturamos conta+event_id agora e só tocamos o Google após o commit.
    transaction.on_commit(lambda: services.apagar_evento_seguro(conta, event_id))
