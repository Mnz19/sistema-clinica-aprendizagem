"""
Popula a biblioteca de protocolos prontos (formulários pré-definidos).

Re-executável: usa ``update_or_create`` por ``nome``. A especialidade é
associada quando já existir com o mesmo nome (busca tolerante).

Uso::

    ./venv/bin/python manage.py seed_protocolos
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import Especialidade
from apps.prontuario.models import ProtocoloProntuario, TipoItem


def _campo(cid, tipo, rotulo, ordem, *, obrigatorio=False, opcoes=None):
    return {
        "id": cid,
        "tipo": tipo,
        "rotulo": rotulo,
        "ordem": ordem,
        "obrigatorio": obrigatorio,
        "opcoes": opcoes or [],
    }


PROTOCOLOS = [
    {
        "nome": "Anamnese Infantil",
        "descricao": "Ficha inicial para atendimento infantojuvenil.",
        "especialidade": "Psicólogo Clínico",
        "tipo_item": TipoItem.FORMULARIO,
        "schema": [
            _campo("queixa", "TEXTO_LONGO", "Queixa principal", 0, obrigatorio=True),
            _campo("hist_queixa", "TEXTO_LONGO", "História da queixa atual", 1),
            _campo("gestacao", "TEXTO_LONGO", "Histórico gestacional e do nascimento", 2),
            _campo("desenvolvimento", "TEXTO_LONGO", "Marcos do desenvolvimento", 3),
            _campo("saude", "TEXTO_LONGO", "Histórico de saúde", 4),
            _campo("familiar", "TEXTO_LONGO", "Histórico familiar", 5),
            _campo("escola", "TEXTO_LONGO", "Vida escolar", 6),
            _campo("rotina", "TEXTO_LONGO", "Rotina, sono e alimentação", 7),
            _campo("medicacoes", "TEXTO_CURTO", "Medicações em uso", 8),
            _campo("obs", "TEXTO_LONGO", "Observações", 9),
        ],
    },
    {
        "nome": "Evolução de Sessão (TCC)",
        "descricao": "Registro estruturado de evolução por sessão.",
        "especialidade": "Psicólogo Clínico",
        "tipo_item": TipoItem.FORMULARIO,
        "schema": [
            _campo("data_sessao", "DATA", "Data da sessão", 0, obrigatorio=True),
            _campo("humor", "SELECAO_UNICA", "Humor observado", 1,
                   opcoes=["Bom", "Regular", "Ruim"]),
            _campo("temas", "TEXTO_LONGO", "Temas trabalhados", 2, obrigatorio=True),
            _campo("tecnicas", "TEXTO_LONGO", "Técnicas aplicadas", 3),
            _campo("tarefas", "TEXTO_LONGO", "Tarefas de casa", 4),
            _campo("plano", "TEXTO_LONGO", "Plano para próxima sessão", 5),
        ],
    },
    {
        "nome": "Avaliação Neuropsicológica",
        "descricao": "Roteiro de avaliação neuropsicológica.",
        "especialidade": "Neuropsicólogo",
        "tipo_item": TipoItem.FORMULARIO,
        "schema": [
            _campo("sec_id", "SECAO", "Identificação e demanda", 0),
            _campo("motivo", "TEXTO_LONGO", "Motivo do encaminhamento", 1, obrigatorio=True),
            _campo("sec_funcoes", "SECAO", "Funções avaliadas", 2),
            _campo("atencao", "TEXTO_LONGO", "Atenção", 3),
            _campo("memoria", "TEXTO_LONGO", "Memória", 4),
            _campo("funcoes_exec", "TEXTO_LONGO", "Funções executivas", 5),
            _campo("linguagem", "TEXTO_LONGO", "Linguagem", 6),
            _campo("instrumentos", "MULTIPLA_ESCOLHA", "Instrumentos aplicados", 7,
                   opcoes=["WISC", "WAIS", "TDE", "Figuras de Rey", "Stroop"]),
            _campo("conclusao", "TEXTO_LONGO", "Conclusão / hipótese", 8),
        ],
    },
    {
        "nome": "Sessão de Fonoaudiologia",
        "descricao": "Registro de sessão fonoaudiológica.",
        "especialidade": "Fonoaudiólogo",
        "tipo_item": TipoItem.FORMULARIO,
        "schema": [
            _campo("data_sessao", "DATA", "Data da sessão", 0, obrigatorio=True),
            _campo("objetivos", "TEXTO_LONGO", "Objetivos da sessão", 1),
            _campo("atividades", "TEXTO_LONGO", "Atividades realizadas", 2),
            _campo("desempenho", "SELECAO_UNICA", "Desempenho", 3,
                   opcoes=["Acima do esperado", "Esperado", "Abaixo do esperado"]),
            _campo("orientacoes", "TEXTO_LONGO", "Orientações aos responsáveis", 4),
        ],
    },
]


class Command(BaseCommand):
    help = "Popula a biblioteca de protocolos prontos do prontuário."

    def handle(self, *args, **options):
        criados = atualizados = 0
        for proto in PROTOCOLOS:
            especialidade = None
            nome_esp = proto.get("especialidade")
            if nome_esp:
                especialidade = Especialidade.objects.filter(
                    nome__iexact=nome_esp
                ).first()

            _, created = ProtocoloProntuario.objects.update_or_create(
                nome=proto["nome"],
                defaults={
                    "descricao": proto["descricao"],
                    "especialidade": especialidade,
                    "tipo_item": proto["tipo_item"],
                    "formulario_schema": proto["schema"],
                    "ativo": True,
                },
            )
            if created:
                criados += 1
            else:
                atualizados += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Protocolos prontos: {criados} criados, {atualizados} atualizados."
            )
        )
