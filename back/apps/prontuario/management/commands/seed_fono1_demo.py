"""
Popula o prontuário do profissional "Fono 1" para demonstração/visualização.

Provisiona os itens fixos e cadastra os itens personalizados da referência
(igual à tela do stakeholder). Re-executável: usa ``get_or_create`` por nome.

Uso::

    ./venv/bin/python manage.py seed_fono1_demo
"""
from django.core.management.base import BaseCommand

from apps.accounts.models import Papel, Usuario
from apps.prontuario.models import ITENS_FIXOS, ItemProntuario, TipoItem


def _campo(cid, tipo, rotulo, ordem, *, obrigatorio=False, opcoes=None):
    return {
        "id": cid,
        "tipo": tipo,
        "rotulo": rotulo,
        "ordem": ordem,
        "obrigatorio": obrigatorio,
        "opcoes": opcoes or [],
    }


# Itens personalizados iguais à referência (nome, tipo, schema).
ITENS_PERSONALIZADOS = [
    ("ATUALIZAÇÕES", TipoItem.TEXTO_LIVRE, []),
    ("ANAMNESE", TipoItem.TEXTO_LIVRE, []),
    (
        "EVOLUÇÃO",
        TipoItem.FORMULARIO,
        [
            _campo("data", "DATA", "Data da sessão", 0, obrigatorio=True),
            _campo("objetivos", "TEXTO_LONGO", "Objetivos trabalhados", 1),
            _campo("atividades", "TEXTO_LONGO", "Atividades realizadas", 2),
            _campo(
                "desempenho", "SELECAO_UNICA", "Desempenho", 3,
                opcoes=["Acima do esperado", "Esperado", "Abaixo do esperado"],
            ),
            _campo("observacoes", "TEXTO_LONGO", "Observações", 4),
        ],
    ),
    ("REFLEXÕES DO TERAPEUTA", TipoItem.TEXTO_LIVRE, []),
    (
        "VISITA ESCOLAR",
        TipoItem.FORMULARIO,
        [
            _campo("escola", "TEXTO_CURTO", "Escola", 0),
            _campo("data", "DATA", "Data da visita", 1),
            _campo("profissional_escola", "TEXTO_CURTO", "Profissional contatado", 2),
            _campo("observacoes", "TEXTO_LONGO", "Observações da visita", 3),
            _campo("encaminhamentos", "TEXTO_LONGO", "Encaminhamentos", 4),
        ],
    ),
    (
        "ENCERRAMENTO",
        TipoItem.FORMULARIO,
        [
            _campo("data", "DATA", "Data do encerramento", 0, obrigatorio=True),
            _campo(
                "motivo", "SELECAO_UNICA", "Motivo", 1,
                opcoes=["Alta", "Transferência", "Desistência", "Outro"],
            ),
            _campo("sintese", "TEXTO_LONGO", "Síntese do acompanhamento", 2),
            _campo("encaminhamentos", "TEXTO_LONGO", "Encaminhamentos", 3),
        ],
    ),
    (
        "PLANO DE ATENDIMENTO",
        TipoItem.FORMULARIO,
        [
            _campo("objetivos_gerais", "TEXTO_LONGO", "Objetivos gerais", 0, obrigatorio=True),
            _campo("objetivos_especificos", "TEXTO_LONGO", "Objetivos específicos", 1),
            _campo("frequencia", "TEXTO_CURTO", "Frequência", 2),
            _campo("estrategias", "TEXTO_LONGO", "Estratégias / abordagem", 3),
            _campo("reavaliacao", "DATA", "Previsão de reavaliação", 4),
        ],
    ),
]


class Command(BaseCommand):
    help = 'Popula o prontuário do profissional "Fono 1" (itens fixos + personalizados).'

    def handle(self, *args, **options):
        prof = (
            Usuario.objects.filter(nome__iexact="Fono 1").first()
            or Usuario.objects.filter(
                nome__icontains="Fono", role=Papel.PROFISSIONAL
            ).first()
        )
        if prof is None:
            self.stderr.write(self.style.ERROR('Profissional "Fono 1" não encontrado.'))
            return

        # Itens fixos.
        fixos_criados = 0
        existentes_fixos = set(
            ItemProntuario.objects.filter(profissional=prof)
            .exclude(chave_fixa="")
            .values_list("chave_fixa", flat=True)
        )
        for ordem, (chave, nome, visivel) in enumerate(ITENS_FIXOS):
            if chave not in existentes_fixos:
                ItemProntuario.objects.create(
                    profissional=prof,
                    nome=nome,
                    tipo_item=TipoItem.FIXO,
                    chave_fixa=chave,
                    visivel=visivel,
                    ordem=ordem,
                )
                fixos_criados += 1

        # Itens personalizados.
        personalizados_criados = 0
        base_ordem = len(ITENS_FIXOS)
        for i, (nome, tipo, schema) in enumerate(ITENS_PERSONALIZADOS):
            _, created = ItemProntuario.objects.get_or_create(
                profissional=prof,
                nome=nome,
                defaults={
                    "tipo_item": tipo,
                    "formulario_schema": schema,
                    "ordem": base_ordem + i,
                    "visivel": True,
                },
            )
            if created:
                personalizados_criados += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Fono 1 (id={prof.id}): {fixos_criados} itens fixos e "
                f"{personalizados_criados} personalizados criados."
            )
        )
