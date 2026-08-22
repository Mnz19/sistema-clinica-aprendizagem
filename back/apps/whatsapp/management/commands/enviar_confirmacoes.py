"""
Comando que envia as confirmações de consulta do dia-alvo.

Uso típico (via cron, ex.: a cada 30 min): busca os agendamentos cuja data é
``hoje + antecedência`` e, se já passou do horário de disparo configurado,
envia a confirmação (idempotente — não reenvia).

    ./venv/bin/python manage.py enviar_confirmacoes
    ./venv/bin/python manage.py enviar_confirmacoes --forcar --data 2026-07-20
"""
from datetime import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.clinica.models import Agendamento, StatusAgendamento
from apps.whatsapp.models import ConfiguracaoConfirmacao, StatusMensagem
from apps.whatsapp.providers import modo_simulado
from apps.whatsapp.services import enviar_confirmacao


class Command(BaseCommand):
    help = "Envia as confirmações de consulta por WhatsApp do dia-alvo."

    def add_arguments(self, parser):
        parser.add_argument(
            "--forcar",
            action="store_true",
            help="Ignora o horário de disparo e o flag 'ativo'.",
        )
        parser.add_argument(
            "--data",
            type=str,
            default=None,
            help="Data-alvo (YYYY-MM-DD). Padrão: hoje + antecedência.",
        )

    def handle(self, *args, **opts):
        config = ConfiguracaoConfirmacao.carregar()

        if not config.ativo and not opts["forcar"]:
            self.stdout.write("Envio desativado na configuração. Nada a fazer.")
            return

        agora = timezone.localtime()
        if not opts["forcar"] and agora.time() < config.horario_disparo:
            self.stdout.write(
                f"Ainda não é o horário de disparo ({config.horario_disparo}). "
                "Nada a fazer."
            )
            return

        if opts["data"]:
            alvo = datetime.strptime(opts["data"], "%Y-%m-%d").date()
        else:
            alvo = agora.date() + timezone.timedelta(days=config.antecedencia_dias)

        agendamentos = Agendamento.objects.filter(
            data=alvo, status=StatusAgendamento.AGENDADO
        ).select_related("paciente", "profissional")

        enviados = erros = pulados = 0
        for ag in agendamentos:
            registro = enviar_confirmacao(ag, config=config, forcar=opts["forcar"])
            if registro.status == StatusMensagem.ENVIADO:
                enviados += 1
            elif registro.status == StatusMensagem.ERRO:
                erros += 1
            else:
                pulados += 1

        modo = " (modo SIMULADO)" if modo_simulado() else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"Confirmações para {alvo}{modo}: "
                f"{enviados} enviadas, {erros} com erro, {pulados} já existentes."
            )
        )
