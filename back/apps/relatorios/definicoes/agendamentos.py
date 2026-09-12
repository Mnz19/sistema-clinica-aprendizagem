"""
Relatório de Agendamentos.

Exporta a agenda no período com paciente, profissional, sala, serviço, status e
o tempo real de atendimento (cronômetro). É o relatório operacional da recepção:
conferência do dia, apuração de faltas e auditoria de desmarcações.

Acesso: DIREÇÃO, SUPERVISÃO e RECEPÇÃO. O profissional "puro" que por acumular
papel chegue aqui vê apenas a própria agenda (ver ``queryset``).
"""
from apps.clinica.models import Agendamento, Frequencia, StatusAgendamento
from apps.relatorios.definicoes.base import Coluna, Formato, RelatorioBase, rotulos
from apps.relatorios.filtros import Filtros, validar_escolhas

_STATUS = rotulos(StatusAgendamento)
_FREQUENCIAS = rotulos(Frequencia)


class RelatorioAgendamentos(RelatorioBase):
    slug = "agendamentos"
    titulo = "Relatório de Agendamentos"
    nome_aba = "Agendamentos"
    prefixo_arquivo = "relatorio_agendamentos"
    campos_filtro = (
        "data_inicio",
        "data_fim",
        "profissional",
        "paciente",
        "sala",
        "servico",
        "status",
    )
    colunas = [
        Coluna("data", "Data", Formato.DATA, largura=12),
        Coluna("dia_semana", "Dia da semana", largura=15),
        Coluna("horario_inicio", "Início", Formato.HORA, largura=9),
        Coluna("horario_fim", "Fim", Formato.HORA, largura=9),
        Coluna("paciente", "Paciente", largura=32),
        Coluna("profissional", "Profissional", largura=28),
        Coluna("servico", "Serviço", largura=28),
        Coluna("sala", "Sala", largura=18),
        Coluna("status", "Status", largura=16),
        Coluna("duracao_prevista", "Duração prevista", Formato.MINUTOS, largura=16),
        Coluna("duracao_real", "Duração real", Formato.MINUTOS, largura=14),
        Coluna("recorrencia", "Recorrência", largura=14),
        Coluna("parecer_status", "Parecer / justificativa", largura=40),
        Coluna("observacoes", "Observações", largura=40),
        Coluna("criado_em", "Agendado em", Formato.DATA_HORA, largura=18),
    ]

    #: Dias da semana por índice de ``date.weekday()`` (0 = segunda).
    _DIAS = (
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado",
        "Domingo",
    )

    def queryset(self, usuario, filtros: Filtros):
        qs = Agendamento.objects.select_related(
            "paciente", "profissional", "sala", "servico", "serie"
        )

        if filtros.data_inicio:
            qs = qs.filter(data__gte=filtros.data_inicio)
        if filtros.data_fim:
            qs = qs.filter(data__lte=filtros.data_fim)
        if filtros.profissional:
            qs = qs.filter(profissional_id=filtros.profissional)
        if filtros.paciente:
            qs = qs.filter(paciente_id=filtros.paciente)
        if filtros.sala:
            qs = qs.filter(sala_id=filtros.sala)
        if filtros.servico:
            qs = qs.filter(servico_id=filtros.servico)
        if filtros.status:
            validar_escolhas(filtros.status, StatusAgendamento.values, "status")
            qs = qs.filter(status__in=filtros.status)

        # Isolamento por papel, espelhando ``RelatorioProducaoViewSet``: quem só é
        # PROFISSIONAL enxerga apenas a própria agenda.
        if usuario.somente_profissional:
            qs = qs.filter(profissional=usuario)

        return qs.order_by("data", "horario_inicio")

    def linha(self, agendamento: Agendamento) -> dict:
        segundos = agendamento.duracao_atendimento_segundos
        return {
            "data": agendamento.data,
            "dia_semana": self._DIAS[agendamento.data.weekday()],
            "horario_inicio": agendamento.horario_inicio,
            "horario_fim": agendamento.horario_fim,
            "paciente": agendamento.paciente.nome_completo,
            "profissional": agendamento.profissional.nome,
            "servico": agendamento.servico.nome,
            "sala": agendamento.sala.nome,
            "status": _STATUS.get(agendamento.status, agendamento.status),
            "duracao_prevista": agendamento.servico.duracao_minutos,
            "duracao_real": round(segundos / 60) if segundos else None,
            "recorrencia": (
                _FREQUENCIAS.get(agendamento.serie.frequencia, "")
                if agendamento.serie
                else "Avulso"
            ),
            "parecer_status": agendamento.parecer_status or "",
            "observacoes": agendamento.observacoes or "",
            "criado_em": agendamento.criado_em,
        }

    def descrever_filtros_especificos(self, filtros: Filtros) -> list[str]:
        frases = []
        if filtros.status:
            nomes = ", ".join(_STATUS.get(s, s) for s in filtros.status)
            frases.append(f"Status: {nomes}")
        if filtros.sala:
            frases.append(f"Sala: {_nome_sala(filtros.sala)}")
        if filtros.servico:
            frases.append(f"Serviço: {_nome_servico(filtros.servico)}")
        return frases


def _nome_sala(pk: int) -> str:
    from apps.clinica.models import Sala

    sala = Sala.objects.filter(pk=pk).only("nome").first()
    return sala.nome if sala else f"#{pk} (não encontrada)"


def _nome_servico(pk: int) -> str:
    from apps.clinica.models import Servico

    servico = Servico.objects.filter(pk=pk).only("nome").first()
    return servico.nome if servico else f"#{pk} (não encontrado)"
